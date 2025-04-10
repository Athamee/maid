// Charge les variables d’environnement depuis .env uniquement si on n’est pas sur Render
if (!process.env.RENDER) {
    require('dotenv').config();
}

const { Client, GatewayIntentBits, Collection, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();

app.get('/health', (req, res) => res.status(200).send('Maid babe est en bonne santé !'));
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Serveur Express démarré sur le port ${port}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();

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

async function deployCommands() {
    const commands = [];
    for (const [name, command] of client.commands) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Déploiement des commandes Slash...');
        await rest.put(Routes.applicationCommands(process.env.ID_APP), { body: commands });
        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error.message, error.stack);
    }
}

async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warns (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                reason TEXT,
                moderator_id TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS xp (
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                last_message TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, guild_id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS xp_settings (
                guild_id TEXT PRIMARY KEY,
                message_xp INTEGER DEFAULT 10,
                voice_xp_per_min INTEGER DEFAULT 5,
                reaction_xp INTEGER DEFAULT 2,
                image_xp INTEGER DEFAULT 15,
                level_up_channel TEXT DEFAULT NULL,
                excluded_roles TEXT DEFAULT '[]',
                no_camera_channels TEXT DEFAULT '[]',
                default_level_message TEXT DEFAULT 'Bravo à toi {user}, tu as atteins le niveau ${level} ! Continue d'explorer tes désirs intimes dans le Donjon. 😈' -- Nouveau champ pour message par défaut
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS level_up_messages (
                guild_id TEXT NOT NULL,
                level INTEGER NOT NULL,
                message TEXT NOT NULL,
                PRIMARY KEY (guild_id, level)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS voice_role_settings (
                guild_id TEXT NOT NULL,
                voice_channel_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                text_channel_id TEXT NOT NULL,
                PRIMARY KEY (guild_id, voice_channel_id)
            )
        `);
        console.log('Tables warns, xp, xp_settings, level_up_messages et voice_role_settings prêtes.');
    } catch (error) {
        console.error('Erreur lors de l’initialisation de la base de données :', error.stack);
    }
}

client.once('ready', () => console.log('Maid babe est en ligne !'));

client.on('interactionCreate', async interaction => {
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

require('./handlers/messageHandler')(client);

async function startBot() {
    try {
        await initDatabase();
        await loadCommands();
        await deployCommands();
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Erreur lors de l’initialisation :', error.message, error.stack);
        process.exit(1);
    }
}

startBot();