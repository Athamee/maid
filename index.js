require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const path = require('path');
const express = require('express');
const { getGifList, loadGifList } = require('./gifCache');

const app = express();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Chargement des commandes depuis le dossier 'commands'
const commandsPath = path.join(__dirname, 'commands');
const { readdirSync } = require('fs');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Fonction pour déployer les commandes Slash
const deployCommands = async () => {
    const commands = [];
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Déploiement des commandes Slash...');
        await rest.put(
            Routes.applicationCommands(process.env.ID_APP),
            { body: commands }
        );
        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error);
    }
};

// Exécute le déploiement au démarrage
deployCommands();

client.once('ready', async () => {
    console.log('Maid babe est en ligne !');
    await loadGifList(); // Charge la liste d’URLs depuis commands/hugGifs.json
    if (!getGifList('hug').length) {
        console.warn('Aucune URL trouvée dans hugGifs.json pour "hug" !');
    }
});

// Gestion des interactions (commandes Slash)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction, { getGifList }); // Passe uniquement getGifList
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
    }
});

// Endpoint pour UptimeRobot ou monitoring
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Serveur Express démarré sur le port ${port}`));

client.login(process.env.TOKEN).catch((error) => {
    console.error('Erreur lors de la connexion à Discord :', error);
    process.exit(1);
});