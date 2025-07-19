const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Test if the bot is responding'),
    
    async execute(interaction) {
        await interaction.reply('🏓 Pong! Bot is online and ready.');
    },
};
