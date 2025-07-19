const { SlashCommandBuilder } = require('discord.js');
const WipeEmbedBuilder = require('../embeds/wipeEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wipe')
        .setDescription('Manage Rust wipe player selection')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show the persistent wipe status embed')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const db = interaction.client.db;
            const embedData = await WipeEmbedBuilder.buildPersistentEmbed(interaction.client, db);
            await interaction.reply(embedData);
        }
    }
};
