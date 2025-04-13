// Importer les modules nécessaires
const { Client, GatewayIntentBits } = require('discord.js');
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
        GatewayIntentBits.GuildVoiceStates
    ]
});

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
                guild_id TEXT NOT NOT NULL,
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

        // Migration pour ajouter les colonnes manquantes à xp_settings
        await pool.query(`
            DO $$
            BEGIN
                -- Ajouter spam_settings si absent
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'xp_settings' 
                    AND column_name = 'spam_settings'
                ) THEN
                    ALTER TABLE xp_settings 
                    ADD COLUMN spam_settings TEXT DEFAULT '{}';
                END IF;

                -- Ajouter excluded_roles si absent
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'xp_settings' 
                    AND column_name = 'excluded_roles'
                ) THEN
                    ALTER TABLE xp_settings 
                    ADD COLUMN excluded_roles TEXT DEFAULT '[]';
                END IF;

                -- Ajouter no_camera_channels si absent
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'xp_settings' 
                    AND column_name = 'no_camera_channels'
                ) THEN
                    ALTER TABLE xp_settings 
                    ADD COLUMN no_camera_channels TEXT DEFAULT '[]';
                END IF;

                -- Ajouter default_level_message si absent
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'xp_settings' 
                    AND column_name = 'default_level_message'
                ) THEN
                    ALTER TABLE xp_settings 
                    ADD COLUMN default_level_message TEXT DEFAULT 'Félicitations {user}, tu es désormais niveau {level} ! Continue d''explorer tes désirs intimes sur le Donjon. 😈';
                END IF;
            END;
            $$;
        `);

        // S'assurer que spam_settings n'est pas NULL
        await pool.query(`
            UPDATE xp_settings 
            SET spam_settings = '{}'
            WHERE spam_settings IS NULL;
        `);

        console.log('Tables warns, xp, xp_settings, level_up_messages, voice_role_settings, warn_removed_roles prêtes avec toutes les migrations.');
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
        const commandFiles = await fs.readdir(commandsPath);
        for (const file of commandFiles) {
            if (file.endsWith('.js')) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`Commande chargée : ${file}`);
                } else {
                    console.warn(`[WARNING] La commande à ${filePath} manque une propriété 'data' ou 'execute'.`);
                }
            }
        }
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
            Routes.applicationCommands(process.env.ID_APP),
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
        const eventFiles = await fs.readdir(eventsPath);
        for (const file of eventFiles) {
            if (file.endsWith('.js')) {
                const filePath = path.join(eventsPath, file);
                const event = require(filePath);
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                console.log(`Événement chargé : ${file}`);
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des événements :', error.stack);
    }
}

// Initialisation
(async () => {
    try {
        await initDatabase();
        await loadCommands();
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