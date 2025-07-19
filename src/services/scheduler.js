const cron = require('node-cron');

class WipeScheduler {
    constructor(client) {
        this.client = client;
        this.jobs = [];
    }

    start() {
        console.log('📅 Starting wipe scheduler...');

        // Monday 5AM EST (10AM UTC) - Run selection algorithm
        const mondaySelectionJob = cron.schedule('0 10 * * 1', async () => {
            console.log('🎯 Monday 5AM EST - Running automatic selection...');
            try {
                await this.client.approvalManager.runSelectionForApproval();
                console.log('✅ Monday selection completed and sent for approval');
            } catch (error) {
                console.error('❌ Error running Monday selection:', error);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        // Friday 7PM EST (12AM UTC Saturday) - State transition to Wipe in Progress
        const fridayWipeJob = cron.schedule('0 0 * * 6', async () => {
            console.log('🔥 Friday 7PM EST - Wipe starting, transitioning to State 1...');
            try {
                await this.client.stateManager.forceState(1, 'Automatic Friday wipe start');
                console.log('✅ Transitioned to Wipe in Progress state');
            } catch (error) {
                console.error('❌ Error transitioning to wipe state:', error);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        // Saturday 12PM EST (5PM UTC) - State transition to Pre-Selection
        const saturdayPreSelectionJob = cron.schedule('0 17 * * 6', async () => {
            console.log('🎯 Saturday 12PM EST - Starting pre-selection period, transitioning to State 2...');
            try {
                await this.client.stateManager.forceState(2, 'Automatic Saturday pre-selection start');
                console.log('✅ Transitioned to Pre-Selection state');
            } catch (error) {
                console.error('❌ Error transitioning to pre-selection state:', error);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        // Check for auto-approval every hour
        const autoApprovalCheckJob = cron.schedule('0 * * * *', async () => {
            try {
                await this.client.approvalManager.checkAutoApproval();
            } catch (error) {
                console.error('❌ Error checking auto-approval:', error);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        // Start all jobs
        mondaySelectionJob.start();
        fridayWipeJob.start();
        saturdayPreSelectionJob.start();
        autoApprovalCheckJob.start();

        this.jobs = [mondaySelectionJob, fridayWipeJob, saturdayPreSelectionJob, autoApprovalCheckJob];

        console.log('✅ Scheduler jobs started:');
        console.log('  - Monday 5AM EST: Automatic selection');
        console.log('  - Friday 7PM EST: Wipe start (State 1)');
        console.log('  - Saturday 12PM EST: Pre-selection (State 2)');
        console.log('  - Hourly: Auto-approval check');
    }

    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('⏹️ Scheduler stopped');
    }
}

module.exports = WipeScheduler;
