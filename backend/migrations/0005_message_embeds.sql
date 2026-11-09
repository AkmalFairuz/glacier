-- Link previews (#9): up to three Open Graph cards per message, fetched in the background.
-- The preview image is a copy in MinIO, so clients never contact the linked site.
CREATE TABLE message_embeds (
    message_id BIGINT UNSIGNED NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    url VARCHAR(2048) NOT NULL,
    site_name VARCHAR(128) NULL,
    title VARCHAR(256) NULL,
    description VARCHAR(512) NULL,
    image_url VARCHAR(1024) NULL,
    image_width INT UNSIGNED NULL,
    image_height INT UNSIGNED NULL,
    PRIMARY KEY (message_id, position),
    CONSTRAINT fk_embeds_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Set when the author removes the previews, so an edit does not bring them back.
-- Adding a column with a constant default is an instant change in MariaDB.
ALTER TABLE messages
    ADD COLUMN suppress_embeds TINYINT(1) NOT NULL DEFAULT 0;
