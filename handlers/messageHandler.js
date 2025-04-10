const pool = require('../db');

// Stocke les timers pour l’XP vocal par utilisateur et serveur
const voiceTimers = new Map();

module.exports = (client) => {
    // XP pour les messages écrits et images
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const guildId = message.guild.id;

        try {
            // Récupère les paramètres d’XP pour ce serveur
            const settingsResult = await pool.query(
                'SELECT * FROM xp_settings WHERE guild_id = $1',
                [guildId]
            );
            const settings = settingsResult.rows[0] || {
                message_xp: 10,
                image_xp: 15
            };

            // Vérifie le cooldown (1 min)
            const lastMessageResult = await pool.query(
                'SELECT last_message FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            const lastMessage = lastMessageResult.rows[0]?.last_message;
            if (lastMessage && (Date.now() - new Date(lastMessage).getTime()) < 60000) return;

            // Calcule l’XP à ajouter
            let xpToAdd = settings.message_xp;
            if (message.attachments.size > 0) xpToAdd += settings.image_xp; // Bonus pour les images

            // Met à jour l’XP
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() ' +
                'RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            const newXp = rows[0].xp;
            let newLevel = rows[0].level;
            const requiredXp = newLevel * 100;

            if (newXp >= requiredXp) {
                newLevel++;
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

            const newXp = rows[0].xp;
            let newLevel = rows[0].level;
            const requiredXp = newLevel * 100;

            if (newXp >= requiredXp) {
                newLevel++;
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

        // Si l’utilisateur rejoint un canal vocal
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

                    const newXp = rows[0].xp;
                    let newLevel = rows[0].level;
                    const requiredXp = newLevel * 100;

                    if (newXp >= requiredXp) {
                        newLevel++;
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
            }, 60000); // Toutes les minutes
            voiceTimers.set(key, timer);
        }

        // Si l’utilisateur quitte le vocal
        if (oldState.channel && !newState.channel) {
            const timer = voiceTimers.get(key);
            if (timer) {
                clearInterval(timer);
                voiceTimers.delete(key);
            }
        }
    });
};