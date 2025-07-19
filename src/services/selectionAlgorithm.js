const DatabaseQueries = require('../database/queries');

class SelectionAlgorithm {
    constructor(db) {
        this.db = db;
        this.queries = new DatabaseQueries(db);
    }

    // Main selection function with tie detection
    async runSelection() {
        try {
            console.log('🎯 Running selection algorithm...');

            // Get all active players
            const allPlayers = await this.queries.getAllPlayers();
            
            if (allPlayers.length < 4) {
                throw new Error('Not enough active players for selection');
            }

            // Calculate priority scores for all players
            const playersWithScores = [];
            for (const player of allPlayers) {
                const scoreData = await this.queries.calculatePriorityScore(player.discord_id);
                playersWithScores.push({
                    ...player,
                    priorityScore: scoreData.totalScore,
                    scoreBreakdown: scoreData.breakdown
                });
            }

            // Separate locked and unlocked players
            const lockedPlayers = playersWithScores.filter(p => p.locked);
            const unlockedPlayers = playersWithScores.filter(p => !p.locked);

            // Sort unlocked players by priority score (highest first)
            unlockedPlayers.sort((a, b) => {
                if (b.priorityScore !== a.priorityScore) {
                    return b.priorityScore - a.priorityScore;
                }
                // For ties, sort by fewest total games, then by join date
                if (a.total_games_played !== b.total_games_played) {
                    return a.total_games_played - b.total_games_played;
                }
                return new Date(a.join_date) - new Date(b.join_date);
            });

            // Build selected team (4 players)
            const selectedPlayers = [];
            const ties = [];
            
            // Add locked players first (always slot 1)
            for (const lockedPlayer of lockedPlayers) {
                selectedPlayers.push({
                    discord_id: lockedPlayer.discord_id,
                    username: lockedPlayer.username,
                    status: 'locked',
                    priorityScore: lockedPlayer.priorityScore,
                    scoreBreakdown: lockedPlayer.scoreBreakdown
                });
            }

            // Fill remaining slots with highest priority unlocked players
            const slotsNeeded = 4 - selectedPlayers.length;
            let selectedCount = 0;
            
            // Track if we encounter ties during selection
            for (let i = 0; i < unlockedPlayers.length && selectedCount < slotsNeeded; i++) {
                const player = unlockedPlayers[i];
                
                // Check if this player ties with others for the remaining slots
                if (selectedCount === slotsNeeded - 1) {
                    // This is the last slot - check for ties
                    const tiedPlayers = unlockedPlayers.slice(i).filter(p => 
                        p.priorityScore === player.priorityScore
                    );
                    
                    if (tiedPlayers.length > 1) {
                        // We have a tie for the last slot(s)
                        ties.push({
                            position: `slot ${selectedPlayers.length + 1}`,
                            score: player.priorityScore,
                            players: tiedPlayers.map(p => ({
                                discord_id: p.discord_id,
                                username: p.username,
                                priorityScore: p.priorityScore,
                                scoreBreakdown: p.scoreBreakdown
                            }))
                        });
                        
                        // For now, just take the first one (admin can override)
                        selectedPlayers.push({
                            discord_id: player.discord_id,
                            username: player.username,
                            status: 'pending',
                            priorityScore: player.priorityScore,
                            scoreBreakdown: player.scoreBreakdown
                        });
                        selectedCount++;
                        break;
                    }
                }
                
                // No tie, add normally
                selectedPlayers.push({
                    discord_id: player.discord_id,
                    username: player.username,
                    status: 'pending',
                    priorityScore: player.priorityScore,
                    scoreBreakdown: player.scoreBreakdown
                });
                selectedCount++;
            }

            // Remaining players become backup queue
            const backupQueue = [];
            const remainingPlayers = unlockedPlayers.slice(selectedCount);
            for (const player of remainingPlayers) {
                backupQueue.push({
                    discord_id: player.discord_id,
                    username: player.username,
                    status: 'backup',
                    priorityScore: player.priorityScore,
                    scoreBreakdown: player.scoreBreakdown
                });
            }

            const result = {
                selected: selectedPlayers,
                backup: backupQueue,
                ties: ties, // NEW: Include tie information
                timestamp: new Date().toISOString(),
                algorithm_version: '2.0'
            };

            console.log(`✅ Selection complete: ${selectedPlayers.length} selected, ${backupQueue.length} backup`);
            if (ties.length > 0) {
                console.log(`⚠️ Ties detected: ${ties.length} tie(s) require admin review`);
            }
            
            return result;

        } catch (error) {
            console.error('❌ Selection algorithm error:', error);
            throw error;
        }
    }

    // Store pending selection in database
    async storePendingSelection(selectionData) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                ['PENDING_SELECTION', JSON.stringify(selectionData), new Date().toISOString()], 
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Get pending selection from database
    async getPendingSelection() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM bot_config WHERE key = ?', ['PENDING_SELECTION'], (err, row) => {
                if (err) reject(err);
                else resolve(row ? JSON.parse(row.value) : null);
            });
        });
    }

    // Clear pending selection
    async clearPendingSelection() {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM bot_config WHERE key = ?', ['PENDING_SELECTION'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = SelectionAlgorithm;
