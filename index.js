// Charge les variables d’environnement depuis .env uniquement si on n’est pas sur Render
if (!process.env.RENDER) {
    require('dotenv').config();
}

// Importe les modules Discord.js pour le bot et les commandes
const { Client, GatewayIntentBits, Collection, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

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
        GatewayIntentBits.GuildModeration
    ]
});

// Crée une collection pour stocker les commandes
client.commands = new Collection();

// Charge dynamiquement les commandes de manière asynchrone
async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = require('fs').readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if (!command.data || !command.data.name) {
                console.error(`Erreur : La commande dans ${file} n'a pas de propriété 'data' ou 'data.name' valide`);
                continue;
            }
            client.commands.set(command.data.name, command);
            console.log(`Commande chargée : ${command.data.name}`);
        } catch (error) {
            console.error(`Erreur lors du chargement de ${file} :`, error.message, error.stack);
        }
    }
}

// Fonction pour déployer les commandes Slash sur Discord
async function deployCommands() {
    const commands = [];
    for (const [name, command] of client.commands) {
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
        console.error('Erreur lors du déploiement des commandes :', error.message, error.stack);
    }
}

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

// Gère toutes les interactions (commandes Slash et boutons)
client.on('interactionCreate', async interaction => {
    // Gestion des commandes Slash
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.warn(`Commande inconnue : ${interaction.commandName}`);
            return;
        }

        try {
            console.log(`Commande exécutée : ${interaction.commandName} par ${interaction.user.tag}`);
            await command.execute(interaction);
        } catch (error) {
            console.error(`Erreur dans la commande ${interaction.commandName} :`, error.message, error.stack);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: 'Erreur lors de l’exécution de la commande !' });
            }
        }
    }

    // Gestion des interactions de boutons
    if (interaction.isButton()) {
        const command = client.commands.get('ticket');
        if (command) {
            try {
                if (interaction.customId === 'ticket_type_6' && command.handleButtonInteraction) {
                    console.log(`Bouton ticket_type_6 cliqué par ${interaction.user.tag}`);
                    await command.handleButtonInteraction(interaction);
                } else if (interaction.customId === 'close_ticket' && command.handleCloseTicket) {
                    console.log(`Bouton close_ticket cliqué par ${interaction.user.tag}`);
                    await command.handleCloseTicket(interaction);
                }
            } catch (error) {
                console.error(`Erreur dans la gestion du bouton ${interaction.customId} :`, error.message, error.stack);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Erreur lors du traitement du bouton !', ephemeral: true });
                }
            }
        }
    }
});

// Charge le gestionnaire de messages
require('./handlers/messageHandler')(client);

// Initialise le bot de manière asynchrone
async function startBot() {
    try {
        await initializeWarnsFile();
        await loadCommands();
        await deployCommands();
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Erreur lors de l’initialisation :', error.message, error.stack);
        process.exit(1);
    }
}

startBot();