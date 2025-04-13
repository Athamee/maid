// voiceStateUpdate.js
// Gérer l’XP vocal (sauf micro coupé), rôles vocaux, et renouvellement des canaux
const pool = require('../db');
const { PermissionsBitField, ChannelType } = require('discord.js');
const path = require('path');

// Configuration des images pour les montées de niveau
const levelUpImages = {
    10: path.join(__dirname, '../img/level10.png'),
    15: path.join(__dirname, '../img/level15.png'),
    20: path.join(__dirname, '../img/level20.png')
};
const defaultImage = path.join(__dirname, '../img/default.png');

const getLevelUpImage = (level) => {
    if (!level || level < 1) {
        console.warn(`Niveau invalide : ${level}, utilisation de l'image par défaut`);
        return defaultImage;
    }
    const image = levelUpImages[level];
    if (image) {
        console.log(`Niveau ${level} exact, image sélectionnée : ${image}`);
        return image;
    }
    console.log(`Niveau ${level} sans image spécifique, image par défaut : ${defaultImage}`);
    return defaultImage;
};

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
            // Récupérer les paramètres XP et rôles vocaux
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

            const member = await newState.guild.members.fetch(userId);

            // Vérifier les rôles exclus, incluant ARRIVANT_ROLE_ID et REGLEMENT_ACCEPTED_ROLE_ID
            if (
                (excludedRoles.length > 0 && excludedRoles.some(roleId => member.roles.cache.has(roleId))) ||
                member.roles.cache.has(process.env.ARRIVANT_ROLE_ID) ||
                member.roles.cache.has(process.env.REGLEMENT_ACCEPTED_ROLE_ID)
            ) {
                console.log(`[VoiceStateUpdate] Utilisateur ${member.user.tag} exclu de l’XP vocal (rôles : ${excludedRoles.join(', ')} ou Arrivant/Règlement)`);
                return;
            }
            console.log(`[VoiceStateUpdate] Aucun rôle exclu pour ${member.user.tag}`);

            // Récupérer les paramètres des rôles vocaux
            const voiceRoleResult = await pool.query(
                'SELECT voice_channel_id, role_id, text_channel_id FROM voice_role_settings WHERE guild_id = $1',
                [guildId]
            );
            const voiceRoleSettings = voiceRoleResult.rows;

            // Vérifier si l’utilisateur rejoint, quitte ou change de canal vocal
            if (!oldState.channelId && newState.channelId) {
                // Rejoint un vocal
                console.log(`[VoiceStateUpdate] ${member.user.tag} a rejoint le vocal ${newState.channel.name}`);

                // Attribuer le rôle vocal
                const voiceRole = voiceRoleSettings.find(setting => setting.voice_channel_id === newState.channelId);
                if (voiceRole) {
                    const botMember = newState.guild.members.me;
                    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        console.error(`[VoiceStateUpdate] Le bot manque la permission ManageRoles pour attribuer ${voiceRole.role_id}`);
                    } else {
                        await member.roles.add(voiceRole.role_id);
                        console.log(`[VoiceStateUpdate] Rôle ${voiceRole.role_id} ajouté à ${member.user.tag}`);
                    }
                }

                // Démarrer l’XP vocal si non muté
                // Changement : XP attribué dans tous les salons, sauf si muté
                if (!newState.selfMute) {
                    const startTime = Date.now();
                    const interval = setInterval(async () => {
                        try {
                            const currentState = newState.guild.members.cache.get(userId).voice;
                            if (!currentState || currentState.selfMute || !currentState.channelId) {
                                console.log(`[VoiceStateUpdate] Arrêt intervalle pour ${member.user.tag} : selfMute=${currentState?.selfMute}, channel=${currentState?.channelId}`);
                                clearInterval(interval);
                                newState.client.voiceIntervals.delete(userId);
                                return;
                            }

                            // Ajouter l’XP
                            console.log(`[VoiceStateUpdate] Insertion XP vocal pour ${member.user.tag} : ${voiceXpPerMin}`);
                            const userXpResult = await pool.query(
                                'INSERT INTO xp (guild_id, user_id, xp, level, last_message) VALUES ($1, $2, $3, 1, NOW()) ' +
                                'ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() RETURNING xp, level',
                                [guildId, userId, voiceXpPerMin]
                            );
                            let { xp, level } = userXpResult.rows[0];

                            // Log pour confirmer XP dans no_camera_channels
                            if (noCameraChannels.includes(currentState.channelId)) {
                                console.log(`[VoiceStateUpdate] XP vocal attribué dans salon no_camera ${currentState.channel.name} pour ${member.user.tag}`);
                            }

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

                                // Envoyer l’annonce avec image pour les milestones
                                const channelIdResult = await pool.query(
                                    'SELECT level_up_channel FROM xp_settings WHERE guild_id = $1',
                                    [guildId]
                                );
                                const channelId = channelIdResult.rows[0]?.level_up_channel;
                                const channel = channelId ? newState.guild.channels.cache.get(channelId) : newState.channel;

                                if (channel && channel.isTextBased()) {
                                    await channel.send({ content: messageContent, files: [getLevelUpImage(newLevel)] });
                                    console.log(`[VoiceStateUpdate] Niveau ${newLevel} annoncé pour ${member.user.tag} dans #${channel.name}`);
                                } else {
                                    console.log(`[VoiceStateUpdate] Impossible d’annoncer niveau ${newLevel} : channel=${channelId}`);
                                }
                            }
                        } catch (error) {
                            console.error(`[VoiceStateUpdate] Erreur intervalle pour ${member.user.tag} :`, error.message);
                            clearInterval(interval);
                            newState.client.voiceIntervals.delete(userId);
                        }
                    }, 60 * 1000); // Toutes les minutes

                    // Stocker l’intervalle
                    if (!newState.client.voiceIntervals) newState.client.voiceIntervals = new Map();
                    newState.client.voiceIntervals.set(userId, interval);
                    console.log(`[VoiceStateUpdate] Intervalle démarré pour ${member.user.tag}`);
                }
            } else if (oldState.channelId && !newState.channelId) {
                // Quitte le vocal
                console.log(`[VoiceStateUpdate] ${member.user.tag} a quitté le vocal ${oldState.channel.name}`);
                const interval = newState.client.voiceIntervals?.get(userId);
                if (interval) {
                    clearInterval(interval);
                    newState.client.voiceIntervals.delete(userId);
                    console.log(`[VoiceStateUpdate] Intervalle arrêté pour ${member.user.tag}`);
                }

                // Retirer le rôle vocal
                const voiceRole = voiceRoleSettings.find(setting => setting.voice_channel_id === oldState.channelId);
                if (voiceRole) {
                    const botMember = newState.guild.members.me;
                    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        console.error(`[VoiceStateUpdate] Le bot manque la permission ManageRoles pour retirer ${voiceRole.role_id}`);
                    } else {
                        await member.roles.remove(voiceRole.role_id);
                        console.log(`[VoiceStateUpdate] Rôle ${voiceRole.role_id} retiré de ${member.user.tag}`);
                    }
                }

                // Vérifier si le canal est vide and renouveler le canal textuel uniquement
                const oldChannel = oldState.channel;
                if (oldChannel && oldChannel.members.size === 0) {
                    const voiceRole = voiceRoleSettings.find(setting => setting.voice_channel_id === oldChannel.id);
                    if (voiceRole && voiceRole.text_channel_id) {
                        console.log(`[VoiceStateUpdate] Canal vocal ${oldChannel.name} vide, renouvellement du canal textuel...`);
                        const botMember = newState.guild.members.me;
                        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                            console.error(`[VoiceStateUpdate] Le bot manque la permission ManageChannels pour renouveler le canal textuel ${voiceRole.text_channel_id}`);
                            return;
                        }

                        // Supprimer l’ancien canal textuel s’il existe
                        const oldTextChannel = newState.guild.channels.cache.get(voiceRole.text_channel_id);
                        if (oldTextChannel) {
                            await oldTextChannel.delete('Canal textuel lié renouvelé');
                            console.log(`[VoiceStateUpdate] Canal textuel ${oldTextChannel.name} supprimé`);
                        } else {
                            console.log(`[VoiceStateUpdate] Aucun canal textuel trouvé pour text_channel_id=${voiceRole.text_channel_id}`);
                        }

                        // Créer un nouveau canal textuel
                        const newTextChannel = await newState.guild.channels.create({
                            name: `💬-${oldChannel.name}`,
                            type: ChannelType.GuildText,
                            parent: oldChannel.parentId,
                            permissionOverwrites: [
                                {
                                    id: newState.guild.id, // @everyone
                                    deny: [PermissionsBitField.Flags.ViewChannel],
                                },
                                {
                                    id: voiceRole.role_id, // Rôle associé
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ReadMessageHistory,
                                        PermissionsBitField.Flags.AddReactions,
                                        PermissionsBitField.Flags.AttachFiles,
                                        PermissionsBitField.Flags.EmbedLinks,
                                        PermissionsBitField.Flags.UseExternalEmojis,
                                    ],
                                },
                                {
                                    id: newState.client.user.id, // Bot
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.ManageChannels,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ReadMessageHistory,
                                    ],
                                },
                            ],
                        });
                        console.log(`[VoiceStateUpdate] Nouveau canal textuel ${newTextChannel.name} créé avec rôle ${voiceRole.role_id}`);

                        // Mettre à jour voice_role_settings avec le nouvel ID du canal textuel
                        await pool.query(
                            'UPDATE voice_role_settings SET text_channel_id = $3 WHERE guild_id = $1 AND voice_channel_id = $2',
                            [guildId, oldChannel.id, newTextChannel.id]
                        );
                        console.log(`[VoiceStateUpdate] voice_role_settings mis à jour : text_channel_id=${newTextChannel.id}`);
                    }
                }
            }
        } catch (error) {
            console.error(`[VoiceStateUpdate] Erreur pour ${userId} :`, error.message, error.stack);
        }
    },
};