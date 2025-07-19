// Add this to src/services/approvalManager.js in the showManualEditModal function:

async showManualEditModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    try {
        // Get current pending selection to pre-fill
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
        
        // Create text inputs for each slot
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
        
        // Add inputs to action rows
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
