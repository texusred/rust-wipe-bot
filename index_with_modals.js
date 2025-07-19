require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const Database = require('./src/database/database');
const { loadCommands, registerCommands } = require('./src/utils/commandHandler');
const buttonHandler = require('./src/interactions/buttons');
const modalHandler = require('./src/interactions/modals');
const WipeScheduler = require('./src/services/scheduler');
const PersistentEmbedManager = require('./src/services/persistentEmbed');
const StateManager = require('./src/services/stateManager');
const ApprovalManager = require('./src/services/approvalManager');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
const db = new Database();

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    await db.initialize();
    client.db = db.db;
    await loadCommands(client);
    await registerCommands(client);

    // Initialize state manager FIRST
    client.stateManager = new StateManager(client);
    await client.stateManager.initialize();

    // Initialize approval manager
    client.approvalManager = new ApprovalManager(client);

    // Initialize persistent embed manager (now state-aware)
    client.persistentEmbed = new PersistentEmbedManager(client);
    await client.persistentEmbed.initialize();

    // Initialize scheduler
    const scheduler = new WipeScheduler(client);
    scheduler.start();

    console.log('🚀 Bot fully initialized');
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Command error:', error);

            const errorMessage = { content: 'Error executing command!', ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                try {
                    await interaction.followUp(errorMessage);
                } catch (followUpError) {
                    console.error('Follow-up error:', followUpError);
                }
            } else {
                try {
                    await interaction.reply(errorMessage);
                } catch (replyError) {
                    console.error('Reply error:', replyError);
                }
            }
        }
    }

    if (interaction.isButton()) {
        try {
            // Handle approval buttons
            if (['approve_selection', 'regenerate_selection', 'manual_edit_selection'].includes(interaction.customId)) {
                await client.approvalManager.handleApprovalButton(interaction);
                return;
            }

            // Handle regular buttons
            switch (interaction.customId) {
                case 'express_interest':
                    await buttonHandler.handleExpressInterest(interaction);
                    if (client.persistentEmbed) {
                        await client.persistentEmbed.forceUpdate();
                    }
                    break;
                case 'not_interested_next':
                    await buttonHandler.handleNotInterestedNext(interaction);
                    if (client.persistentEmbed) {
                        await client.persistentEmbed.forceUpdate();
                    }
                    break;
                case 'view_stats':
                    await buttonHandler.handleViewStats(interaction);
                    break;
                case 'view_schedule':
                    await buttonHandler.handleViewSchedule(interaction);
                    break;
                case 'confirm_participation':
                    await buttonHandler.handleConfirmParticipation(interaction);
                    if (client.persistentEmbed) {
                        await client.persistentEmbed.forceUpdate();
                    }
                    break;
                case 'pass_turn':
                    await buttonHandler.handlePassTurn(interaction);
                    if (client.persistentEmbed) {
                        await client.persistentEmbed.forceUpdate();
                    }
                    break;
            }
        } catch (error) {
            console.error('Button interaction error:', error);

            const errorMessage = { content: 'Error handling button!', ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                try {
                    await interaction.followUp(errorMessage);
                } catch (followUpError) {
                    console.error('Follow-up error:', followUpError);
                }
            } else {
                try {
                    await interaction.reply(errorMessage);
                } catch (replyError) {
                    console.error('Reply error:', replyError);
                }
            }
        }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        try {
            switch (interaction.customId) {
                case 'manual_selection_modal':
                    await modalHandler.handleManualSelectionModal(interaction);
                    break;
            }
        } catch (error) {
            console.error('Modal interaction error:', error);
            
            const errorMessage = { content: 'Error handling form submission!', ephemeral: true };
            
            if (!interaction.replied) {
                try {
                    await interaction.reply(errorMessage);
                } catch (replyError) {
                    console.error('Reply error:', replyError);
                }
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
