-- Clear and rebuild with rockst3adii playing all weeks (as locked player should)
DELETE FROM player_history;

-- Week 1 (July 5): rockst3adii(a), bulc0(a), drukpor(a), texusbread(a)
INSERT INTO player_history (player_id, cycle_id, participated, timestamp) VALUES
('511300149029371943', 1, 1, '2025-07-05 19:00:00'),  -- rockst3adii played (locked)
('527196397519241225', 1, 1, '2025-07-05 19:00:00'),  -- bulc0 played
('649323829902180353', 1, 1, '2025-07-05 19:00:00'),  -- drukpor played
('187950620987097090', 1, 1, '2025-07-05 19:00:00');  -- texusbread played

-- Week 2 (July 12): rockst3adii(a), dasheep(a), drukpor(a), datdude81(a)
INSERT INTO player_history (player_id, cycle_id, participated, timestamp) VALUES
('511300149029371943', 2, 1, '2025-07-12 19:00:00'),  -- rockst3adii played (locked)
('396066502433832961', 2, 1, '2025-07-12 19:00:00'),  -- dasheepxj played
('649323829902180353', 2, 1, '2025-07-12 19:00:00'),  -- drukpor played
('432367475074793472', 2, 1, '2025-07-12 19:00:00');  -- datdude81 played

-- Week 3 (July 19): rockst3adii(a), stonedape1825(a), majorhit(no-show), texusbread(a)
INSERT INTO player_history (player_id, cycle_id, participated, timestamp) VALUES
('511300149029371943', 3, 1, '2025-07-19 19:00:00'),  -- rockst3adii played (locked)
('822480016264527892', 3, 1, '2025-07-19 19:00:00'),  -- stonedape1825 played
('742033517785120819', 3, 0, '2025-07-19 19:00:00'),  -- majorhit no-show
('187950620987097090', 3, 1, '2025-07-19 19:00:00');  -- texusbread played

-- Mark majorhit's no-show
UPDATE player_history SET no_show = 1 WHERE player_id = '742033517785120819' AND cycle_id = 3;

-- Update total games played correctly
UPDATE players SET total_games_played = 3 WHERE discord_id = '511300149029371943';  -- rockst3adii: 3 games (locked, plays every week)
UPDATE players SET total_games_played = 2 WHERE discord_id IN (
    '649323829902180353',  -- drukpor: 2 games (week 1, 2)
    '187950620987097090'   -- texusbread: 2 games (week 1, 3)
);
UPDATE players SET total_games_played = 1 WHERE discord_id IN (
    '527196397519241225',  -- bulc0: 1 game (week 1)
    '396066502433832961',  -- dasheepxj: 1 game (week 2)
    '822480016264527892',  -- stonedape1825: 1 game (week 3)
    '432367475074793472'   -- datdude81: 1 game (week 2)
);
UPDATE players SET total_games_played = 0 WHERE discord_id = '742033517785120819';  -- majorhit: 0 games (no-show)
