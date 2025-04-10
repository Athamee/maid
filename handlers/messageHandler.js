const pool = require('../db');

// Stocke les timers pour l’XP vocal par utilisateur et serveur
const voiceTimers = new Map();

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
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
    // Ajoute d’autres mots-clés et emojis ici selon tes besoins
};

module.exports = (client) => {
    // XP et réactions pour les messages écrits et images
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        const content = message.content.toLowerCase(); // Insensible à la casse

        // Gestion des réactions aux mots-clés
        for (const [trigger, emoji] of Object.entries(reactionTriggers)) {
            if (content.includes(trigger)) {
                try {
                    await message.react(emoji);
                } catch (error) {
                    console.error(`Erreur lors de l’ajout de la réaction ${emoji} :`, error.stack);
                }
            }
        }

        // Gestion des XP
        try {
            const settingsResult = await pool.query(
                'SELECT * FROM xp_settings WHERE guild_id = $1',
                [guildId]
            );
            const settings = settingsResult.rows[0] || {
                message_xp: 10,
                image_xp: 15
            };

            const lastMessageResult = await pool.query(
                'SELECT last_message FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            const lastMessage = lastMessageResult.rows[0]?.last_message;
            if (lastMessage && (Date.now() - new Date(lastMessage).getTime()) < 60000) return;

            let xpToAdd = settings.message_xp;
            if (message.attachments.size > 0) xpToAdd += settings.image_xp;

            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() ' +
                'RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level;

            while (newXp >= getRequiredXp(newLevel + 1)) {
                newLevel++;
            }

            if (newLevel !== rows[0].level) {
                await pool.query(
                    'UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
                await message.channel.send(`🎉 ${message.author} est passé au niveau ${newLevel} !`);
            }
        } catch (error) {
            console.error('Erreur lors de l’ajout d’XP pour message/image :', error.stack);
        }
    });

    // XP pour les réactions
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot || !reaction.message.guild) return;

        const userId = user.id;
        const guildId = reaction.message.guild.id;

        try {
            const settingsResult = await pool.query(
                'SELECT reaction_xp FROM xp_settings WHERE guild_id = $1',
                [guildId]
            );
            const settings = settingsResult.rows[0] || { reaction_xp: 2 };

            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp) VALUES ($1, $2, $3) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3 ' +
                'RETURNING xp, level',
                [userId, guildId, settings.reaction_xp]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level;

            while (newXp >= getRequiredXp(newLevel + 1)) {
                newLevel++;
            }

            if (newLevel !== rows[0].level) {
                await pool.query(
                    'UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
                await reaction.message.channel.send(`🎉 ${user} est passé au niveau ${newLevel} grâce à une réaction !`);
            }
        } catch (error) {
            console.error('Erreur lors de l’ajout d’XP pour réaction :', error.stack);
        }
    });

    // XP pour le temps en vocal
    client.on('voiceStateUpdate', (oldState, newState) => {
        const userId = newState.member?.id || oldState.member?.id;
        const guildId = newState.guild?.id || oldState.guild?.id;

        if (!userId || !guildId) return;

        const key = `${userId}-${guildId}`;

        if (!oldState.channel && newState.channel) {
            const timer = setInterval(async () => {
                try {
                    const settingsResult = await pool.query(
                        'SELECT voice_xp_per_min FROM xp_settings WHERE guild_id = $1',
                        [guildId]
                    );
                    const settings = settingsResult.rows[0] || { voice_xp_per_min: 5 };

                    const { rows } = await pool.query(
                        'INSERT INTO xp (user_id, guild_id, xp) VALUES ($1, $2, $3) ' +
                        'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3 ' +
                        'RETURNING xp, level',
                        [userId, guildId, settings.voice_xp_per_min]
                    );

                    let newXp = rows[0].xp;
                    let newLevel = rows[0].level;

                    while (newXp >= getRequiredXp(newLevel + 1)) {
                        newLevel++;
                    }

                    if (newLevel !== rows[0].level) {
                        await pool.query(
                            'UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                            [newLevel, userId, guildId]
                        );
                        const channel = newState.channel;
                        if (channel) {
                            await channel.send(`🎉 <@${userId}> est passé au niveau ${newLevel} en vocal !`);
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de l’ajout d’XP vocal :', error.stack);
                }
            }, 60000);
            voiceTimers.set(key, timer);
        }

        if (oldState.channel && !newState.channel) {
            const timer = voiceTimers.get(key);
            if (timer) {
                clearInterval(timer);
                voiceTimers.delete(key);
            }
        }
    });
};