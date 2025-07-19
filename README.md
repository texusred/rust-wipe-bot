# Rust Wipe Management Discord Bot

A Discord bot for managing weekly Rust wipe player selection with automated scheduling and priority scoring.

## 🚀 Current Status

**Version:** Production Ready v2.0  
**Status:** ✅ Fully Operational  
**Algorithm:** Balanced Priority Scoring v2.0  

## 📋 Core Features

### ✅ Three-State System
- **Wipe in Progress** (Friday 7PM → Saturday 12PM EST)
- **Pre-Selection** (Saturday 12PM → Monday 5AM EST) 
- **Selection Results** (Monday 5AM → Friday 7PM EST)

### ✅ Priority Scoring Algorithm
- Never played: 50pts, 2 weeks ago: 35pts, 1 week ago: 20pts, This week: 5pts
- Interest bonus: +10pts, No-show penalty: -20pts
- Locked players: 1000pts (guaranteed slot 1)

### ✅ Automated Features
- Monday 5AM EST: Automatic selection with admin approval
- 24-hour auto-approval failsafe
- Manual team selection with modal interface
- No-show penalty tracking

## 🎯 Admin Commands

- `/admin runselection` - Trigger selection process
- `/admin cancelselection` - Cancel pending selections  
- `/admin viewscores` - View player priority scores
- `/admin marknoshow` - Apply no-show penalties
- `/admin lockplayer` / `/admin unlockplayer` - Lock management
- `/admin setstate` / `/admin viewstate` / `/admin resetstate` - State control
- `/admin setchannel` / `/admin setapprovalchannel` - Channel setup
- `/admin addplayer` / `/admin removeplayer` - Player management

## 🎮 User Features

- **Express Interest** - Get +10 priority bonus
- **Confirm Participation** - Confirm your slot
- **Pass Turn** - Give slot to backup player
- **View Stats** - See your priority score and history
- **Skip Next Wipe** - Opt out of selection

## 🔄 Weekly Cycle

1. **Friday 7PM EST** - Wipe starts, limited functionality
2. **Saturday 12PM EST** - Pre-selection period begins
3. **Monday 5AM EST** - Algorithm runs, admin approves
4. **After approval** - Team confirmed, buttons active

## 🚀 Production Setup

- **Systemd service** with auto-restart and boot persistence
- **Git auto-sync** every 30 minutes
- **Resource limits** and proper logging
- **SQLite database** with full audit trail

## 🔧 Management

```bash
./bot-management.sh start/stop/restart/status/logs
./manual-sync.sh "commit message" EOF
cat > README.md << 'EOF'
# Rust Wipe Management Discord Bot

A Discord bot for managing weekly Rust wipe player selection with automated scheduling and priority scoring.

## 🚀 Current Status

**Version:** Production Ready v2.0  
**Status:** ✅ Fully Operational  
**Algorithm:** Balanced Priority Scoring v2.0  

## 📋 Core Features

### ✅ Three-State System
- **Wipe in Progress** (Friday 7PM → Saturday 12PM EST)
- **Pre-Selection** (Saturday 12PM → Monday 5AM EST) 
- **Selection Results** (Monday 5AM → Friday 7PM EST)

### ✅ Priority Scoring Algorithm
- Never played: 50pts, 2 weeks ago: 35pts, 1 week ago: 20pts, This week: 5pts
- Interest bonus: +10pts, No-show penalty: -20pts
- Locked players: 1000pts (guaranteed slot 1)

### ✅ Automated Features
- Monday 5AM EST: Automatic selection with admin approval
- 24-hour auto-approval failsafe
- Manual team selection with modal interface
- No-show penalty tracking

## 🎯 Admin Commands

- `/admin runselection` - Trigger selection process
- `/admin cancelselection` - Cancel pending selections  
- `/admin viewscores` - View player priority scores
- `/admin marknoshow` - Apply no-show penalties
- `/admin lockplayer` / `/admin unlockplayer` - Lock management
- `/admin setstate` / `/admin viewstate` / `/admin resetstate` - State control
- `/admin setchannel` / `/admin setapprovalchannel` - Channel setup
- `/admin addplayer` / `/admin removeplayer` - Player management

## 🎮 User Features

- **Express Interest** - Get +10 priority bonus
- **Confirm Participation** - Confirm your slot
- **Pass Turn** - Give slot to backup player
- **View Stats** - See your priority score and history
- **Skip Next Wipe** - Opt out of selection

## 🔄 Weekly Cycle

1. **Friday 7PM EST** - Wipe starts, limited functionality
2. **Saturday 12PM EST** - Pre-selection period begins
3. **Monday 5AM EST** - Algorithm runs, admin approves
4. **After approval** - Team confirmed, buttons active

## 🚀 Production Setup

- **Systemd service** with auto-restart and boot persistence
- **Git auto-sync** every 30 minutes
- **Resource limits** and proper logging
- **SQLite database** with full audit trail

## 🔧 Management

```bash
./bot-management.sh start/stop/restart/status/logs
./manual-sync.sh "commit message"\
