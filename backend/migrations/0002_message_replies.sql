-- Replies (#16). No foreign key on purpose: when the original is deleted the reply keeps
-- reply_to_id, which is how clients know to show "Original message was deleted".
-- Adding a nullable column is an instant change in MariaDB, and the index builds online.
ALTER TABLE messages
    ADD COLUMN reply_to_id BIGINT UNSIGNED NULL AFTER content,
    ADD KEY idx_messages_reply_to (reply_to_id);
