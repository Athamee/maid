const pool = require('../db');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

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
};

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

const getLevelUpMessage = async (guildId, level) => {
    const customMessageResult = await pool.query(
        'SELECT message FROM level_up_messages WHERE guild_id = $1 AND level = $2',
        [guildId, level]
    );
    if (customMessageResult.rows.length > 0) {
        return customMessageResult.rows[0].message;
    }

    const settingsResult = await pool.query(
        'SELECT default_level_message FROM xp_settings WHERE guild_id = $1',
        [guildId]
    );
    const defaultMessage = settingsResult.rows[0]?.default_level_message || '🎉 Niveau {level}, {user} ! Continue comme ça !';
    return defaultMessage.replace('{level}', level);
};

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        const member = message.member;
        const content = message.content.toLowerCase();

        // Ajout des réactions automatiques
        for (const [trigger, emoji] of Object.entries(reactionTriggers)) {
            if (content.includes(trigger)) {
                try { await message.react(emoji); } catch (error) { console.error(`Erreur réaction ${emoji} :`, error.stack); }
            }
        }

        try {
            const settingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
            const settings = settingsResult.rows[0] || {
                message_xp: 10,
                image_xp: 15,
                level_up_channel: null,
                excluded_roles: '[]'
            };
            const excludedRoles = JSON.parse(settings.excluded_roles);

            // Vérifier les rôles exclus
            if (member.roles.cache.some(role => excludedRoles.includes(role.id))) {
                console.log(`[MessageHandler] Utilisateur ${member.user.tag} exclu de l’XP (rôles : ${excludedRoles.join(', ')})`);
                return;
            }

            // Vérification du cooldown (1 minute)
            const lastMessageResult = await pool.query('SELECT last_message FROM xp WHERE user_id = $1 AND guild_id = $2', [userId, guildId]);
            const lastMessage = lastMessageResult.rows[0]?.last_message;
            if (lastMessage && (Date.now() - new Date(lastMessage).getTime()) < 60000) return;

            let xpToAdd = settings.message_xp;
            if (message.attachments.size > 0) xpToAdd += settings.image_xp;

            // Mise à jour de l’XP et de last_message
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level || 1;

            // Gestion des montées de niveau
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
            console.error('Erreur XP message/image :', error.stack);
        }
    });
};