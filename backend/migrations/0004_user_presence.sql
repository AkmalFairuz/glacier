-- Presence states and custom status (#11). `status` is what the user chose; others see
-- `invisible` as offline. Columns added at the end with constant defaults are instant in MariaDB.
ALTER TABLE users
    ADD COLUMN status ENUM('online', 'idle', 'dnd', 'invisible') NOT NULL DEFAULT 'online',
    ADD COLUMN custom_status_text VARCHAR(128) NULL,
    ADD COLUMN custom_status_emoji VARCHAR(64) NULL,
    ADD COLUMN custom_status_expires_at DATETIME(3) NULL;
