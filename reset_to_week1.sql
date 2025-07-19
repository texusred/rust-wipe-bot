-- Clear all existing cycle and history data
DELETE FROM wipe_cycles;
DELETE FROM player_history;
DELETE FROM interest_expressions;
DELETE FROM bot_config WHERE key IN ('PENDING_SELECTION', 'SELECTION_TIMEOUT', 'APPROVAL_MESSAGE_ID');

-- Reset players (keep existing but reset games played)
UPDATE players SET total_games_played = 0;

-- Create Week 1 cycle starting this Friday (July 19, 2025)
INSERT INTO wipe_cycles (cycle_id, start_date, status, created_at) VALUES
(1, '2025-07-19', 'active', '2025-07-19 00:00:00');

-- Reset state to Selection Results (State 3) since we're starting fresh
INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES
('EMBED_STATE', '3', datetime('now'));

-- Clear any existing selection data for clean start
UPDATE wipe_cycles SET selected_players = NULL WHERE cycle_id = 1;
