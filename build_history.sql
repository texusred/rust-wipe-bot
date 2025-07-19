-- Clear existing data and rebuild with correct history
DELETE FROM player_history;
DELETE FROM players;
DELETE FROM wipe_cycles;
DELETE FROM interest_expressions;

-- Insert players
INSERT INTO players (discord_id, username, locked, total_games_played, active) VALUES
('527196397519241225', 'bulc0', 0, 1, 1),
('396066502433832961', 'dasheepxj', 0, 1, 1),
('649323829902180353', 'drukpor', 0, 2, 1),
('511300149029371943', 'rockst3adii', 1, 3, 1),
('822480016264527892', 'stonedape1825', 0, 1, 1),
('742033517785120819', 'majorhit', 0, 1, 1),
('187950620987097090', 'texusbread', 0, 2, 1),
('999999999999999999', 'datdude81', 0, 1, 1);

-- Create wipe cycles (3 weeks)
INSERT INTO wipe_cycles (cycle_id, start_date, status, created_at) VALUES
(1, '2025-07-05', 'completed', '2025-07-05 18:00:00'),
(2, '2025-07-12', 'completed', '2025-07-12 18:00:00'),
(3, '2025-07-19', 'active', '2025-07-19 18:00:00');

-- Week 1 (July 5) participation - bulc0(a), drukpor(a), rockst3adii(a)
INSERT INTO player_history (player_id, cycle_id, participated, timestamp) VALUES
('527196397519241225', 1, 1, '2025-07-05 19:00:00'),  -- bulc0 played
('649323829902180353', 1, 1, '2025-07-05 19:00:00'),  -- drukpor played  
('511300149029371943', 1, 1, '2025-07-05 19:00:00');  -- rockst3adii played

-- Week 2 (July 12) participation - dasheep(a), rockst3adii(a)
INSERT INTO player_history (player_id, cycle_id, participated, timestamp) VALUES
('396066502433832961', 2, 1, '2025-07-12 19:00:00'),  -- dasheepxj played
('511300149029371943', 2, 1, '2025-07-12 19:00:00');  -- rockst3adii played

-- Week 3 (July 19) selections - rockst3adii, stonedape1825, majorhit, texusbread
UPDATE wipe_cycles SET selected_players = '{"selected":[
{"discord_id":"511300149029371943","username":"rockst3adii","status":"locked"},
{"discord_id":"822480016264527892","username":"stonedape1825","status":"confirmed"},
{"discord_id":"742033517785120819","username":"majorhit","status":"pending"},
{"discord_id":"187950620987097090","username":"texusbread","status":"pending"}
],"backup":[
{"discord_id":"527196397519241225","username":"bulc0","status":"backup"},
{"discord_id":"396066502433832961","username":"dasheepxj","status":"backup"},
{"discord_id":"649323829902180353","username":"drukpor","status":"backup"},
{"discord_id":"999999999999999999","username":"datdude81","status":"backup"}
]}' WHERE cycle_id = 3;

-- Current interest expressions (5 players expressed interest)
INSERT INTO interest_expressions (player_id, cycle_id, expressed_at) VALUES
('742033517785120819', 3, '2025-07-16 23:03:57'),  -- majorhit
('822480016264527892', 3, '2025-07-16 23:03:57'),  -- stonedape1825
('527196397519241225', 3, '2025-07-16 23:03:57'),  -- bulc0
('187950620987097090', 3, '2025-07-16 23:03:57'),  -- texusbread
('396066502433832961', 3, '2025-07-16 23:03:57');  -- dasheepxj
