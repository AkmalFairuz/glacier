-- Slowmode (#1): minimum seconds between messages per member in a text channel; 0 is off.
-- Adding a column with a constant default is an instant change in MariaDB.
ALTER TABLE channels
    ADD COLUMN rate_limit_per_user INT UNSIGNED NOT NULL DEFAULT 0 AFTER user_limit;
