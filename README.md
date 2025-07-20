# Rust Wipe Management Discord Bot

A Discord bot for managing weekly Rust wipe player selection with automated scheduling and priority scoring.

## Current Status

**Version:** Production Ready v2.1  
**Status:** Mostly Functional  
**Algorithm:** Balanced Priority Scoring v2.1 (Fixed!)  

## File Directory
cd /mnt/backup-drive/rust-wipe-bot

## Server Management
# Start the bot
./bot-management.sh start

# Stop the bot  
./bot-management.sh stop

# Restart the bot
./bot-management.sh restart

# Check status
./bot-management.sh status

# View live logs
./bot-management.sh logs

## Core Features

### Working Features
- Three-State System (Wipe in Progress → Pre-Selection → Selection Results)
- Priority Scoring Algorithm (Fixed - scores now accurate)
- Admin Status Board (Updates every 5 minutes)
- Skip Next Wipe functionality (working correctly)
- View My Stats (cleaned up, no confusing priority scores)
- Selection Algorithm with skip player exclusion
- Manual Selection Modal (working)
- Tie-Breaking Support (shows ties in approval)

### Known Issues
- /admin updateembed command not working
- /admin setchannel command not working  
- Persistent embed updates have JavaScript errors
- Confirm deadline now correct (3 days) but embed updates fail

## Admin Commands

### Working Commands
- /admin runselection - Trigger selection process (sends to approval)
- /admin viewscores - View player priority scores  
- /admin setadminboard - Set admin status board channel
- /admin lockplayer / /admin unlockplayer - Lock management
- /admin addplayer / /admin removeplayer - Player management

### Broken Commands  
- /admin updateembed - Fails with method errors
- /admin setchannel - Fails with method errors

## User Features
- Express Interest - Get +10 priority bonus
- Skip Next Wipe - Opt out of selection (working!)
- View My Stats - See history and status (cleaned up)
- Confirm Participation - Confirm your slot
- Pass Turn - Give slot to backup player

## Current Scoring (All Correct!)
1. rockst3adii - 1000 pts (locked)
2. bulc0 - 45 pts (35 base + 10 interest) FIXED
3. DaSheep - 30 pts (20 base + 10 interest)
4. datdude81 - 20 pts (20 base, no interest)
5. Dr DRE - 20 pts (20 base, no interest) 
6. Stoned Ape - 15 pts (5 base + 10 interest)
7. Texas - 15 pts (5 base + 10 interest)
8. Major Hit - 0 pts (no-show penalty working) FIXED

## Recent Fixes Applied
- Fixed bulc0 scoring from 5pts to 45pts
- Fixed Major Hit penalty (now 0pts for no-show)
- Added skip_next_wipe functionality 
- Fixed selection algorithm to exclude skip players
- Cleaned up View My Stats (removed confusing priority scores)
- Fixed confirm deadline calculation (now 3 days, not 9)
- Admin status board working with 5-minute updates

## Issues for Next Session
- Persistent embed manager has JavaScript errors
- Commands updateembed/setchannel broken due to method references
- Need to fix embed building and persistent updates
