class StateManager {
    constructor(client) {
        this.client = client;
        this.db = client.db;
        
        // State definitions
        this.STATES = {
            WIPE_IN_PROGRESS: 1,    // Friday 7PM → Saturday 12PM EST
            PRE_SELECTION: 2,       // Saturday 12PM → Monday 5AM EST  
            SELECTION_RESULTS: 3    // Monday 5AM → Friday 7PM EST
        };
        
        this.STATE_NAMES = {
            1: 'Wipe in Progress',
            2: 'Pre-Selection', 
            3: 'Selection Results'
        };
    }

    // Get current state from database
    async getCurrentState() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM bot_config WHERE key = ?', ['EMBED_STATE'], (err, row) => {
                if (err) reject(err);
                else resolve(row ? parseInt(row.value) : this.STATES.SELECTION_RESULTS);
            });
        });
    }

    // Set state in database
    async setState(newState, reason = '') {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString();
            
            this.db.serialize(() => {
                // Update state
                this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                    ['EMBED_STATE', newState.toString(), timestamp]);
                
                // Store state change time
                this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                    ['STATE_CHANGE_TIME', timestamp, timestamp]);
                    
                // Store reason if provided
                if (reason) {
                    this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                        ['STATE_CHANGE_REASON', reason, timestamp]);
                }
                
                console.log(`🔄 State changed to ${this.STATE_NAMES[newState]} (${newState}) - ${reason}`);
                resolve();
            });
        });
    }

    // Calculate what state we SHOULD be in based on current time
    calculateCorrectState() {
        const now = new Date();
        const estNow = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        const dayOfWeek = estNow.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
        const hour = estNow.getHours();
        
        // Friday 7PM EST → Saturday 12PM EST = WIPE_IN_PROGRESS
        if ((dayOfWeek === 5 && hour >= 19) || (dayOfWeek === 6 && hour < 12)) {
            return this.STATES.WIPE_IN_PROGRESS;
        }
        
        // Saturday 12PM EST → Monday 5AM EST = PRE_SELECTION
        if ((dayOfWeek === 6 && hour >= 12) || dayOfWeek === 0 || (dayOfWeek === 1 && hour < 5)) {
            return this.STATES.PRE_SELECTION;
        }
        
        // Monday 5AM EST → Friday 7PM EST = SELECTION_RESULTS
        return this.STATES.SELECTION_RESULTS;
    }

    // Check if state needs to be updated and do it
    // Check if there is an approved selection (no pending selection = approved)
    async hasApprovedSelection() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM bot_config WHERE key = ?', ['PENDING_SELECTION'], (err, row) => {
                if (err) reject(err);
                else {
                    // If no pending selection, and we have a current cycle with selected players, it's approved
                    if (!row) {
                        this.db.get('SELECT selected_players FROM wipe_cycles WHERE status = "active" ORDER BY cycle_id DESC LIMIT 1', (err2, cycle) => {
                            if (err2) reject(err2);
                            else resolve(cycle && cycle.selected_players);
                        });
                    } else {
                        resolve(false); // Has pending selection = not approved yet
                    }
                }
            });
        });
    }


    async checkAndUpdateState() {
        try {
            const currentState = await this.getCurrentState();
            const correctState = this.calculateCorrectState();
            
            // Check if there is an approved selection for current cycle
            const hasApprovedSelection = await this.hasApprovedSelection();
            
            // If we have an approved selection, stay in State 3 until next Friday
            if (hasApprovedSelection && correctState !== this.STATES.WIPE_IN_PROGRESS) {
                return false; // Don't change state - keep showing approved selection
            }
            
            if (currentState !== correctState) {
                await this.setState(correctState, 'Automatic state transition based on schedule');
                
                // Force update persistent embed after state change
                if (this.client.persistentEmbed) {
                    await this.client.persistentEmbed.forceUpdate();
                }
                
                return true; // State was changed
            }
            
            return false; // No change needed
        } catch (error) {
            console.error('Error checking/updating state:', error);
            return false;
        }
    }

    // Get next state transition time
    getNextTransitionTime() {
        const now = new Date();
        const estNow = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        const currentState = this.calculateCorrectState();
        
        // Calculate next transition based on current state
        let nextTransition = new Date(estNow);
        
        if (currentState === this.STATES.WIPE_IN_PROGRESS) {
            // Next: Saturday 12PM EST
            const daysUntilSaturday = (6 - estNow.getDay() + 7) % 7;
            if (daysUntilSaturday === 0 && estNow.getHours() >= 12) {
                // Already Saturday after 12PM, so next Saturday
                nextTransition.setDate(estNow.getDate() + 7);
            } else {
                nextTransition.setDate(estNow.getDate() + daysUntilSaturday);
            }
            nextTransition.setHours(12, 0, 0, 0);
            
        } else if (currentState === this.STATES.PRE_SELECTION) {
            // Next: Monday 5AM EST
            const daysUntilMonday = (1 - estNow.getDay() + 7) % 7;
            if (daysUntilMonday === 0 && estNow.getHours() >= 5) {
                // Already Monday after 5AM, so next Monday
                nextTransition.setDate(estNow.getDate() + 7);
            } else {
                nextTransition.setDate(estNow.getDate() + daysUntilMonday);
            }
            nextTransition.setHours(5, 0, 0, 0);
            
        } else { // SELECTION_RESULTS
            // Next: Friday 7PM EST
            const daysUntilFriday = (5 - estNow.getDay() + 7) % 7;
            if (daysUntilFriday === 0 && estNow.getHours() >= 19) {
                // Already Friday after 7PM, so next Friday
                nextTransition.setDate(estNow.getDate() + 7);
            } else {
                nextTransition.setDate(estNow.getDate() + daysUntilFriday);
            }
            nextTransition.setHours(19, 0, 0, 0);
        }
        
        // Convert back to UTC for storage/display
        return new Date(nextTransition.toLocaleString("en-US", {timeZone: "UTC"}));
    }

    // Initialize state management (called on bot startup)
    async initialize() {
        try {
            console.log('🔄 Initializing State Manager...');
            
            // Check if we need to update state based on current time
            const stateChanged = await this.checkAndUpdateState();
            
            const currentState = await this.getCurrentState();
            const nextTransition = this.getNextTransitionTime();
            
            console.log(`📊 Current State: ${this.STATE_NAMES[currentState]} (${currentState})`);
            console.log(`⏰ Next Transition: ${nextTransition.toLocaleString()}`);
            
            if (stateChanged) {
                console.log('✅ State was automatically updated on startup');
            }
            
            // Set up periodic state checking (every 5 minutes)
            this.startPeriodicStateCheck();
            
        } catch (error) {
            console.error('❌ Error initializing State Manager:', error);
        }
    }

    // Start periodic state checking
    startPeriodicStateCheck() {
        // Check state every 5 minutes
        setInterval(async () => {
            await this.checkAndUpdateState();
        }, 5 * 60 * 1000);
        
        console.log('⏱️ Periodic state checking started (every 5 minutes)');
    }

    // Manual state override (for admin commands)
    async forceState(newState, reason = 'Manual override') {
        if (!Object.values(this.STATES).includes(newState)) {
            throw new Error(`Invalid state: ${newState}`);
        }
        
        await this.setState(newState, reason);
        
        // Force update persistent embed
        if (this.client.persistentEmbed) {
            await this.client.persistentEmbed.forceUpdate();
        }
    }
}

module.exports = StateManager;
