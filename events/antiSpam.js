// Importer les modules nécessaires
const { Client } = require('discord.js');
const pool = require('../db');

// Définir l’événement messageCreate pour le filtre anti-spam
module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Ignorer les messages des bots ou hors guildes
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const userId = message.author.id;
        const logChannelId = process.env.LOG_MESSAGES_ID;
        const piloriChannelId = process.env.PILORI_CHANNEL_ID;

        try {
            // Récupérer les paramètres anti-spam depuis la base
            const settingsResult = await pool.query(
                'SELECT spam_settings FROM xp_settings WHERE guild_id = $1',
                [guildId]
            );

            // Utiliser des valeurs par défaut si spam_settings est absent
            const spamSettings = settingsResult.rows[0]?.spam_settings
                ? JSON.parse(settingsResult.rows[0].spam_settings)
                : {
                    message_limit: 5,
                    time_window: 10000, // 10 secondes
                    repeat_limit: 3,
                    mention_limit: 5,
                    action: 'warn'
                };

            // Vérifier si le filtre est configuré
            if (!spamSettings.message_limit || spamSettings.message_limit <= 0) {
                console.log(`[AntiSpam] Filtre désactivé pour guild ${guildId} (message_limit non défini ou 0).`);
                return;
            }

            // Initialiser le cache pour suivre les messages
            if (!message.client.spamCache) message.client.spamCache = new Map();
            const userCache = message.client.spamCache.get(userId) || {
                messages: [],
                lastContent: '',
                repeatCount: 0
            };

            // Vérifier le nombre de mentions
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > spamSettings.mention_limit) {
                await applyAction(message, spamSettings.action, 'Trop de mentions', logChannelId, piloriChannelId);
                return;
            }

            // Vérifier les messages répétés
            if (message.content === userCache.lastContent && message.content.trim() !== '') {
                userCache.repeatCount += 1;
                if (userCache.repeatCount >= spamSettings.repeat_limit) {
                    await applyAction(message, spamSettings.action, 'Messages répétés', logChannelId, piloriChannelId);
                    return;
                }
            } else {
                userCache.repeatCount = 1;
            }
            userCache.lastContent = message.content;

            // Ajouter le message au cache avec timestamp
            const now = Date.now();
            userCache.messages.push(now);
            userCache.messages = userCache.messages.filter(t => now - t < spamSettings.time_window);

            // Vérifier si trop de messages dans la fenêtre temporelle
            if (userCache.messages.length > spamSettings.message_limit) {
                await applyAction(message, spamSettings.action, 'Trop de messages', logChannelId, piloriChannelId);
                return;
            }

            // Mettre à jour le cache
            message.client.spamCache.set(userId, userCache);
        } catch (error) {
            // Loguer les erreurs dans LOG_MESSAGES_ID
            console.error('[AntiSpam] Erreur :', error.message, error.stack);
            const logChannel = message.client.channels.cache.get(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(`[AntiSpam] Erreur : ${error.message}`);
            }
        }
    }
};

