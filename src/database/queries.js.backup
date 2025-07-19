class DatabaseQueries {
    constructor(db) {
        this.db = db;
    }

    async addPlayer(discordId, username) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO players (discord_id, username)
                VALUES (?, ?)
            `);
            stmt.run([discordId, username], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getAllPlayers() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM players WHERE active = 1
                ORDER BY username
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getCurrentCycle() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM wipe_cycles
                WHERE status = 'active'
                ORDER BY cycle_id DESC LIMIT 1
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async getNextCycle() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM wipe_cycles
                WHERE status = 'upcoming'
                ORDER BY cycle_id DESC LIMIT 1
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async createNewCycle(startDate, endDate, status = 'upcoming') {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO wipe_cycles (start_date, end_date, status)
                VALUES (?, ?, ?)
            `);
            stmt.run([startDate, endDate, status], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async advanceCycles() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`UPDATE wipe_cycles SET status = 'completed' WHERE status = 'active'`);
                this.db.run(`UPDATE wipe_cycles SET status = 'active' WHERE status = 'upcoming'`);
                this.db.run(`DELETE FROM interest_expressions`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async expressInterest(playerId) {
        return new Promise((resolve, reject) => {
            this.getCurrentCycle().then(currentCycle => {
                if (!currentCycle) {
                    reject(new Error('No active cycle found'));
                    return;
                }

                this.db.get(`
                    SELECT id FROM interest_expressions WHERE player_id = ? AND cycle_id = ?
                `, [playerId, currentCycle.cycle_id], (err, row) => {
                    if (err) reject(err);
                    else if (row) {
                        reject(new Error('Interest already expressed for this cycle'));
                    } else {
                        const stmt = this.db.prepare(`
                            INSERT INTO interest_expressions (player_id, cycle_id)
                            VALUES (?, ?)
                        `);
                        stmt.run([playerId, currentCycle.cycle_id], function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        });
                    }
                });
            }).catch(reject);
        });
    }

    async hasExpressedInterest(playerId) {
        return new Promise((resolve, reject) => {
            this.getCurrentCycle().then(currentCycle => {
                if (!currentCycle) {
                    resolve(false);
                    return;
                }

                this.db.get(`
                    SELECT id FROM interest_expressions WHERE player_id = ? AND cycle_id = ?
                `, [playerId, currentCycle.cycle_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                });
            }).catch(reject);
        });
    }

    async getInterestedPlayers() {
        return new Promise((resolve, reject) => {
            this.getCurrentCycle().then(currentCycle => {
                if (!currentCycle) {
                    resolve([]);
                    return;
                }

                this.db.all(`
                    SELECT p.discord_id, p.username
                    FROM players p
                    JOIN interest_expressions ie ON p.discord_id = ie.player_id
                    WHERE ie.cycle_id = ?
                `, [currentCycle.cycle_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }).catch(reject);
        });
    }

    async updateCycleSelection(cycleId, selectedPlayers) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE wipe_cycles
                SET selected_players = ?
                WHERE cycle_id = ?
            `);
            stmt.run([JSON.stringify(selectedPlayers), cycleId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getPlayerHistory(playerId, weeksBack = 6) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT wc.start_date, ph.participated
                FROM player_history ph
                JOIN wipe_cycles wc ON ph.cycle_id = wc.cycle_id
                WHERE ph.player_id = ? AND wc.start_date >= date('now', '-${weeksBack} weeks')
                ORDER BY wc.start_date DESC
            `, [playerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // SIMPLE WORKING PRIORITY SCORING - FIXED SQL
    async calculatePriorityScore(playerId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM players WHERE discord_id = ?', [playerId], (err, player) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!player) {
                    resolve({ totalScore: 0, breakdown: 'Player not found' });
                    return;
                }

                // If locked, always priority 1
                if (player.locked) {
                    resolve({
                        totalScore: 1000,
                        breakdown: { locked: true, baseScore: 1000 }
                    });
                    return;
                }

                // Get when they last actually played (not no-show) - FIXED SQL
                this.db.get(`
                    SELECT julianday('now') - julianday(wc.start_date) as days_ago
                    FROM player_history ph
                    JOIN wipe_cycles wc ON ph.cycle_id = wc.cycle_id
                    WHERE ph.player_id = ? AND ph.participated = 1
                    ORDER BY wc.start_date DESC LIMIT 1
                `, [playerId], (err, lastPlayed) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Calculate base score
                    let baseScore;
                    let weeksAgo;
                    
                    if (!lastPlayed) {
                        // Never played
                        baseScore = 50;
                        weeksAgo = 99;
                    } else {
                        weeksAgo = Math.floor(lastPlayed.days_ago / 7);
                        if (weeksAgo === 0) baseScore = 5;       // This week
                        else if (weeksAgo === 1) baseScore = 20; // 1 week ago  
                        else if (weeksAgo === 2) baseScore = 35; // 2 weeks ago
                        else baseScore = 50;                     // 3+ weeks ago
                    }

                    // Check interest
                    this.hasExpressedInterest(playerId).then(hasInterest => {
                        const interestBonus = hasInterest ? 10 : 0;

                        // Check no-show - FIXED SQL
                        this.db.get(`
                            SELECT COUNT(*) as count
                            FROM player_history ph
                            JOIN wipe_cycles wc ON ph.cycle_id = wc.cycle_id
                            WHERE ph.player_id = ? AND ph.no_show = 1 
                            AND julianday('now') - julianday(wc.start_date) <= 21
                        `, [playerId], (err, noShowResult) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const hasNoShow = noShowResult && noShowResult.count > 0;
                            const noShowPenalty = hasNoShow ? 20 : 0;

                            const totalScore = Math.max(0, baseScore + interestBonus - noShowPenalty);

                            resolve({
                                totalScore,
                                breakdown: {
                                    baseScore,
                                    interestBonus,
                                    noShowPenalty,
                                    weeksAgo,
                                    hasInterest,
                                    hasNoShow,
                                    locked: false
                                }
                            });
                        });
                    }).catch(reject);
                });
            });
        });
    }
}

module.exports = DatabaseQueries;
