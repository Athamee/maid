// Charge les variables d’environnement depuis .env uniquement si on n’est pas sur Render
if (!process.env.RENDER) {
    require('dotenv').config();
}
// Importe les modules Discord.js pour le bot et les commandes
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
// Importe les modules Node.js pour gérer les fichiers et le serveur Express
const path = require('path');
const express = require('express');
const fs = require('fs').promises;

// Initialise le serveur Express pour le monitoring et health checks
const app = express();

// Endpoint Health Check pour Render
app.get('/health', (req, res) => {
    res.status(200).send('Maid babe est en bonne santé !');
});

// Endpoint racine pour vérifier manuellement que le bot est en vie
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

// Définit le port (fourni par Render ou 8000 par défaut)
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Serveur Express démarré sur le port ${port}`));

// Crée le client Discord avec tous les intents nécessaires
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration // Ajouté pour la modération des membres
    ]
});

// Crée une collection pour stocker les commandes
client.commands = new Collection();

// Charge dynamiquement les commandes depuis le dossier "commands"
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = require('fs').readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Fonction pour déployer les commandes Slash sur Discord
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

// Fonction pour initialiser warns.json s’il n’existe pas
async function initializeWarnsFile() {
    const warnFile = path.join(__dirname, 'warns.json');
    try {
        await fs.access(warnFile);
        console.log('Fichier warns.json trouvé.');
    } catch (error) {
        await fs.writeFile(warnFile, '{}', 'utf8');
        console.log('Fichier warns.json créé avec succès.');
    }
}

// Événement déclenché quand le bot est prêt
client.once('ready', () => {
    console.log('Maid babe est en ligne !');
});

// Gère les interactions (commandes Slash)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Erreur dans la commande :', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply('Erreur lors de l’exécution de la commande !');
        }
    }
});

// Charge le gestionnaire de messages
require('./handlers/messageHandler')(client);

// Initialise le fichier warns.json puis connecte le bot
initializeWarnsFile()
    .then(() => deployCommands())
    .then(() => {
        client.login(process.env.TOKEN).catch((error) => {
            console.error('Erreur lors de la connexion à Discord :', error);
            process.exit(1);
        });
    })
    .catch((error) => {
        console.error('Erreur lors de l’initialisation :', error);
        process.exit(1);
    });