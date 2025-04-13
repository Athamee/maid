// rotateMessage.js
// Toutes les 24h, copie le message le plus ancien d’un salon spécifique et le reposte, puis supprime l’original
const { Client, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
const pool = require('../db');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log('[RotateMessage] Initialisation de la rotation des messages');

        // Planifier la tâche toutes les 24h à minuit UTC
        cron.schedule('0 0 * * *', async () => {
            console.log('[RotateMessage] Exécution de la rotation des messages');

            const channelId = process.env.MESSAGE_ROTATE_CHANNEL_ID;
            if (!channelId) {
                console.error('[RotateMessage] Erreur : MESSAGE_ROTATE_CHANNEL_ID non défini dans .env');
                return;
            }

            try {
                // Récupérer le salon
                const channel = await client.channels.fetch(channelId);
                if (!channel || !channel.isTextBased()) {
                    console.error(`[RotateMessage] Erreur : Salon ${channelId} introuvable ou non texte`);
                    return;
                }

                // Vérifier les permissions
                const botMember = channel.guild.members.me;
                const requiredPerms = [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ManageMessages
                ];
                if (!botMember.permissionsIn(channel).has(requiredPerms)) {
                    console.error(`[RotateMessage] Permissions manquantes dans ${channel.name} :`, requiredPerms);
                    return;
                }

                // Récupérer le message le plus ancien
                const messages = await channel.messages.fetch({ limit: 1, after: '0' });
                const oldestMessage = messages.first();

                if (!oldestMessage) {
                    console.log(`[RotateMessage] Aucun message trouvé dans ${channel.name}`);
                    return;
                }

                // Ignorer les messages de bots
                if (oldestMessage.author.bot) {
                    console.log(`[RotateMessage] Message de bot ignoré dans ${channel.name}`);
                    return;
                }

                console.log(`[RotateMessage] Message le plus ancien trouvé dans ${channel.name} : ${oldestMessage.id}, auteur=${oldestMessage.author.tag}`);

                // Copier le contenu
                const newMessageContent = {
                    content: oldestMessage.content || null,
                    embeds: oldestMessage.embeds.length > 0 ? oldestMessage.embeds : [],
                    // Fichiers non inclus pour l’instant (à confirmer)
                };

                // Poster le nouveau message
                const newMessage = await channel.send(newMessageContent);
                console.log(`[RotateMessage] Nouveau message posté dans ${channel.name} : ${newMessage.id}`);

                // Supprimer l’ancien message
                await oldestMessage.delete();
                console.log(`[RotateMessage] Ancien message ${oldestMessage.id} supprimé dans ${channel.name}`);

                // Loguer dans un canal de logs (optionnel, si défini)
                const logChannelId = process.env.LOG_MESSAGES_ID;
                if (logChannelId) {
                    const logChannel = client.channels.cache.get(logChannelId);
                    if (logChannel && logChannel.isTextBased()) {
                        await logChannel.send(`[RotateMessage] Message ${oldestMessage.id} de ${oldestMessage.author.tag} rotaté dans <#${channelId}>. Nouveau message : ${newMessage.id}`);
                        console.log(`[RotateMessage] Log envoyé dans ${logChannel.name}`);
                    }
                }
            } catch (error) {
                console.error(`[RotateMessage] Erreur lors de la rotation dans ${channelId} :`, error.message, error.stack);
                const logChannelId = process.env.LOG_MESSAGES_ID;
                if (logChannelId) {
                    const logChannel = client.channels.cache.get(logChannelId);
                    if (logChannel && logChannel.isTextBased()) {
                        await logChannel.send(`[RotateMessage] Erreur : ${error.message}`);
                    }
                }
            }
        }, {
            scheduled: true,
            timezone: 'UTC'
        });

        console.log('[RotateMessage] Tâche de rotation planifiée à minuit UTC');
    },
};