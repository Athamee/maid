// Charge les variables d’environnement depuis .env uniquement si on n’est pas sur Render
if (!process.env.RENDER) {
    require('dotenv').config();
}

// Importation des modules nécessaires
const { Client, GatewayIntentBits, Collection, Routes, InteractionResponseFlags } = require('discord.js');
const { REST } = require('@discordjs/rest');
const path = require('path');
const fs = require('fs');
const express = require('express');
const pool = require('./db');

// Initialisation du serveur Express pour les vérifications de santé
const app = express();

// Route /health pour vérifier que le bot est en ligne
app.get('/health', (req, res) => res.status(200).send('Maid babe est en bonne santé !'));

// Route racine pour une confirmation simple
app.get('/', (req, res) => res.send('Ta servante dévouée, Maid babe, est vivante !'));

// Définition du port (fourni par l’environnement ou 8000 par défaut)
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Serveur Express démarré sur le port ${port}`));

// Création du client Discord avec les intents nécessaires
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

// Collection pour stocker les commandes chargées
client.commands = new Collection();

// Fonction pour charger les commandes depuis le dossier commands
async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            const commandName = command.data?.name || command.commandDatas?.name;
            if (!commandName) {
                console.error(`Erreur : La commande dans ${file} n'a pas de propriété 'data.name' ou 'commandDatas.name' valide`);
                continue;
            }
            client.commands.set(commandName, command);
            console.log(`Commande chargée : ${commandName}`);
        } catch (error) {
            console.error(`Erreur lors du chargement de ${file} :`, error.message, error.stack);
        }
    }
}

// Fonction pour charger les événements depuis le dossier events
async function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const event = require(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
            console.log(`Événement chargé : ${event.name}`);
        } catch (error) {
            console.error(`Erreur lors du chargement de l'événement ${file} :`, error.message, error.stack);
        }
    }
}

