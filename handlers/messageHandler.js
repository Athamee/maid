const pool = require('../db'); // Importe le pool de connexion à la base de données PostgreSQL
const path = require('path'); // Importe le module path pour gérer les chemins de fichiers

const voiceTimers = new Map(); // Map pour stocker les timers des utilisateurs en vocal
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400; // Formule pour calculer l’XP requis pour passer au niveau suivant

// Liste des mots-clés et leurs réactions
const reactionTriggers = {
    'bonjour': '🌞',
    'nuit': '🌠',
    'salut': '😊',
    'hello': '🙃',
    'merci': '🙏',
    'bravo': '👏',
    'lol': '😂',
    'cool': '😎'
    // Ajoute d’autres mots-clés et emojis ici selon tes besoins
};

// Chemins des images associées aux niveaux spéciaux et image par défaut
const levelUpImages = {
    5: path.join(__dirname, '../img/level5.png'),
    10: path.join(__dirname, '../img/level10.png'),
    20: path.join(__dirname, '../img/level20.png')
};
const defaultImage = path.join(__dirname, '../img/default.png');

// Fonction pour sélectionner l’image appropriée en fonction du niveau atteint
const getLevelUpImage = (level) => {
    const levels = Object.keys(levelUpImages).map(Number).sort((a, b) => b - a); // Trie les niveaux par ordre décroissant
    for (const l of levels) {
        if (level >= l) return levelUpImages[l]; // Retourne l’image du plus haut niveau atteint
    }
    return defaultImage; // Sinon, retourne l’image par défaut
};

// Fonction pour récupérer le message de montée de niveau (personnalisé ou par défaut)
const getLevelUpMessage = async (guildId, level) => {
    const customMessageResult = await pool.query(
        'SELECT message FROM level_up_messages WHERE guild_id = $1 AND level = $2',
        [guildId, level]
    );
    if (customMessageResult.rows.length > 0) {
        return customMessageResult.rows[0].message; // Retourne un message personnalisé s’il existe
    }

    const settingsResult = await pool.query(
        'SELECT default_level_message FROM xp_settings WHERE guild_id = $1',
        [guildId]
    );
    const defaultMessage = settingsResult.rows[0]?.default_level_message || '🎉 Niveau {level}, {user} ! Continue comme ça !';
    return defaultMessage.replace('{level}', level); // Remplace {level} par la valeur actuelle
};

