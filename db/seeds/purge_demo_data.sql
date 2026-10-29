-- Clean Production State Purge Script
-- Removes all synthetic demo accounts, test messages, conversations, and transfers
-- Preserves official Master records (districts, stations, designations, policies) and Super Admin bootstrap user

DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM conversation_members;
DELETE FROM user_message_visibility;
DELETE FROM transfer_requests;
DELETE FROM favorites;
DELETE FROM recent_searches;
DELETE FROM notices;
DELETE FROM notice_recipients;
DELETE FROM sessions WHERE user_id != 'usr_seed_super';
DELETE FROM users WHERE id != 'usr_seed_super';
