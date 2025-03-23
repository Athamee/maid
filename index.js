require('dotenv').config(); // Charge .env en local
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express'); // Ajout d’Express pour Koyeb/UptimeRobot

const app = express(); // Crée une app Express

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds // Suffisant pour les commandes Slash
    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log('Maid babe est en ligne !');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
    }
});

// Endpoint pour UptimeRobot
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

// Lance le serveur Express
app.listen(8000, () => console.log('Serveur Express démarré sur le port 8000'));

// Connexion à Discord avec gestion d'erreur
client.login(process.env.TOKEN).catch((error) => {
    console.error('Erreur lors de la connexion à Discord :', error);
    process.exit(1); // Quitte le processus en cas d'erreur
});