// Exporte le gestionnaire d’événements pour le client Discord
module.exports = (client) => {
    // Événement déclenché à chaque nouveau message
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return; // Ignore les bots et les messages hors serveurs

        const userId = message.author.id; // ID de l’auteur du message
        const guildId = message.guild.id; // ID du serveur
        const member = message.member; // Membre du serveur
        const content = message.content.toLowerCase(); // Contenu du message en minuscules

        // Ajoute des réactions automatiques selon les mots-clés
        for (const [trigger, emoji] of Object.entries(reactionTriggers)) {
            if (content.includes(trigger)) {
                try { await message.react(emoji); } catch (error) { console.error(`Erreur réaction ${emoji} :`, error.stack); }
            }
        }

        try {
            // Récupère les paramètres XP du serveur
            const settingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
            const settings = settingsResult.rows[0] || {
                message_xp: 10,
                image_xp: 15,
                level_up_channel: null,
                excluded_roles: '[]'
            };
            const excludedRoles = JSON.parse(settings.excluded_roles); // Liste des rôles exclus

            if (member.roles.cache.some(role => excludedRoles.includes(role.id))) return; // Ignore si le membre a un rôle exclu

            // Vérifie le cooldown de 60 secondes pour les messages
            const lastMessageResult = await pool.query('SELECT last_message FROM xp WHERE user_id = $1 AND guild_id = $2', [userId, guildId]);
            const lastMessage = lastMessageResult.rows[0]?.last_message;
            if (lastMessage && (Date.now() - new Date(lastMessage).getTime()) < 60000) return;

            let xpToAdd = settings.message_xp; // XP de base pour un message
            if (message.attachments.size > 0) xpToAdd += settings.image_xp; // Ajoute de l’XP pour les images

            // Met à jour ou insère l’XP dans la base de données
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            let newXp = rows[0].xp; // Nouvel XP total (corrigé : "new XP" -> "newXp")
            let newLevel = rows[0].level; // Niveau actuel

            // Vérifie si le membre passe un niveau
            while (newXp >= getRequiredXp(newLevel + 1)) {
                newLevel++;
                if (newLevel !== rows[0].level) {
                    await pool.query('UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3', [newLevel, userId, guildId]);
                    if (settings.level_up_channel) {
                        const channel = client.channels.cache.get(settings.level_up_channel);
                        if (channel) {
                            const messageTemplate = await getLevelUpMessage(guildId, newLevel);
                            const formattedMessage = messageTemplate.replace('{user}', `<@${userId}>`);
                            const imagePath = getLevelUpImage(newLevel);
                            await channel.send({ content: formattedMessage, files: [imagePath] }); // Envoie le message de niveau
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erreur XP message/image :', error.stack);
        }
    });

    // Événement déclenché lorsqu’une réaction est ajoutée
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot || !reaction.message.guild) return; // Ignore les bots et les réactions hors serveurs

        const userId = user.id;
        const guildId = reaction.message.guild.id;
        const member = reaction.message.guild.members.cache.get(userId);

        try {
            const settingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
            const settings = settingsResult.rows[0] || { reaction_xp: 2, level_up_channel: null, excluded_roles: '[]' };
            const excludedRoles = JSON.parse(settings.excluded_roles);

            if (member.roles.cache.some(role => excludedRoles.includes(role.id))) return;

            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp) VALUES ($1, $2, $3) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3 RETURNING xp, level',
                [userId, guildId, settings.reaction_xp]
            );

            let newXp = rows[0].xp; // Nouvel XP total
            let newLevel = rows[0].level;

            while (newXp >= getRequiredXp(newLevel + 1)) {
                newLevel++;
                if (newLevel !== rows[0].level) {
                    await pool.query('UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3', [newLevel, userId, guildId]);
                    if (settings.level_up_channel) {
                        const channel = client.channels.cache.get(settings.level_up_channel);
                        if (channel) {
                            const messageTemplate = await getLevelUpMessage(guildId, newLevel);
                            const formattedMessage = messageTemplate.replace('{user}', `<@${userId}>`);
                            const imagePath = getLevelUpImage(newLevel);
                            await channel.send({ content: formattedMessage, files: [imagePath] });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erreur XP réaction :', error.stack);
        }
    });

    // Événement déclenché lors d’un changement d’état vocal
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const userId = newState.member?.id || oldState.member?.id;
        const guildId = newState.guild?.id || oldState.guild?.id;

        if (!userId || !guildId) return; // Ignore si pas d’ID utilisateur ou serveur

        const key = `${userId}-${guildId}`; // Clé unique pour le timer vocal
        const member = newState.member || oldState.member;

        const settingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
        const settings = settingsResult.rows[0] || { no_camera_channels: '[]', voice_xp_per_min: 5, level_up_channel: null, excluded_roles: '[]' };
        const noCameraChannels = JSON.parse(settings.no_camera_channels);
        const excludedRoles = JSON.parse(settings.excluded_roles);

        const voiceRoleResult = await pool.query('SELECT * FROM voice_role_settings WHERE guild_id = $1 AND voice_channel_id = $2', 
            [guildId, newState.channel?.id || oldState.channel?.id]);
        const voiceRoleSettings = voiceRoleResult.rows[0];

        // Désactive la caméra si interdite dans ce salon
        if (newState.channel && noCameraChannels.includes(newState.channel.id) && newState.selfVideo) {
            await newState.setSelfVideo(false);
        }

        // Quand un utilisateur entre dans un salon vocal
        if (!oldState.channel && newState.channel) {
            if (voiceRoleSettings) {
                await member.roles.add(voiceRoleSettings.role_id); // Ajoute le rôle associé
            }
            if (!newState.selfMute && !member.roles.cache.some(role => excludedRoles.includes(role.id))) {
                const timer = setInterval(async () => {
                    try {
                        const memberVoiceState = newState.channel?.members.get(userId);
                        if (!memberVoiceState || memberVoiceState.selfMute || member.roles.cache.some(role => excludedRoles.includes(role.id))) return;

                        const { rows } = await pool.query(
                            'INSERT INTO xp (user_id, guild_id, xp) VALUES ($1, $2, $3) ' +
                            'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3 RETURNING xp, level',
                            [userId, guildId, settings.voice_xp_per_min]
                        );

                        let newXp = rows[0].xp; // Nouvel XP total (corrigé ici aussi)
                        let newLevel = rows[0].level;

                        while (newXp >= getRequiredXp(newLevel + 1)) {
                            newLevel++;
                            if (newLevel !== rows[0].level) {
                                await pool.query('UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3', [newLevel, userId, guildId]);
                                if (settings.level_up_channel) {
                                    const channel = client.channels.cache.get(settings.level_up_channel);
                                    if (channel) {
                                        const messageTemplate = await getLevelUpMessage(guildId, newLevel);
                                        const formattedMessage = messageTemplate.replace('{user}', `<@${userId}>`);
                                        const imagePath = getLevelUpImage(newLevel);
                                        await channel.send({ content: formattedMessage, files: [imagePath] });
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Erreur XP vocal :', error.stack);
                    }
                }, 60000); // Timer toutes les 60 secondes
                voiceTimers.set(key, timer);
            }
        }

        // Quand un utilisateur quitte un salon vocal
        if (oldState.channel && !newState.channel) {
            if (voiceRoleSettings) {
                await member.roles.remove(voiceRoleSettings.role_id); // Retire le rôle associé
                const voiceChannel = client.channels.cache.get(voiceRoleSettings.voice_channel_id);
                if (voiceChannel.members.size === 0) {
                    const textChannel = client.channels.cache.get(voiceRoleSettings.text_channel_id);
                    if (textChannel) {
                        await textChannel.delete(); // Supprime le canal texte s’il est vide
                        const newTextChannel = await oldState.guild.channels.create({
                            name: `vocal-${voiceChannel.name}`,
                            type: 0,
                            permissionOverwrites: [
                                { id: guildId, deny: ['VIEW_CHANNEL'] },
                                { id: voiceRoleSettings.role_id, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] }
                            ]
                        });
                        await pool.query(
                            'UPDATE voice_role_settings SET text_channel_id = $1 WHERE guild_id = $2 AND voice_channel_id = $3',
                            [newTextChannel.id, guildId, voiceRoleSettings.voice_channel_id]
                        );
                    }
                }
            }
            const timer = voiceTimers.get(key);
            if (timer) {
                clearInterval(timer); // Arrête le timer
                voiceTimers.delete(key);
            }
        }
    });
};