// messageReactionAdd.js
// Gérer les réactions pour attribuer l’XP
const pool = require('../db');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        if (user.bot || !reaction.message.guild) {
            console.log(`[MessageReactionAdd] Ignoré : bot=${user.bot}, guild=${!!reaction.message.guild}, user=${user.tag}`);
            return;
        }

        console.log(`[MessageReactionAdd] Réaction ajoutée par ${user.tag} sur un message dans #${reaction.message.channel.name}`);

        try {
            const guildId = reaction.message.guild.id;
            const userId = user.id;

            // Récupérer les paramètres XP
            console.log(`[MessageReactionAdd] Récupération xp_settings pour guild ${guildId}`);
            const xpSettingsResult = await pool.query(
                'SELECT reaction_xp, excluded_roles FROM xp_settings WHERE guild_id = $1',
                [guildId]
            );
            const xpSettings = xpSettingsResult.rows[0] || {
                reaction_xp: 2,
                excluded_roles: '[]'
            };

            const reactionXp = xpSettings.reaction_xp || 2;
            const excludedRoles = JSON.parse(xpSettings.excluded_roles || '[]');

            console.log(`[MessageReactionAdd] Paramètres : reaction_xp=${reactionXp}, excluded_roles=${excludedRoles}`);

            // Vérifier les rôles exclus, incluant ARRIVANT_ROLE_ID et REGLEMENT_ACCEPTED_ROLE_ID
            const member = await reaction.message.guild.members.fetch(userId);
            if (
                (excludedRoles.length > 0 && excludedRoles.some(roleId => member.roles.cache.has(roleId))) ||
                member.roles.cache.has(process.env.ARRIVANT_ROLE_ID) ||
                member.roles.cache.has(process.env.REGLEMENT_ACCEPTED_ROLE_ID)
            ) {
                console.log(`[MessageReactionAdd] Utilisateur ${user.tag} exclu de l’XP (rôles : ${excludedRoles.join(', ')} ou Arrivant/Règlement)`);
                return;
            }
            console.log(`[MessageReactionAdd] Aucun rôle exclu pour ${user.tag}`);

            // Mettre à jour l’XP
            console.log(`[MessageReactionAdd] Insertion XP pour ${user.tag} : ${reactionXp}`);
            const userXpResult = await pool.query(
                'INSERT INTO xp (guild_id, user_id, xp, level, last_message) VALUES ($1, $2, $3, 1, NOW()) ' +
                'ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = xp.xp + $3 RETURNING xp, level',
                [guildId, userId, reactionXp]
            );
            let { xp, level } = userXpResult.rows[0];

            console.log(`[MessageReactionAdd] XP ajouté à ${user.tag} : +${reactionXp}, total=${xp}, level=${level}`);

            // Calculer le nouveau niveau
            const getRequiredXp = (lvl) => 1000 + Math.pow(lvl - 1, 2) * 400;
            const xpForNextLevel = getRequiredXp(level + 1);
            if (xp >= xpForNextLevel) {
                const newLevel = level + 1;
                console.log(`[MessageReactionAdd] Nouveau niveau ${newLevel} pour ${user.tag}`);
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
                const channel = channelId ? reaction.message.guild.channels.cache.get(channelId) : reaction.message.channel;

                if (channel && channel.isTextBased()) {
                    await channel.send({ content: messageContent });
                    console.log(`[MessageReactionAdd] Niveau ${newLevel} annoncé pour ${user.tag} dans #${channel.name}`);
                } else {
                    console.log(`[MessageReactionAdd] Impossible d’annoncer niveau ${newLevel} : channel=${channelId}`);
                }
            }
        } catch (error) {
            console.error(`[MessageReactionAdd] Erreur pour ${user.tag} :`, error.message, error.stack);
        }
    },
};