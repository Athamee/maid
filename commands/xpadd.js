const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');
const path = require('path');

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

// Configuration des images pour les montées de niveau
const levelUpImages = {
    10: path.join(__dirname, '../img/level10.png'),
    15: path.join(__dirname, '../img/level15.png'),
    20: path.join(__dirname, '../img/level20.png')
};
const defaultImage = path.join(__dirname, '../img/default.png');

const getLevelUpImage = (level) => {
    const levels = Object.keys(levelUpImages).map(Number).sort((a, b) => b - a);
    for (const l of levels) {
        if (level >= l) return levelUpImages[l];
    }
    return defaultImage;
};

// Fonction pour récupérer le message de montée de niveau
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpadd')
        .setDescription('Ajouter de l’XP à un membre (admin & animateur)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Membre à modifier')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('xp')
                .setDescription('Quantité d’XP à ajouter')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const animatorRoleId = process.env.ANIMATOR;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);
        const hasAnimatorRole = animatorRoleId && interaction.member.roles.cache.has(animatorRoleId);

        // Reporter la réponse pour éviter Unknown Interaction
        await interaction.deferReply();

        if (!isAdmin && !hasModoRole && !hasAnimatorRole) {
            return interaction.editReply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const xpToAdd = interaction.options.getInteger('xp');

        const guildId = interaction.guild.id;
        const userId = target.id;

        try {
            // Récupérer le niveau initial du membre
            const initialResult = await pool.query(
                'SELECT level, xp FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            const initialLevel = initialResult.rows[0]?.level || 1;
            const initialXp = initialResult.rows[0]?.xp || 0;

            // Mise à jour de l’XP et de last_message
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() ' +
                'RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level || 1;

            // Recalculer le niveau basé sur l’XP total
            let recalculatedLevel = 1;
            while (newXp >= getRequiredXp(recalculatedLevel + 1)) {
                recalculatedLevel++;
            }

            if (recalculatedLevel !== newLevel) {
                newLevel = recalculatedLevel;
                await pool.query(
                    'UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
            }

            // Calculer l’XP restant pour le prochain niveau
            const xpForNextLevel = getRequiredXp(newLevel + 1);
            const xpRemaining = xpForNextLevel - newXp;

            // Vérifier si le niveau a augmenté et envoyer le message pour le dernier niveau uniquement
            if (newLevel > initialLevel) {
                const settingsResult = await pool.query(
                    'SELECT level_up_channel FROM xp_settings WHERE guild_id = $1',
                    [guildId]
                );
                const levelUpChannelId = settingsResult.rows[0]?.level_up_channel;

                if (levelUpChannelId) {
                    const channel = interaction.client.channels.cache.get(levelUpChannelId);
                    if (channel) {
                        const messageTemplate = await getLevelUpMessage(guildId, newLevel);
                        const formattedMessage = messageTemplate.replace('{user}', `<@${userId}>`);
                        const imagePath = getLevelUpImage(newLevel);
                        await channel.send({ content: formattedMessage, files: [imagePath] });
                    } else {
                        console.warn(`Canal level_up_channel (${levelUpChannelId}) introuvable.`);
                    }
                } else {
                    console.warn(`level_up_channel non défini pour guild ${guildId}.`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`XP ajouté pour ${target.tag}`)
                .setColor('#00FFAA')
                .addFields(
                    { name: 'XP reçu', value: `${xpToAdd}`, inline: true },
                    { name: 'XP total', value: `${newXp}`, inline: true },
                    { name: 'XP restant pour le niveau suivant', value: `${xpRemaining} / ${xpForNextLevel}`, inline: true }
                );

            // Réponse visible pour tous
            await interaction.editReply({ embeds: [embed] });
            console.log(`XP ajouté pour ${target.tag} par ${interaction.user.tag}: +${xpToAdd} XP, nouveau niveau: ${newLevel}`);
        } catch (error) {
            console.error('Erreur xpadd :', error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’ajout d’XP.', ephemeral: true });
        }
    }
};