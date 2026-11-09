pub const VIEW_CHANNEL: u64 = 1 << 0;
pub const SEND_MESSAGES: u64 = 1 << 1;
pub const ATTACH_FILES: u64 = 1 << 2;
pub const ADD_REACTIONS: u64 = 1 << 3;
pub const MANAGE_MESSAGES: u64 = 1 << 4;
pub const MANAGE_CHANNELS: u64 = 1 << 5;
pub const MANAGE_ROLES: u64 = 1 << 6;
pub const MANAGE_SERVER: u64 = 1 << 7;
pub const KICK_MEMBERS: u64 = 1 << 8;
pub const BAN_MEMBERS: u64 = 1 << 9;
pub const CREATE_INVITE: u64 = 1 << 10;
pub const CONNECT: u64 = 1 << 11;
pub const SPEAK: u64 = 1 << 12;
pub const VIDEO: u64 = 1 << 13;
pub const ADMINISTRATOR: u64 = 1 << 14;

pub const ALL: u64 = (1 << 15) - 1;

pub const DEFAULT_EVERYONE: u64 =
    VIEW_CHANNEL | SEND_MESSAGES | ATTACH_FILES | ADD_REACTIONS | CREATE_INVITE | CONNECT | SPEAK | VIDEO;

pub const MODERATOR: u64 = MANAGE_MESSAGES | KICK_MEMBERS | BAN_MEMBERS;

/// What every participant of a DM / group DM may do.
pub const DM: u64 = VIEW_CHANNEL | SEND_MESSAGES | ATTACH_FILES | ADD_REACTIONS | CONNECT | SPEAK | VIDEO;
