const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '../../database.db');
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = `
            CREATE TABLE IF NOT EXISTS players (
                discord_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                join_date DATE DEFAULT CURRENT_DATE,
                total_games_played INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS wipe_cycles (
                cycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_date DATE NOT NULL,
                end_date DATE,
                status TEXT DEFAULT 'upcoming',
                selected_players TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS player_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id TEXT,
                cycle_id INTEGER,
                participated BOOLEAN DEFAULT 0,
                confirmed BOOLEAN DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players (discord_id),
                FOREIGN KEY (cycle_id) REFERENCES wipe_cycles (cycle_id)
            );

            CREATE TABLE IF NOT EXISTS interest_expressions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id TEXT,
                expressed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players (discord_id),
                UNIQUE(player_id)
            );
        `;

        return new Promise((resolve, reject) => {
            this.db.exec(tables, (err) => {
                if (err) reject(err);
                else {
                    console.log('Database tables created');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;
