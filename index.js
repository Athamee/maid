// Charge les variables d’environnement depuis le fichier .env uniquement si on n’est pas sur Replit
if (!process.env.REPLIT) {
    require('dotenv').config();
}
// Importe les modules Discord.js pour le bot et les commandes
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
// Importe les modules Node.js pour gérer les fichiers et le serveur Express
const path = require('path');
const express = require('express');
const fs = require('fs');

// Initialise le serveur Express pour le monitoring (ex. UptimeRobot)
const app = express();

// Crée le client Discord avec l’intention de gérer les guildes
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Crée une collection pour stocker les commandes
client.commands = new Collection();

// Charge dynamiquement les commandes depuis le dossier "commands"
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command); // Ajoute chaque commande à la collection
}

// Fonction pour déployer les commandes Slash sur Discord
const deployCommands = async () => {
    const commands = [];
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        commands.push(command.data.toJSON()); // Convertit les commandes en JSON pour l’API
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN); // Initialise l’API REST

    try {
        console.log('Déploiement des commandes Slash...');
        await rest.put(
            Routes.applicationCommands(process.env.ID_APP), // Déploie globalement les commandes
            { body: commands }
        );
        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error);
    }
};

// Lance le déploiement des commandes au démarrage
deployCommands();

// Événement déclenché quand le bot est prêt
client.once('ready', () => {
    console.log('Maid babe est en ligne !');
});

// Gère les interactions (commandes Slash)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return; // Ignore si ce n’est pas une commande

    const command = client.commands.get(interaction.commandName); // Récupère la commande

    if (!command) return; // Ignore si la commande n’existe pas

    try {
        await command.execute(interaction); // Exécute la commande
    } catch (error) {
        // Gère les erreurs sans faire planter le bot
        console.error('Erreur dans la commande :', error);
        if (!interaction.replied && !interaction.deferred) {
            // Si aucune réponse n’a été envoyée, envoie un message d’erreur éphémère
            await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
        } else if (interaction.deferred) {
            // Si la réponse est différée, modifie-la avec un message d’erreur
            await interaction.editReply('Erreur lors de l’exécution de la commande !');
        }
    }
});

// Endpoint Express pour vérifier que le bot est en vie
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

// Définit le port (fourni par Replit ou 8000 par défaut)
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Serveur Express démarré sur le port ${port}`));

// Connecte le bot à Discord avec le token
client.login(process.env.TOKEN).catch((error) => {
    console.error('Erreur lors de la connexion à Discord :', error);
    process.exit(1); // Quitte si la connexion échoue
});