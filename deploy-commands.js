require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Charge toutes les commandes
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Sépare les commandes globales et spécifiques au serveur
const globalCommands = [];
const guildCommands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    const commandData = command.data.toJSON();
    
    // Ajoute /damier aux commandes globales, les autres au serveur
    if (command.data.name === 'damier') {
        globalCommands.push(commandData);
    } else {
        guildCommands.push(commandData);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Déploiement des commandes Slash...');

        // Déploiement des commandes globales (ex. /damier)
        if (globalCommands.length > 0) {
            await rest.put(
                Routes.applicationCommands(process.env.ID_APP),
                { body: globalCommands },
            );
            console.log(`Commandes globales déployées : ${globalCommands.map(c => c.name).join(', ')}`);
        }

        // Déploiement des commandes spécifiques au serveur
        if (guildCommands.length > 0) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.ID_APP, process.env.GUILD_ID),
                { body: guildCommands },
            );
            console.log(`Commandes du serveur déployées : ${guildCommands.map(c => c.name).join(', ')}`);
        }

        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error(error);
    }
})();