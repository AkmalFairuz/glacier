CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(512) NULL,
    bio VARCHAR(190) NULL,
    banner_color INT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    KEY idx_sessions_user (user_id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE servers (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    icon_url VARCHAR(512) NULL,
    owner_id BIGINT UNSIGNED NOT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL,
    KEY idx_servers_public (is_public),
    CONSTRAINT fk_servers_owner FOREIGN KEY (owner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE server_members (
    server_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    nickname VARCHAR(64) NULL,
    joined_at DATETIME(3) NOT NULL,
    PRIMARY KEY (server_id, user_id),
    KEY idx_members_user (user_id),
    CONSTRAINT fk_members_server FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    server_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL,
    color INT UNSIGNED NULL,
    permissions BIGINT UNSIGNED NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_roles_server (server_id),
    CONSTRAINT fk_roles_server FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE member_roles (
    server_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (server_id, user_id, role_id),
    KEY idx_member_roles_role (role_id),
    CONSTRAINT fk_mr_member FOREIGN KEY (server_id, user_id) REFERENCES server_members (server_id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_mr_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE channels (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    server_id BIGINT UNSIGNED NULL,
    type ENUM('text', 'voice', 'category', 'dm', 'group_dm') NOT NULL,
    name VARCHAR(100) NULL,
    topic VARCHAR(1024) NULL,
    parent_id BIGINT UNSIGNED NULL,
    position INT NOT NULL DEFAULT 0,
    user_limit SMALLINT UNSIGNED NULL,
    owner_id BIGINT UNSIGNED NULL,
    last_message_id BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL,
    KEY idx_channels_server (server_id),
    CONSTRAINT fk_channels_server FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE channel_overwrites (
    channel_id BIGINT UNSIGNED NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    target_type ENUM('role', 'member') NOT NULL,
    allow_bits BIGINT UNSIGNED NOT NULL DEFAULT 0,
    deny_bits BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, target_id),
    CONSTRAINT fk_overwrites_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE dm_participants (
    channel_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (channel_id, user_id),
    KEY idx_dm_user (user_id),
    CONSTRAINT fk_dm_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
    CONSTRAINT fk_dm_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    channel_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    edited_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    KEY idx_messages_channel (channel_id, id),
    FULLTEXT KEY ft_messages_content (content),
    CONSTRAINT fk_messages_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachments (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    channel_id BIGINT UNSIGNED NOT NULL,
    uploader_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NULL,
    url VARCHAR(1024) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(127) NOT NULL,
    size BIGINT UNSIGNED NOT NULL,
    width INT UNSIGNED NULL,
    height INT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL,
    KEY idx_attachments_message (message_id),
    CONSTRAINT fk_attachments_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reactions (
    message_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    -- Binary collation: emoji compare equal under the unicode collations.
    emoji VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (message_id, emoji, user_id),
    CONSTRAINT fk_reactions_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invites (
    code VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
    server_id BIGINT UNSIGNED NOT NULL,
    inviter_id BIGINT UNSIGNED NOT NULL,
    max_uses INT UNSIGNED NULL,
    uses INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    KEY idx_invites_server (server_id),
    CONSTRAINT fk_invites_server FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE bans (
    server_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(512) NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (server_id, user_id),
    CONSTRAINT fk_bans_server FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
    CONSTRAINT fk_bans_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_notes (
    owner_id BIGINT UNSIGNED NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    note VARCHAR(256) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    PRIMARY KEY (owner_id, target_id),
    CONSTRAINT fk_notes_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_notes_target FOREIGN KEY (target_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE read_states (
    user_id BIGINT UNSIGNED NOT NULL,
    channel_id BIGINT UNSIGNED NOT NULL,
    last_read_message_id BIGINT UNSIGNED NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    PRIMARY KEY (user_id, channel_id),
    KEY idx_read_states_channel (channel_id),
    CONSTRAINT fk_read_states_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_read_states_channel FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE
) ENGINE=InnoDB;
