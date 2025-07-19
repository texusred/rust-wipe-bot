const fs = require('fs');
const path = require('path');

async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

async function registerCommands(client) {
    const commands = [];
    client.commands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
        await guild.commands.set(commands);
        console.log(`✅ Registered ${commands.length} slash commands`);
    }
}

module.exports = { loadCommands, registerCommands };
