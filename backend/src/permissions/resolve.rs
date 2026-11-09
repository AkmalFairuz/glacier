//! Pure permission math: owner -> @everyone -> roles -> channel overwrites
//! (@everyone overwrite, then role overwrites, then member overwrite).
use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::id::Id;

use super::bits::{ADMINISTRATOR, ALL, VIEW_CHANNEL};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum TargetType {
    Role,
    Member,
}

crate::db::sql_string_enum!(TargetType { Role => "role", Member => "member" });

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct Overwrite {
    pub target_id: Id,
    pub target_type: TargetType,
    pub allow: u64,
    pub deny: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoleInfo {
    pub permissions: u64,
    pub position: i32,
}

/// Everything needed to compute permissions for any member of one server.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PermContext {
    pub server_id: Id,
    pub owner_id: Id,
    pub roles: HashMap<Id, RoleInfo>,
    pub channels: Vec<Id>,
    pub overwrites: HashMap<Id, Vec<Overwrite>>,
}

impl PermContext {
    pub fn base(&self, user: Id, role_ids: &[Id]) -> u64 {
        if user == self.owner_id {
            return ALL;
        }
        // The @everyone role shares the server's id.
        let mut perms = self.roles.get(&self.server_id).map_or(0, |r| r.permissions);
        for role in role_ids {
            if let Some(r) = self.roles.get(role) {
                perms |= r.permissions;
            }
        }
        if perms & ADMINISTRATOR != 0 {
            ALL
        } else {
            perms
        }
    }

    pub fn channel(&self, user: Id, role_ids: &[Id], channel: Id) -> u64 {
        let base = self.base(user, role_ids);
        if base == ALL {
            return ALL;
        }
        let Some(list) = self.overwrites.get(&channel) else {
            return base;
        };
        let mut perms = base;
        if let Some(o) = list
            .iter()
            .find(|o| o.target_type == TargetType::Role && o.target_id == self.server_id)
        {
            perms = (perms & !o.deny) | o.allow;
        }
        let (mut allow, mut deny) = (0, 0);
        for o in list
            .iter()
            .filter(|o| o.target_type == TargetType::Role && role_ids.contains(&o.target_id))
        {
            allow |= o.allow;
            deny |= o.deny;
        }
        perms = (perms & !deny) | allow;
        if let Some(o) = list
            .iter()
            .find(|o| o.target_type == TargetType::Member && o.target_id == user)
        {
            perms = (perms & !o.deny) | o.allow;
        }
        if perms & VIEW_CHANNEL == 0 {
            0
        } else {
            perms
        }
    }

    /// Highest role position held; the owner outranks everyone.
    pub fn top_position(&self, user: Id, role_ids: &[Id]) -> i32 {
        if user == self.owner_id {
            return i32::MAX;
        }
        role_ids
            .iter()
            .filter_map(|r| self.roles.get(r))
            .map(|r| r.position)
            .max()
            .unwrap_or(0)
    }

    /// True when the channel is visible to anyone holding just @everyone,
    /// with no overwrite that could hide it from specific members.
    pub fn publicly_visible(&self, channel: Id) -> bool {
        let everyone = self.roles.get(&self.server_id).map_or(0, |r| r.permissions);
        let list = self.overwrites.get(&channel).map(Vec::as_slice).unwrap_or_default();
        everyone & VIEW_CHANNEL != 0
            && list.iter().all(|o| o.deny & VIEW_CHANNEL == 0)
            && list
                .iter()
                .find(|o| o.target_id == self.server_id && o.target_type == TargetType::Role)
                .is_none_or(|o| o.deny & VIEW_CHANNEL == 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::permissions::bits::*;

    fn ctx() -> PermContext {
        let server = Id(1);
        let mut roles = HashMap::new();
        roles.insert(
            server,
            RoleInfo {
                permissions: DEFAULT_EVERYONE,
                position: 0,
            },
        );
        roles.insert(
            Id(10),
            RoleInfo {
                permissions: MODERATOR,
                position: 2,
            },
        );
        roles.insert(
            Id(11),
            RoleInfo {
                permissions: ADMINISTRATOR,
                position: 3,
            },
        );
        let mut overwrites = HashMap::new();
        overwrites.insert(
            Id(100),
            vec![
                Overwrite {
                    target_id: server,
                    target_type: TargetType::Role,
                    allow: 0,
                    deny: VIEW_CHANNEL,
                },
                Overwrite {
                    target_id: Id(10),
                    target_type: TargetType::Role,
                    allow: VIEW_CHANNEL,
                    deny: 0,
                },
            ],
        );
        overwrites.insert(
            Id(101),
            vec![Overwrite {
                target_id: Id(7),
                target_type: TargetType::Member,
                allow: 0,
                deny: SEND_MESSAGES,
            }],
        );
        PermContext {
            server_id: server,
            owner_id: Id(2),
            roles,
            channels: vec![Id(100), Id(101)],
            overwrites,
        }
    }

    #[test]
    fn owner_has_everything() {
        assert_eq!(ctx().base(Id(2), &[]), ALL);
    }

    #[test]
    fn administrator_bypasses_overwrites() {
        assert_eq!(ctx().channel(Id(5), &[Id(11)], Id(100)), ALL);
    }

    #[test]
    fn everyone_deny_hides_channel() {
        assert_eq!(ctx().channel(Id(5), &[], Id(100)), 0);
        assert!(!ctx().publicly_visible(Id(100)));
    }

    #[test]
    fn role_allow_overrides_everyone_deny() {
        let p = ctx().channel(Id(5), &[Id(10)], Id(100));
        assert!(p & VIEW_CHANNEL != 0 && p & MANAGE_MESSAGES != 0);
    }

    #[test]
    fn member_overwrite_applies_last() {
        let p = ctx().channel(Id(7), &[], Id(101));
        assert_eq!(p & SEND_MESSAGES, 0);
        assert!(p & VIEW_CHANNEL != 0);
        assert!(ctx().publicly_visible(Id(101)));
    }

    #[test]
    fn top_position() {
        assert_eq!(ctx().top_position(Id(5), &[Id(10), Id(11)]), 3);
        assert_eq!(ctx().top_position(Id(2), &[]), i32::MAX);
    }
}