// Fonction pour déployer les commandes slash via l’API Discord
async function deployCommands() {
    const commands = [];
    for (const command of client.commands.values()) {
        const commandData = command.data || command.commandDatas;
        commands.push(commandData.toJSON());
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

// Fonction pour initialiser les tables de la base de données
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
                spam_settings TEXT DEFAULT '{}',
                default_level_message TEXT DEFAULT 'Félicitations {user}, tu es désormais niveau {level} ! Continue d''explorer tes désirs intimes sur le Donjon. 😈'
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warn_removed_roles (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                removed_roles TEXT DEFAULT '[]',
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        console.log('Tables warns, xp, xp_settings, level_up_messages, voice_role_settings, warn_removed_roles prêtes.');
    } catch (error) {
        console.error('Erreur lors de l’initialisation de la base de données :', error.stack);
        throw error;
    }
}

// Événement : bot prêt
client.once('ready', () => {
    console.log('Maid babe est en ligne !');
});

// Événement : nouveau membre rejoint le serveur
client.on('guildMemberAdd', async member => {
    const userId = member.id;
    const guildId = member.guild.id;

    try {
        // Ajouter le membre à la table xp avec des valeurs par défaut
        await pool.query(
            'INSERT INTO xp (user_id, guild_id, xp, level, last_message) VALUES ($1, $2, 0, 1, NOW()) ' +
            'ON CONFLICT (user_id, guild_id) DO NOTHING',
            [userId, guildId]
        );
        console.log(`Membre ${userId} ajouté à la BD pour le serveur ${guildId}`);
    } catch (error) {
        console.error(`Erreur lors de l’ajout du membre ${userId} à la BD :`, error.stack);
    }
});

// Événement : membre quitte le serveur
client.on('guildMemberRemove', async member => {
    const userId = member.id;
    const guildId = member.guild.id;

    try {
        await pool.query('DELETE FROM xp WHERE user_id = $1 AND guild_id = $2', [userId, guildId]);
        await pool.query('DELETE FROM warns WHERE user_id = $1 AND guild_id = $2', [userId, guildId]);
        await pool.query('DELETE FROM warn_removed_roles WHERE user_id = $1 AND guild_id = $2', [userId, guildId]);
        console.log(`Membre ${userId} supprimé de la BD pour le serveur ${guildId}`);
    } catch (error) {
        console.error(`Erreur lors de la suppression du membre ${userId} de la BD :`, error.stack);
    }
});

// Événement : gestion des interactions (commandes, boutons, menus déroulants)
client.on('interactionCreate', async interaction => {
    try {
        // Log de l’interaction pour debug
        console.log(`Interaction reçue : type=${interaction.type}, customId=${interaction.customId || 'none'}, user=${interaction.user.tag}`);

        if (interaction.isCommand()) {
            // Gérer les commandes slash
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.warn(`Commande inconnue : ${interaction.commandName}`);
                return;
            }
            console.log(`Commande exécutée : ${interaction.commandName} par ${interaction.user.tag}`);
            await command.execute(interaction);
            return;
        }

        if (interaction.isButton()) {
            // Log du bouton cliqué
            console.log(`Bouton cliqué : ${interaction.customId} par ${interaction.user.tag}`);

            // Gestion des boutons spécifiques
            const ticketCommand = client.commands.get('ticket');
            const ticketMenuCommand = client.commands.get('ticket-menu');

            if (interaction.customId === 'ticket_type_6' && ticketCommand) {
                // Bouton pour créer un ticket (ticket.js)
                if (ticketCommand.handleButtonInteraction) {
                    console.log(`Appel de handleButtonInteraction pour ticket.js`);
                    await ticketCommand.handleButtonInteraction(interaction);
                } else {
                    console.warn(`handleButtonInteraction manquant pour ticket.js`);
                }
                return;
            }

            if (interaction.customId === 'close_ticket') {
                // Bouton pour fermer un ticket (ticket.js ou ticketmenu.js)
                if (ticketCommand && ticketCommand.handleCloseTicket) {
                    console.log(`Appel de handleCloseTicket pour ticket.js`);
                    await ticketCommand.handleCloseTicket(interaction);
                } else if (ticketMenuCommand && ticketMenuCommand.handleCloseTicket) {
                    console.log(`Appel de handleCloseTicket pour ticketmenu.js`);
                    await ticketMenuCommand.handleCloseTicket(interaction);
                } else {
                    console.warn(`Aucune méthode handleCloseTicket trouvée pour close_ticket`);
                    await interaction.reply({ content: 'Commande de fermeture non configurée.', ephemeral: true });
                }
                return;
            }

            // Gestion des autres boutons (rôles, règlement, etc.)
            for (const [name, command] of client.commands) {
                if (!command.handleButtonInteraction) continue;

                if (
                    (name === 'reglement' && interaction.customId === 'accept_reglement') ||
                    (name === 'role-genre' && interaction.customId.startsWith('genre_')) ||
                    (name === 'role-pronom' && interaction.customId.startsWith('pronom_')) ||
                    (name === 'role-age' && interaction.customId.startsWith('age_')) ||
                    (name === 'role-orientation' && interaction.customId.startsWith('orientation_')) ||
                    (name === 'role-situation-relationnelle' && interaction.customId.startsWith('relation_')) ||
                    (name === 'role-dynamique-bdsm' && interaction.customId.startsWith('bdsm_')) ||
                    (name === 'role-situation-bdsm' && interaction.customId.startsWith('bdsm_')) ||
                    (name === 'role-connaissance-bdsm' && interaction.customId.startsWith('connaissance-bdsm_')) ||
                    (name === 'role-experience-bdsm' && interaction.customId.startsWith('experience-bdsm_')) ||
                    (name === 'role-experience-vanille' && interaction.customId.startsWith('experience-vanille_')) ||
                    (name === 'role-message-prive' && interaction.customId.startsWith('dm_')) ||
                    (name === 'role-evenement' && interaction.customId.startsWith('event_')) ||
                    (name === 'role-membre' && interaction.customId.startsWith('membre_'))
                ) {
                    console.log(`Appel de handleButtonInteraction pour ${name}`);
                    await command.handleButtonInteraction(interaction);
                    return;
                }
            }

            // Bouton non reconnu
            console.warn(`Bouton non géré : ${interaction.customId}`);
            await interaction.reply({ content: 'Bouton non reconnu.', ephemeral: true });
        }

        if (interaction.isStringSelectMenu()) {
            // Log du menu déroulant
            console.log(`Menu déroulant cliqué : ${interaction.customId} par ${interaction.user.tag}`);

            // Gestion du menu ticket-menu
            const ticketMenuCommand = client.commands.get('ticket-menu');
            if (interaction.customId === 'select_ticket' && ticketMenuCommand && ticketMenuCommand.handleMenuInteraction) {
                console.log(`Appel de handleMenuInteraction pour ticketmenu.js`);
                await ticketMenuCommand.handleMenuInteraction(interaction);
            } else {
                console.warn(`Menu non géré : ${interaction.customId}`);
                await interaction.reply({ content: 'Menu non reconnu.', ephemeral: true });
            }
        }
    } catch (error) {
        console.error('Erreur lors de l’interaction :', error.message, error.stack);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur lors du traitement de l’interaction !', ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: 'Erreur lors du traitement de l’interaction !', ephemeral: true });
        }
    }
});

// Charger le gestionnaire de messages (XP, réactions, vocal)
require('./handlers/messageHandler')(client);

// Fonction principale pour démarrer le bot
async function startBot() {
    try {
        await initDatabase();
        await loadCommands();
        await loadEvents();
        await deployCommands();
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Erreur lors de l’initialisation :', error.message, error.stack);
        process.exit(1);
    }
}

// Lancer le bot
startBot();