require('dotenv').config(); // Charge les variables d’environnement depuis .env en local ou Koyeb
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest'); // Ajout de REST pour déployer les commandes
const { Routes } = require('discord.js'); // Ajout de Routes pour les endpoints Discord
const path = require('path');
const express = require('express'); // Ajout d’Express pour Koyeb/UptimeRobot
const { google } = require('googleapis'); // Ajout de googleapis pour Google Drive

const app = express(); // Initialise une application Express

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds // Intent de base pour les commandes Slash
    ]
});

client.commands = new Collection();

// --- Configuration Google Drive ---
const credentials = JSON.parse(process.env.GDRIVE_CREDENTIALS); // Charge depuis variable d’environnement
const { client_secret, client_id, redirect_uris } = credentials.web; // Pour application web
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
const token = JSON.parse(process.env.GDRIVE_TOKEN); // Charge depuis variable d’environnement
oAuth2Client.setCredentials(token);

// Fonction pour récupérer un fichier aléatoire depuis un dossier Google Drive spécifique
async function getRandomFileFromDrive(folderId) {
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    try {
        const res = await drive.files.list({
            q: `'${folderId}' in parents`, // Utilise l'ID du dossier passé en paramètre
            fields: 'files(id, name, webViewLink)', // Récupère les liens publics
        });

        const files = res.data.files;
        if (!files || files.length === 0) throw new Error(`Aucun fichier trouvé dans le dossier ${folderId}.`);

        const randomFile = files[Math.floor(Math.random() * files.length)];
        return randomFile.webViewLink; // Retourne le lien direct
    } catch (error) {
        console.error('Erreur lors de la récupération du fichier Google Drive :', error);
        throw error;
    }
}

// Chargement des commandes depuis le dossier 'commands'
const commandsPath = path.join(__dirname, 'commands');
const { readdirSync } = require('fs'); // Garde fs juste pour lire les commandes
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

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

// Gestion des interactions (commandes Slash)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction, { getRandomFileFromDrive }); // Passe la fonction aux commandes
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
    }
});

// Endpoint pour UptimeRobot ou monitoring
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

// Démarrage du serveur Express avec port dynamique pour Koyeb
const port = process.env.PORT || 8000; // Utilise le port de Koyeb si défini, sinon 8000
app.listen(port, () => console.log(`Serveur Express démarré sur le port ${port}`));

// Connexion à Discord avec gestion d’erreur
client.login(process.env.TOKEN).catch((error) => {
    console.error('Erreur lors de la connexion à Discord :', error);
    process.exit(1); // Ferme le processus si la connexion échoue
});