require('dotenv').config(); // Charge les variables d’environnement depuis .env en local
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest'); // Ajout de REST pour déployer les commandes
const { Routes } = require('discord.js'); // Ajout de Routes pour les endpoints Discord
const fs = require('fs');
const path = require('path');
const express = require('express'); // Ajout d’Express pour Koyeb/UptimeRobot

const app = express(); // Initialise une application Express

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds // Intent de base pour les commandes Slash
    ]
});

client.commands = new Collection();

// Chargement des commandes depuis le dossier 'commands'
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command); // Ajoute chaque commande à la Collection
}

// Fonction pour déployer les commandes Slash
const deployCommands = async () => {
    const commands = []; // Tableau pour stocker les données des commandes
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        commands.push(command.data.toJSON()); // Convertit chaque commande en JSON pour l'API
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN); // Initialise REST avec le token

    try {
        console.log('Déploiement des commandes Slash...');
        await rest.put(
            Routes.applicationCommands(process.env.ID_APP), // Déploie pour toutes les guilds
            { body: commands }
        );
        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error);
    }
};

// Exécute le déploiement au démarrage
deployCommands();

client.once('ready', () => {
    console.log('Maid babe est en ligne !');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction); // Exécute la commande demandée
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
    }
});

// Endpoint pour UptimeRobot ou monitoring
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

// Démarrage du serveur Express
app.listen(8000, () => console.log('Serveur Express démarré sur le port 8000'));

// Connexion à Discord avec gestion d’erreur
client.login(process.env.TOKEN).catch((error) => {
    console.error('Erreur lors de la connexion à Discord :', error);
    process.exit(1); // Ferme le processus si la connexion échoue
});