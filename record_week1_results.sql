-- Record Week 1 participation in player_history
INSERT INTO player_history (player_id, cycle_id, participated, timestamp) VALUES
('511300149029371943', 1, 1, '2025-07-19 19:00:00'),  -- rockst3adii played
('822480016264527892', 1, 1, '2025-07-19 19:00:00'),  -- stonedape1825 played  
('187950620987097090', 1, 1, '2025-07-19 19:00:00'),  -- texusbread played
('742033517785120819', 1, 0, '2025-07-19 19:00:00');  -- majorhit no-show

-- Update total games played
UPDATE players SET total_games_played = 1 WHERE discord_id IN (
    '511300149029371943',  -- rockst3adii
    '822480016264527892',  -- stonedape1825  
    '187950620987097090'   -- texusbread
);

-- Mark Week 1 as completed and create Week 2
UPDATE wipe_cycles SET status = 'completed' WHERE cycle_id = 1;
INSERT INTO wipe_cycles (cycle_id, start_date, status, created_at) VALUES
(2, '2025-07-26', 'active', '2025-07-19 19:30:00');

-- Add no_show column to player_history if it doesn't exist
ALTER TABLE player_history ADD COLUMN no_show BOOLEAN DEFAULT 0;

-- Mark majorhit as no-show
UPDATE player_history SET no_show = 1 WHERE player_id = '742033517785120819' AND cycle_id = 1;
