// voiceStateUpdate.js
// Gérer l’XP vocal (sauf micro coupé)
const pool = require('../db');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const userId = newState.id;
        const guildId = newState.guild.id;

        // Ignorer les bots
        if (newState.member.user.bot) {
            console.log(`[VoiceStateUpdate] Ignoré : bot=${newState.member.user.bot}, user=${newState.member.user.tag}`);
            return;
        }

        console.log(`[VoiceStateUpdate] État vocal changé pour ${newState.member.user.tag} : oldChannel=${oldState.channelId}, newChannel=${newState.channelId}, selfMute=${newState.selfMute}`);

        try {
            // Récupérer les paramètres XP
            console.log(`[VoiceStateUpdate] Récupération xp_settings pour guild ${guildId}`);
            const xpSettingsResult = await pool.query(
                'SELECT voice_xp_per_min, excluded_roles, no_camera_channels FROM xp_settings WHERE guild_id = $1',
                [guildId]
            );
            const xpSettings = xpSettingsResult.rows[0] || {
                voice_xp_per_min: 5,
                excluded_roles: '[]',
                no_camera_channels: '[]'
            };

            const voiceXpPerMin = xpSettings.voice_xp_per_min || 5;
            const excludedRoles = JSON.parse(xpSettings.excluded_roles || '[]');
            const noCameraChannels = JSON.parse(xpSettings.no_camera_channels || '[]');

            console.log(`[VoiceStateUpdate] Paramètres : voice_xp_per_min=${voiceXpPerMin}, excluded_roles=${excludedRoles}, no_camera_channels=${noCameraChannels}`);

            // Vérifier les rôles exclus
            const member = await newState.guild.members.fetch(userId);
            if (excludedRoles.length > 0 && excludedRoles.some(roleId => member.roles.cache.has(roleId))) {
                console.log(`[VoiceStateUpdate] Utilisateur ${member.user.tag} exclu de l’XP vocal (rôles : ${excludedRoles.join(', ')})`);
                return;
            }
            console.log(`[VoiceStateUpdate] Aucun rôle exclu pour ${member.user.tag}`);

            // Vérifier si l’utilisateur rejoint ou quitte un vocal
            if (!oldState.channelId && newState.channelId && !newState.selfMute) {
                // Rejoint un vocal, démarrer le timer
                console.log(`[VoiceStateUpdate] ${member.user.tag} a rejoint le vocal ${newState.channel.name}`);
                const startTime = Date.now();
                const interval = setInterval(async () => {
                    try {
                        const currentState = newState.guild.members.cache.get(userId).voice;
                        if (!currentState || currentState.selfMute || !currentState.channelId) {
                            console.log(`[VoiceStateUpdate] Arrêt intervalle pour ${member.user.tag} : selfMute=${currentState?.selfMute}, channel=${currentState?.channelId}`);
                            clearInterval(interval);
                            return;
                        }

                        // Ajouter l’XP
                        console.log(`[VoiceStateUpdate] Insertion XP vocal pour ${member.user.tag} : ${voiceXpPerMin}`);
                        const userXpResult = await pool.query(
                            'INSERT INTO xp (guild_id, user_id, xp, level, last_message) VALUES ($1, $2, $3, 1, NOW()) ' +
                            'ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = xp.xp + $3 RETURNING xp, level',
                            [guildId, userId, voiceXpPerMin]
                        );
                        let { xp, level } = userXpResult.rows[0];

                        console.log(`[VoiceStateUpdate] XP vocal ajouté à ${member.user.tag} : +${voiceXpPerMin}, total=${xp}, level=${level}`);

                        // Calculer le nouveau niveau
                        const getRequiredXp = (lvl) => 1000 + Math.pow(lvl - 1, 2) * 400;
                        const xpForNextLevel = getRequiredXp(level + 1);
                        if (xp >= xpForNextLevel) {
                            const newLevel = level + 1;
                            console.log(`[VoiceStateUpdate] Nouveau niveau ${newLevel} pour ${member.user.tag}`);
                            await pool.query(
                                'UPDATE xp SET level = $3 WHERE guild_id = $1 AND user_id = $2',
                                [guildId, userId, newLevel]
                            );

                            // Récupérer le message de niveau
                            const levelMessageResult = await pool.query(
                                'SELECT message FROM level_up_messages WHERE guild_id = $1 AND level = $2',
                                [guildId, newLevel]
                            );
                            let messageContent = levelMessageResult.rows[0]?.message;

                            if (!messageContent) {
                                const defaultMessageResult = await pool.query(
                                    'SELECT default_level_message FROM xp_settings WHERE guild_id = $1',
                                    [guildId]
                                );
                                messageContent = defaultMessageResult.rows[0]?.default_level_message ||
                                    'Félicitations {user}, tu es désormais niveau {level} ! Continue d’explorer tes désirs intimes sur le Donjon. 😈';
                            }

                            messageContent = messageContent
                                .replace('{user}', `<@${userId}>`)
                                .replace('{level}', newLevel);

                            // Envoyer l’annonce
                            const channelIdResult = await pool.query(
                                'SELECT level_up_channel FROM xp_settings WHERE guild_id = $1',
                                [guildId]
                            );
                            const channelId = channelIdResult.rows[0]?.level_up_channel;
                            const channel = channelId ? newState.guild.channels.cache.get(channelId) : newState.channel;

                            if (channel && channel.isTextBased()) {
                                await channel.send({ content: messageContent });
                                console.log(`[VoiceStateUpdate] Niveau ${newLevel} annoncé pour ${member.user.tag} dans #${channel.name}`);
                            } else {
                                console.log(`[VoiceStateUpdate] Impossible d’annoncer niveau ${newLevel} : channel=${channelId}`);
                            }
                        }
                    } catch (error) {
                        console.error(`[VoiceStateUpdate] Erreur intervalle pour ${member.user.tag} :`, error.message);
                        clearInterval(interval);
                    }
                }, 60 * 1000); // Toutes les minutes

                // Stocker l’intervalle
                if (!newState.client.voiceIntervals) newState.client.voiceIntervals = new Map();
                newState.client.voiceIntervals.set(userId, interval);
                console.log(`[VoiceStateUpdate] Intervalle démarré pour ${member.user.tag}`);
            } else if (oldState.channelId && !newState.channelId) {
                // Quitte le vocal, arrêter le timer
                console.log(`[VoiceStateUpdate] ${member.user.tag} a quitté le vocal ${oldState.channel.name}`);
                const interval = newState.client.voiceIntervals?.get(userId);
                if (interval) {
                    clearInterval(interval);
                    newState.client.voiceIntervals.delete(userId);
                    console.log(`[VoiceStateUpdate] Intervalle arrêté pour ${member.user.tag}`);
                }
            }
        } catch (error) {
            console.error(`[VoiceStateUpdate] Erreur pour ${userId} :`, error.message, error.stack);
        }
    },
};