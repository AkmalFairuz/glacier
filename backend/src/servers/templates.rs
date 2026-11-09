//! Channel layouts a new server can start from.
use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Clone, Copy, Debug, Default, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServerTemplate {
    #[default]
    Blank,
    Gaming,
    Friends,
    StudyGroup,
    SchoolClub,
}

/// (category name, [(channel type, channel name)])
pub type Layout = &'static [(&'static str, &'static [(&'static str, &'static str)])];

impl ServerTemplate {
    pub fn layout(self) -> Layout {
        match self {
            Self::Blank => &[
                ("Text Channels", &[("text", "general")]),
                ("Voice Channels", &[("voice", "General")]),
            ],
            Self::Gaming => &[
                (
                    "Information",
                    &[("text", "welcome-and-rules"), ("text", "announcements")],
                ),
                (
                    "Text Channels",
                    &[("text", "general"), ("text", "clips-and-highlights")],
                ),
                ("Voice Channels", &[("voice", "Lobby"), ("voice", "Gaming")]),
            ],
            Self::Friends => &[
                (
                    "Text Channels",
                    &[("text", "general"), ("text", "games"), ("text", "music")],
                ),
                ("Voice Channels", &[("voice", "Lounge"), ("voice", "Stream Room")]),
            ],
            Self::StudyGroup => &[
                (
                    "Information",
                    &[
                        ("text", "welcome-and-rules"),
                        ("text", "announcements"),
                        ("text", "resources"),
                    ],
                ),
                (
                    "Text Channels",
                    &[
                        ("text", "general"),
                        ("text", "homework-help"),
                        ("text", "session-planning"),
                        ("text", "off-topic"),
                    ],
                ),
                (
                    "Voice Channels",
                    &[
                        ("voice", "Lounge"),
                        ("voice", "Study Room 1"),
                        ("voice", "Study Room 2"),
                    ],
                ),
            ],
            Self::SchoolClub => &[
                (
                    "Information",
                    &[("text", "welcome-and-rules"), ("text", "announcements")],
                ),
                (
                    "Text Channels",
                    &[("text", "general"), ("text", "events"), ("text", "ideas-and-feedback")],
                ),
                ("Voice Channels", &[("voice", "Lounge"), ("voice", "Meeting Room")]),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ServerTemplate;

    #[test]
    fn every_template_has_a_text_and_voice_channel() {
        for t in [
            ServerTemplate::Blank,
            ServerTemplate::Gaming,
            ServerTemplate::Friends,
            ServerTemplate::StudyGroup,
            ServerTemplate::SchoolClub,
        ] {
            let kinds: Vec<&str> = t
                .layout()
                .iter()
                .flat_map(|(_, chans)| chans.iter().map(|(k, _)| *k))
                .collect();
            assert!(kinds.contains(&"text") && kinds.contains(&"voice"), "{t:?}");
        }
    }
}
