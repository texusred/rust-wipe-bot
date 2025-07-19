const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const SelectionAlgorithm = require('./selectionAlgorithm');
const DatabaseQueries = require('../database/queries');

class ApprovalManager {
   constructor(client) {
       this.client = client;
       this.db = client.db;
       this.algorithm = new SelectionAlgorithm(this.db);
   }

   async getApprovalChannelId() {
       return new Promise((resolve, reject) => {
           this.db.get('SELECT value FROM bot_config WHERE key = ?', ['APPROVAL_CHANNEL_ID'], (err, row) => {
               if (err) reject(err);
               else resolve(row ? row.value : null);
           });
       });
   }

   async setApprovalChannelId(channelId) {
       return new Promise((resolve, reject) => {
           this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
               ['APPROVAL_CHANNEL_ID', channelId, new Date().toISOString()], 
               function(err) {
                   if (err) reject(err);
                   else resolve();
               }
           );
       });
   }

   async runSelectionForApproval() {
       try {
           console.log('🎯 Running Monday selection for approval...');

           const selectionData = await this.algorithm.runSelection();
           await this.algorithm.storePendingSelection(selectionData);

           const timeoutTime = new Date();
           timeoutTime.setHours(timeoutTime.getHours() + 24);
           await this.setSelectionTimeout(timeoutTime.toISOString());

           await this.sendApprovalRequest(selectionData);

           console.log('✅ Selection sent for admin approval');
           return selectionData;

       } catch (error) {
           console.error('❌ Error running selection for approval:', error);
           throw error;
       }
   }

   async sendApprovalRequest(selectionData) {
       const channelId = await this.getApprovalChannelId();
       if (!channelId) {
           console.error('❌ No approval channel set');
           return;
       }

       try {
           const channel = await this.client.channels.fetch(channelId);
           if (!channel) {
               console.error('❌ Approval channel not found');
               return;
           }

           const embed = await this.buildApprovalEmbed(selectionData);
           const buttons = this.buildApprovalButtons();

           const message = await channel.send({ embeds: [embed], components: [buttons] });
           await this.setApprovalMessageId(message.id);

           console.log(`📤 Approval request sent to ${channel.name}`);

       } catch (error) {
           console.error('❌ Error sending approval request:', error);
       }
   }

   // UPDATED: Build approval embed with tie detection
   async buildApprovalEmbed(selectionData) {
       const selectedText = selectionData.selected.map((p, i) => {
           const emoji = p.status === 'locked' ? '🔒' : '⏳';
           return `${i + 1}. ${emoji} **${p.username}** (${p.priorityScore} pts)`;
       }).join('\n');

       const backupText = selectionData.backup.slice(0, 5).map((p, i) => {
           return `${i + 1}. 🔄 **${p.username}** (${p.priorityScore} pts)`;
       }).join('\n');

       const scoresText = [...selectionData.selected, ...selectionData.backup.slice(0, 3)]
           .map(p => `**${p.username}**: ${p.priorityScore} pts`)
           .join(' • ');

       const timeoutTime = await this.getSelectionTimeout();
       const timeoutTimestamp = timeoutTime ? Math.floor(new Date(timeoutTime).getTime() / 1000) : null;

       const algorithmType = selectionData.algorithm_version === 'manual' ? 
           `✏️ Manual Override by ${selectionData.admin_override}` : 
           `🤖 Algorithm v${selectionData.algorithm_version}`;

       const embed = new EmbedBuilder()
           .setTitle('🎯 WEEKLY SELECTION - ADMIN APPROVAL REQUIRED')
           .setDescription(`${algorithmType}`)
           .addFields(
               {
                   name: '✅ SELECTED TEAM (4 players)',
                   value: selectedText || 'No players selected',
                   inline: false
               },
               {
                   name: '🔄 BACKUP QUEUE (Top 5)',
                   value: backupText || 'No backup players',
                   inline: false
               },
               {
                   name: '📊 Priority Scores',
                   value: scoresText,
                   inline: false
               }
           );

       // NEW: Add tie information if present
       if (selectionData.ties && selectionData.ties.length > 0) {
           const tieText = selectionData.ties.map(tie => {
               const playerList = tie.players.map(p => `**${p.username}** (${p.priorityScore} pts)`).join(', ');
               return `${tie.position}: ${playerList}`;
           }).join('\n');
           
           embed.addFields({
               name: '⚠️ TIES DETECTED - ADMIN REVIEW REQUIRED',
               value: tieText,
               inline: false
           });
           
           embed.setColor(0xE67E22); // Orange for ties requiring attention
       } else {
           embed.setColor(0xF39C12); // Standard orange for normal approval
       }

       embed.addFields(
           {
               name: '⏰ Auto-Approval',
               value: timeoutTimestamp ? `<t:${timeoutTimestamp}:R>` : 'Not set',
               inline: true
           },
           {
               name: '📅 Generated',
               value: `<t:${Math.floor(new Date(selectionData.timestamp).getTime() / 1000)}:F>`,
               inline: true
           }
       );

       embed.setTimestamp();
       return embed;
   }

   buildApprovalButtons() {
       return new ActionRowBuilder()
           .addComponents(
               new ButtonBuilder()
                   .setCustomId('approve_selection')
                   .setLabel('✅ Approve')
                   .setStyle(ButtonStyle.Success),
               new ButtonBuilder()
                   .setCustomId('regenerate_selection')
                   .setLabel('🔄 Regenerate')
                   .setStyle(ButtonStyle.Secondary),
               new ButtonBuilder()
                   .setCustomId('manual_edit_selection')
                   .setLabel('✏️ Manual Edit')
                   .setStyle(ButtonStyle.Primary)
           );
   }

   async handleApprovalButton(interaction) {
       const { customId } = interaction;

       try {
           switch (customId) {
               case 'approve_selection':
                   await this.approveSelection(interaction);
                   break;
               case 'regenerate_selection':
                   await this.regenerateSelection(interaction);
                   break;
               case 'manual_edit_selection':
                   await this.showManualEditModal(interaction);
                   break;
           }
       } catch (error) {
           console.error('❌ Error handling approval button:', error);
           await interaction.reply({
               content: '❌ Error processing request. Please try again.',
               ephemeral: true
           });
       }
   }

   async showManualEditModal(interaction) {
       try {
           const pendingSelection = await this.algorithm.getPendingSelection();
           let currentSelected = [];
           let currentBackup = [];
           
           if (pendingSelection) {
               currentSelected = pendingSelection.selected || [];
               currentBackup = pendingSelection.backup || [];
           }
           
           const modal = new ModalBuilder()
               .setCustomId('manual_selection_modal')
               .setTitle('Manual Team Selection');
           
           const slot1Input = new TextInputBuilder()
               .setCustomId('slot1')
               .setLabel('Slot 1 Player (username or Discord ID)')
               .setStyle(TextInputStyle.Short)
               .setPlaceholder('Enter player username or Discord ID')
               .setRequired(true)
               .setValue(currentSelected[0]?.username || '');
               
           const slot2Input = new TextInputBuilder()
               .setCustomId('slot2')
               .setLabel('Slot 2 Player')
               .setStyle(TextInputStyle.Short)
               .setPlaceholder('Enter player username or Discord ID')
               .setRequired(true)
               .setValue(currentSelected[1]?.username || '');
               
           const slot3Input = new TextInputBuilder()
               .setCustomId('slot3')
               .setLabel('Slot 3 Player')
               .setStyle(TextInputStyle.Short)
               .setPlaceholder('Enter player username or Discord ID')
               .setRequired(true)
               .setValue(currentSelected[2]?.username || '');
               
           const slot4Input = new TextInputBuilder()
               .setCustomId('slot4')
               .setLabel('Slot 4 Player')
               .setStyle(TextInputStyle.Short)
               .setPlaceholder('Enter player username or Discord ID')
               .setRequired(true)
               .setValue(currentSelected[3]?.username || '');
               
           const backupInput = new TextInputBuilder()
               .setCustomId('backup')
               .setLabel('Backup Queue (comma separated)')
               .setStyle(TextInputStyle.Paragraph)
               .setPlaceholder('player1, player2, player3...')
               .setRequired(false)
               .setValue(currentBackup.map(p => p.username).join(', '));
           
           const row1 = new ActionRowBuilder().addComponents(slot1Input);
           const row2 = new ActionRowBuilder().addComponents(slot2Input);
           const row3 = new ActionRowBuilder().addComponents(slot3Input);
           const row4 = new ActionRowBuilder().addComponents(slot4Input);
           const row5 = new ActionRowBuilder().addComponents(backupInput);
           
           modal.addComponents(row1, row2, row3, row4, row5);
           
           await interaction.showModal(modal);
           
       } catch (error) {
           console.error('Error showing manual edit modal:', error);
           await interaction.reply({
               content: '❌ Error opening manual edit form.',
               ephemeral: true
           });
       }
   }

   async approveSelection(interaction) {
       await interaction.deferReply({ ephemeral: true });

       const pendingSelection = await this.algorithm.getPendingSelection();
       if (!pendingSelection) {
           return await interaction.editReply({
               content: '❌ No pending selection found.'
           });
       }

       await this.applySelection(pendingSelection);
       await this.algorithm.clearPendingSelection();
       await this.clearSelectionTimeout();
       await this.client.stateManager.forceState(3, `Selection approved by ${interaction.user.username}`);

       const approvedEmbed = new EmbedBuilder()
           .setTitle('✅ SELECTION APPROVED')
           .setDescription(`Approved by ${interaction.user.username}`)
           .setColor(0x57F287)
           .setTimestamp();

       await interaction.message.edit({ embeds: [approvedEmbed], components: [] });

       await interaction.editReply({
           content: '✅ Selection approved and applied! Moving to Results state.'
       });

       console.log(`✅ Selection approved by ${interaction.user.username}`);
   }

   async regenerateSelection(interaction) {
       await interaction.deferReply({ ephemeral: true });

       try {
           const newSelection = await this.algorithm.runSelection();
           await this.algorithm.storePendingSelection(newSelection);

           const newEmbed = await this.buildApprovalEmbed(newSelection);
           const newButtons = this.buildApprovalButtons();

           await interaction.message.edit({ embeds: [newEmbed], components: [newButtons] });

           await interaction.editReply({
               content: '🔄 New selection generated!'
           });

           console.log(`🔄 Selection regenerated by ${interaction.user.username}`);

       } catch (error) {
           await interaction.editReply({
               content: '❌ Error regenerating selection. Please try again.'
           });
       }
   }

   async applySelection(selectionData) {
       const queries = new DatabaseQueries(this.db);
       const currentCycle = await queries.getCurrentCycle();

       if (currentCycle) {
           await queries.updateCycleSelection(currentCycle.cycle_id, selectionData);
       } else {
           console.error('❌ No current cycle found to apply selection');
       }
   }

   async setSelectionTimeout(timeoutTime) {
       return new Promise((resolve, reject) => {
           this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
               ['SELECTION_TIMEOUT', timeoutTime, new Date().toISOString()], 
               function(err) {
                   if (err) reject(err);
                   else resolve();
               }
           );
       });
   }

   async getSelectionTimeout() {
       return new Promise((resolve, reject) => {
           this.db.get('SELECT value FROM bot_config WHERE key = ?', ['SELECTION_TIMEOUT'], (err, row) => {
               if (err) reject(err);
               else resolve(row ? row.value : null);
           });
       });
   }

   async clearSelectionTimeout() {
       return new Promise((resolve, reject) => {
           this.db.run('DELETE FROM bot_config WHERE key = ?', ['SELECTION_TIMEOUT'], (err) => {
               if (err) reject(err);
               else resolve();
           });
       });
   }

   async setApprovalMessageId(messageId) {
       return new Promise((resolve, reject) => {
           this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
               ['APPROVAL_MESSAGE_ID', messageId, new Date().toISOString()], 
               function(err) {
                   if (err) reject(err);
                   else resolve();
               }
           );
       });
   }

   async checkAutoApproval() {
       const timeoutTime = await this.getSelectionTimeout();
       if (!timeoutTime) return false;

       const now = new Date();
       const timeout = new Date(timeoutTime);

       if (now >= timeout) {
           console.log('⏰ Auto-approval timeout reached');
           
           const pendingSelection = await this.algorithm.getPendingSelection();
           if (pendingSelection) {
               await this.applySelection(pendingSelection);
               await this.algorithm.clearPendingSelection();
               await this.clearSelectionTimeout();
               await this.client.stateManager.forceState(3, 'Auto-approval after 24hr timeout');

               console.log('✅ Selection auto-approved after timeout');
               return true;
           }
       }

       return false;
   }
}

module.exports = ApprovalManager;