// Fonction pour appliquer une action (warn) en cas de spam
async function applyAction(message, action, reason, logChannelId, piloriChannelId) {
    if (action !== 'warn') return; // Seule action supportée pour l'instant

    try {
        // Ajouter un warn dans la base
        await pool.query(
            'INSERT INTO warns (user_id, guild_id, reason, moderator_id) VALUES ($1, $2, $3, $4)',
            [message.author.id, message.guild.id, `Spam : ${reason}`, message.client.user.id]
        );

        // Compter les warns de l’utilisateur
        const warnCountResult = await pool.query(
            'SELECT COUNT(*) AS count FROM warns WHERE user_id = $1 AND guild_id = $2',
            [message.author.id, message.guild.id]
        );
        const warnCount = parseInt(warnCountResult.rows[0].count, 10);

        // Loguer l’action dans LOG_MESSAGES_ID
        const logChannel = message.client.channels.cache.get(logChannelId);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send(`[AntiSpam] Warn ajouté à <@${message.author.id}> pour : ${reason} (${warnCount}/3).`);
        } else {
            console.error(`[AntiSpam] Erreur : LOG_MESSAGES_ID (${logChannelId}) introuvable ou non texte.`);
        }

        // Envoyer un message dans PILORI_CHANNEL_ID
        const piloriChannel = message.client.channels.cache.get(piloriChannelId);
        if (piloriChannel && piloriChannel.isTextBased()) {
            await piloriChannel.send(`<@${message.author.id}> averti pour spam : ${reason}.`);
        } else {
            console.error(`[AntiSpam] Erreur : PILORI_CHANNEL_ID (${piloriChannelId}) introuvable ou non texte.`);
        }

        // Gérer le 3e warn
        if (warnCount >= 3) {
            const warnedRoleId = process.env.WARNED_ROLE_ID;
            const targetMember = await message.guild.members.fetch(message.author.id).catch(() => null);
            if (!targetMember) {
                console.error(`[AntiSpam] Membre ${message.author.id} introuvable pour 3e warn.`);
                return;
            }

            let actions = [];
            let removedRoles = [];

            // Ajouter le rôle Warned
            if (warnedRoleId && !targetMember.roles.cache.has(warnedRoleId)) {
                const warnedRole = message.guild.roles.cache.get(warnedRoleId);
                if (warnedRole) {
                    await targetMember.roles.add(warnedRole);
                    actions.push(`rôle ${warnedRole.name} attribué`);
                    console.log(`[AntiSpam] Ajout du rôle ${warnedRole.name} à ${message.author.tag}`);
                } else {
                    console.error(`[AntiSpam] WARNED_ROLE_ID (${warnedRoleId}) introuvable.`);
                }
            }

            // Liste des rôles à retirer
            const rolesToRemove = [
                { id: process.env.CERTIFIE_ROLE_ID, name: 'Certifié' },
                { id: process.env.DM_ROLE_ID, name: 'DM' },
                { id: process.env.GALERIE_ROLE_ID, name: 'Galerie' },
                { id: process.env.TORTURE_ROLE_ID, name: 'Torture' },
                { id: process.env.MEMBRE_ROLE_ID, name: 'Membre' }
            ];

            // Retirer les rôles
            for (const role of rolesToRemove) {
                if (role.id && targetMember.roles.cache.has(role.id)) {
                    const roleObj = message.guild.roles.cache.get(role.id);
                    if (roleObj) {
                        await targetMember.roles.remove(roleObj);
                        actions.push(`rôle ${roleObj.name} retiré`);
                        removedRoles.push(role.id);
                        console.log(`[AntiSpam] Retrait du rôle ${roleObj.name} de ${message.author.tag}`);
                    }
                }
            }

            // Stocker les rôles retirés
            if (removedRoles.length > 0) {
                await pool.query(
                    'INSERT INTO warn_removed_roles (guild_id, user_id, removed_roles) VALUES ($1, $2, $3) ' +
                    'ON CONFLICT (guild_id, user_id) DO UPDATE SET removed_roles = $3',
                    [message.guild.id, message.author.id, JSON.stringify(removedRoles)]
                );
                console.log(`[AntiSpam] Rôles retirés stockés pour ${message.author.tag}: ${removedRoles.join(', ')}`);
            }

            // Envoyer un message dans WARN_CHANNEL_ID pour le 3e warn
            const warnChannelId = process.env.WARN_CHANNEL_ID;
            const warnChannel = message.client.channels.cache.get(warnChannelId);
            if (warnChannel && warnChannel.isTextBased()) {
                await warnChannel.send(
                    `<@${message.author.id}>, tu viens de recevoir ton troisième warn pour : Spam (${reason}).\nAu troisième warn, tu es désormais **isolé du serveur**. Un modérateur décidera de la suite.`
                );
                console.log(`[AntiSpam] Message envoyé dans WARN_CHANNEL_ID pour 3e warn de ${message.author.tag}`);
            } else {
                console.error(`[AntiSpam] Erreur : WARN_CHANNEL_ID (${warnChannelId}) introuvable ou non texte.`);
            }
        }
    } catch (error) {
        // Loguer les erreurs d’action
        console.error('[AntiSpam] Erreur lors de l’action :', error.message, error.stack);
        const logChannel = message.client.channels.cache.get(logChannelId);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send(`[AntiSpam] Erreur lors de l’action : ${error.message}`);
        }
    }
}