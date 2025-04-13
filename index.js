// Importer les modules nécessaires
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const pool = require('./db');
const express = require('express');

// Initialiser le client Discord avec les intents nécessaires
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions // Ajouté pour messageReactionAdd
    ]
});

// Initialiser client.commands comme une Collection
client.commands = new Collection();

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

// Fonction pour initialiser les tables de la base de données
async function initDatabase() {
    try {
        // Créer la table des avertissements
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

        // Créer la table pour le système d’XP
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

        // Créer la table pour les paramètres d’XP
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
                spam_settings TEXT DEFAULT '{}',
                default_level_message TEXT DEFAULT 'Félicitations {user}, tu es désormais niveau {level} ! Continue d''explorer tes désirs intimes sur le Donjon. 😈'
            )
        `);

        // Créer la table pour les messages personnalisés de montée de niveau
        await pool.query(`
            CREATE TABLE IF NOT EXISTS level_up_messages (
                guild_id TEXT NOT NULL,
                level INTEGER NOT NULL,
                message TEXT NOT NULL,
                PRIMARY KEY (guild_id, level)
            )
        `);

        // Créer la table pour les paramètres des rôles vocaux
        await pool.query(`
            CREATE TABLE IF NOT EXISTS voice_role_settings (
                guild_id TEXT NOT NULL,
                voice_channel_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                text_channel_id TEXT NOT NULL,
                PRIMARY KEY (guild_id, voice_channel_id)
            )
        `);

        // Créer la table pour stocker les rôles retirés après warns
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warn_removed_roles (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                removed_roles TEXT DEFAULT '[]',
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        // Créer la table pour le suivi du spam
        await pool.query(`
            CREATE TABLE IF NOT EXISTS spam_tracker (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration pour ajouter les colonnes manquantes à xp_settings
        await pool.query(`
            ALTER TABLE xp_settings
            ADD COLUMN IF NOT EXISTS spam_settings TEXT DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS excluded_roles TEXT DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS no_camera_channels TEXT DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS default_level_message TEXT DEFAULT 'Félicitations {user}, tu es désormais niveau {level} ! Continue d’explorer tes désirs intimes sur le Donjon. 😈';
        `);

        // S'assurer que spam_settings n'est pas NULL
        await pool.query(`
            UPDATE xp_settings 
            SET spam_settings = '{}'
            WHERE spam_settings IS NULL;
        `);

        console.log('Tables warns, xp, xp_settings, level_up_messages, voice_role_settings, warn_removed_roles, spam_tracker prêtes avec toutes les migrations.');
    } catch (error) {
        console.error('Erreur lors de l’initialisation de la base de données :', error.stack);
        throw error;
    }
}

// Charger les commandes
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

async function loadCommands() {
    try {
        console.log('Début chargement des commandes...');
        const commandFiles = await fs.readdir(commandsPath);
        if (commandFiles.length === 0) {
            console.warn('Aucun fichier trouvé dans commands/');
        }
        for (const file of commandFiles) {
            if (file.endsWith('.js')) {
                const filePath = path.join(commandsPath, file);
                console.log(`Tentative chargement : ${file}`);
                try {
                    const command = require(filePath);
                    if ('data' in command && 'execute' in command) {
                        commands.push(command.data.toJSON());
                        client.commands.set(command.data.name, command);
                        console.log(`Commande chargée : ${file} (nom: ${command.data.name})`);
                    } else {
                        console.warn(`[WARNING] La commande à ${filePath} manque une propriété 'data' ou 'execute'.`);
                    }
                } catch (error) {
                    console.error(`Erreur chargement ${file} :`, error.message);
                }
            }
        }
        console.log(`Total commandes chargées : ${client.commands.size}`);
        console.log('Commandes enregistrées :', Array.from(client.commands.keys()));
    } catch (error) {
        console.error('Erreur lors du chargement des commandes :', error.stack);
    }
}

// Déployer les commandes
async function deployCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Déploiement des commandes...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.ID_APP, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Commandes déployées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error.stack);
    }
}

// Charger les événements
const eventsPath = path.join(__dirname, 'events');

async function loadEvents() {
    try {
        console.log('Début chargement des événements...');
        // Vérifier si le dossier events existe
        try {
            await fs.access(eventsPath);
        } catch (error) {
            console.error(`Erreur : Le dossier ${eventsPath} n’existe pas ou est inaccessible :`, error.message);
            return;
        }
        const eventFiles = await fs.readdir(eventsPath);
        if (eventFiles.length === 0) {
            console.error('Erreur : Aucun fichier trouvé dans events/');
            return;
        }
        for (const file of eventFiles) {
            if (file.endsWith('.js')) {
                const filePath = path.join(eventsPath, file);
                console.log(`Tentative chargement : ${file}`);
                try {
                    const event = require(filePath);
                    if (event.name && event.execute) {
                        if (event.once) {
                            client.once(event.name, (...args) => event.execute(...args));
                        } else {
                            client.on(event.name, (...args) => event.execute(...args));
                        }
                        console.log(`Événement chargé : ${file} (nom: ${event.name})`);
                    } else {
                        console.warn(`[WARNING] L’événement à ${filePath} manque une propriété 'name' ou 'execute'.`);
                    }
                } catch (error) {
                    console.error(`Erreur chargement ${file} :`, error.message);
                }
            }
        }
        console.log('Événements enregistrés :', client.eventNames());
    } catch (error) {
        console.error('Erreur lors du chargement des événements :', error.stack);
    }
}

// Initialisation
(async () => {
    try {
        await initDatabase();
        await loadCommands();
        console.log('client.commands prêt pour les interactions');
        await deployCommands();
        await loadEvents();
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Erreur lors de l’initialisation :', error.stack);
        process.exit(1);
    }
})();

// Confirmer que le bot est en ligne
client.on('ready', () => {
    console.log('Maid babe est en ligne !');
});