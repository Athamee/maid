// antiSpam.js
const pool = require('../db');
const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) {
            console.log(`[AntiSpam] Ignoré : bot=${message.author.bot}, guild=${!!message.guild}, user=${message.author.tag}`);
            return;
        }

        const spamSettings = {
            messageCount: 5,
            timeWindow: 10000, // 10 secondes
            warnThreshold: 3
        };

        const userId = message.author.id;
        const guildId = message.guild.id;
        const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;

        try {
            // Enregistrer le message dans une table temporaire pour le suivi
            // Note : Assurez-vous que la table spam_tracker existe (voir index.js pour création)
            await pool.query(
                'INSERT INTO spam_tracker (guild_id, user_id, timestamp) VALUES ($1, $2, NOW())',
                [guildId, userId]
            );

            // Compter les messages dans la fenêtre temporelle
            const messageCountResult = await pool.query(
                'SELECT COUNT(*) as count FROM spam_tracker WHERE guild_id = $1 AND user_id = $2 AND timestamp > NOW() - $3::interval',
                [guildId, userId, `${spamSettings.timeWindow} milliseconds`]
            );
            const messageCount = parseInt(messageCountResult.rows[0].count, 10);

            if (messageCount >= spamSettings.messageCount) {
                console.log(`[AntiSpam] Spam détecté pour ${message.author.tag} : ${messageCount} messages en ${spamSettings.timeWindow}ms`);

                // Supprimer le message incriminé
                if (message.channel.permissionsFor(message.guild.members.me).has(PermissionsBitField.Flags.ManageMessages)) {
                    await message.delete();
                    console.log(`[AntiSpam] Message supprimé pour ${message.author.tag}`);
                } else {
                    console.error(`[AntiSpam] Permission ManageMessages manquante pour supprimer le message de ${message.author.tag}`);
                }

                // Ajouter un warn
                const reason = `Spam détecté : ${messageCount} messages en ${spamSettings.timeWindow / 1000} secondes`;
                const warnResult = await pool.query(
                    'INSERT INTO warns (user_id, guild_id, reason, moderator_id, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
                    [userId, guildId, reason, message.client.user.id]
                );
                const warnId = warnResult.rows[0].id;

                // Compter les warns actifs
                const warnCountResult = await pool.query(
                    'SELECT COUNT(*) as count FROM warns WHERE user_id = $1 AND guild_id = $2',
                    [userId, guildId]
                );
                const warnCount = parseInt(warnCountResult.rows[0].count, 10);

                // Loguer l’action
                if (logChannelId) {
                    const logChannel = message.client.channels.cache.get(logChannelId);
                    if (logChannel && logChannel.isTextBased()) {
                        await logChannel.send(
                            `[AntiSpam] Warn #${warnId} ajouté à <@${userId}> pour : ${reason} (Total warns: ${warnCount})`
                        );
                    } else {
                        console.error(`[AntiSpam] Erreur : LOG_CHANNEL_ID (${logChannelId}) introuvable ou non texte`);
                    }
                } else {
                    console.error('[AntiSpam] Erreur : LOG_CHANNEL_ID non défini dans .env');
                }

                // Action si 3 warns
                if (warnCount >= spamSettings.warnThreshold) {
                    console.log(`[AntiSpam] 3e warn atteint pour ${message.author.tag}, isolation...`);

                    // Retirer tous les rôles sauf @everyone
                    const member = message.member;
                    const removedRoles = member.roles.cache
                        .filter(role => role.id !== message.guild.id)
                        .map(role => role.id);

                    if (removedRoles.length > 0 && member.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        await member.roles.set([message.guild.id]);
                        console.log(`[AntiSpam] Rôles retirés pour ${message.author.tag}: ${removedRoles.join(', ')}`);
                    } else {
                        console.error(`[AntiSpam] Permission ManageRoles manquante ou aucun rôle à retirer pour ${message.author.tag}`);
                    }

                    // Stocker les rôles retirés
                    await pool.query(
                        'INSERT INTO warn_removed_roles (guild_id, user_id, removed_roles) VALUES ($1, $2, $3) ' +
                        'ON CONFLICT (guild_id, user_id) DO UPDATE SET removed_roles = $3',
                        [message.guild.id, message.author.id, JSON.stringify(removedRoles)]
                    );
                    console.log(`[AntiSpam] Rôles retirés stockés pour ${message.author.tag}: ${removedRoles.join(', ')}`);

                    // Envoyer un message dans WARN_CHANNEL_ID pour le 3e warn
                    const warnChannelId = process.env.WARN_CHANNEL_ID;
                    if (warnChannelId) {
                        const warnChannel = message.client.channels.cache.get(warnChannelId);
                        if (warnChannel && warnChannel.isTextBased()) {
                            await warnChannel.send(
                                `<@${message.author.id}>, tu viens de recevoir ton troisième warn pour : Spam (${reason}).\nAu troisième warn, tu es désormais **isolé du serveur**. Un modérateur décidera de la suite.`
                            );
                            console.log(`[AntiSpam] Message envoyé dans WARN_CHANNEL_ID pour 3e warn de ${message.author.tag}`);
                        } else {
                            console.error(`[AntiSpam] Erreur : WARN_CHANNEL_ID (${warnChannelId}) introuvable ou non texte`);
                        }
                    } else {
                        console.error('[AntiSpam] Erreur : WARN_CHANNEL_ID non défini dans .env');
                    }
                }
            }
        } catch (error) {
            console.error('[AntiSpam] Erreur lors de l’action :', error.message, error.stack);
            if (logChannelId) {
                const logChannel = message.client.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    await logChannel.send(`[AntiSpam] Erreur lors de l’action : ${error.message}`);
                }
            }
        }
    }
};