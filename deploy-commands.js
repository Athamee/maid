require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Déploiement des commandes Slash...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.ID_APP, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error(error);
    }
})();