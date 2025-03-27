require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const { listGifs } = require('./googleDrive');
const { updateGifList, getGifList, loadCache } = require('./gifCache'); // Ajout de loadCache

const app = express();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// --- Configuration Google Drive avec OAuth2 ---
const credentials = JSON.parse(process.env.GDRIVE_CREDENTIALS);
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
const token = JSON.parse(process.env.GDRIVE_TOKEN);
oAuth2Client.setCredentials(token);

// IDs des dossiers Google Drive
const FOLDER_IDS = {
    hug: process.env.GDRIVE_HUG,
    // Ajoute d'autres actions ici si besoin
};

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

// Charger le cache en mémoire au démarrage
client.once('ready', async () => {
    console.log('Maid babe est en ligne !');
    await loadCache(); // Charge le cache en mémoire une fois au démarrage
    // Vérifie et initialise le cache si vide
    for (const [action, folderId] of Object.entries(FOLDER_IDS)) {
        const cachedGifs = getGifList(action); // Plus d’await, car synchrone
        if (!cachedGifs.length) {
            const gifs = await listGifs(folderId, oAuth2Client);
            await updateGifList(action, gifs);
            console.log(`Cache initialisé pour ${action}`);
        }
    }
});

// Gestion des interactions (commandes Slash)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction, { getGifList, listGifs, oAuth2Client, FOLDER_IDS }); // Passe les outils nécessaires
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