//! Connections held by this replica and local delivery of events.
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};

use tokio::sync::mpsc::UnboundedSender;

use crate::id::Id;

use super::events::{Envelope, Target};

struct Conn {
    user: Id,
    servers: HashSet<Id>,
    tx: UnboundedSender<Arc<str>>,
}

#[derive(Default)]
pub struct Hub {
    next_id: AtomicU64,
    conns: RwLock<HashMap<u64, Conn>>,
}

impl Hub {
    pub fn register(&self, user: Id, servers: HashSet<Id>, tx: UnboundedSender<Arc<str>>) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        self.conns
            .write()
            .expect("hub lock")
            .insert(id, Conn { user, servers, tx });
        id
    }

    pub fn unregister(&self, conn: u64) {
        self.conns.write().expect("hub lock").remove(&conn);
    }

    /// Open connections on this replica.
    pub fn len(&self) -> usize {
        self.conns.read().expect("hub lock").len()
    }

    /// Deliver an envelope from the bus to matching local sockets.
    pub fn dispatch(&self, env: &Envelope) {
        self.track_membership(env);
        let Ok(frame) = serde_json::to_string(&env.event) else {
            return;
        };
        let frame: Arc<str> = frame.into();
        let conns = self.conns.read().expect("hub lock");
        let mut sent = 0;
        for conn in conns.values() {
            let matches = match &env.target {
                Target::Server(s) => conn.servers.contains(s),
                Target::Servers(list) => list.iter().any(|s| conn.servers.contains(s)),
                Target::User(u) => conn.user == *u,
                Target::Users(list) => list.contains(&conn.user),
                Target::Channel { .. } => false,
            };
            if matches && conn.tx.send(frame.clone()).is_ok() {
                sent += 1;
            }
        }
        metrics::counter!("glacier_frames_sent_total").increment(sent);
    }

    /// Keep each connection's server set in sync with join/leave events.
    fn track_membership(&self, env: &Envelope) {
        let server_id = || {
            env.event
                .d
                .get("id")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<Id>().ok())
        };
        let (add, remove) = match env.event.t.as_str() {
            "SERVER_CREATE" => (server_id(), None),
            "SERVER_DELETE" => (None, server_id()),
            _ => return,
        };
        let mut conns = self.conns.write().expect("hub lock");
        for conn in conns.values_mut() {
            let hit = match &env.target {
                Target::User(u) => conn.user == *u,
                Target::Users(list) => list.contains(&conn.user),
                Target::Server(s) => conn.servers.contains(s),
                _ => false,
            };
            if !hit {
                continue;
            }
            if let Some(s) = add {
                conn.servers.insert(s);
            }
            if let Some(s) = remove {
                conn.servers.remove(&s);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::Event;
    use tokio::sync::mpsc::unbounded_channel;

    #[test]
    fn delivers_by_server_and_user() {
        let hub = Hub::default();
        let (tx_a, mut rx_a) = unbounded_channel();
        let (tx_b, mut rx_b) = unbounded_channel();
        hub.register(Id(1), HashSet::from([Id(100)]), tx_a);
        hub.register(Id(2), HashSet::new(), tx_b);

        hub.dispatch(&Envelope {
            target: Target::Server(Id(100)),
            event: Event::new("X", 1),
        });
        assert!(rx_a.try_recv().is_ok());
        assert!(rx_b.try_recv().is_err());

        hub.dispatch(&Envelope {
            target: Target::User(Id(2)),
            event: Event::new("SERVER_CREATE", serde_json::json!({"id": "100"})),
        });
        assert!(rx_b.try_recv().is_ok());
        hub.dispatch(&Envelope {
            target: Target::Server(Id(100)),
            event: Event::new("Y", 1),
        });
        assert!(rx_a.try_recv().is_ok());
        assert!(rx_b.try_recv().is_ok());
    }
}
