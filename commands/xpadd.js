const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');
const path = require('path');

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

// Configuration des images pour les montées de niveau
const levelUpImages = {
    5: path.join(__dirname, '../img/level5.png'),
    10: path.join(__dirname, '../img/level10.png'),
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
                .setRequired(true) // Changé à true car c’est la seule option maintenant
                .setMinValue(1)), // Minimum 1 pour éviter 0

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const animatorRoleId = process.env.ANIMATOR;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);
        const hasAnimatorRole = animatorRoleId && interaction.member.roles.cache.has(animatorRoleId);

        if (!isAdmin && !hasModoRole && !hasAnimatorRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
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

            // Mise à jour de l’XP et de last_message (pas de level dans l’INSERT/UPDATE)
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() ' +
                'RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level || 1; // Fallback à 1 si level est null

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

            // Vérifier si le niveau a augmenté et envoyer les messages appropriés
            if (newLevel > initialLevel) {
                const settingsResult = await pool.query(
                    'SELECT level_up_channel FROM xp_settings WHERE guild_id = $1',
                    [guildId]
                );
                const levelUpChannelId = settingsResult.rows[0]?.level_up_channel;

                if (levelUpChannelId) {
                    const channel = interaction.client.channels.cache.get(levelUpChannelId);
                    if (channel) {
                        const milestoneLevels = [10, 15, 20];
                        const levelsToAnnounce = [];

                        // Ajouter les milestones (10, 15, 20) franchis
                        for (let level = initialLevel + 1; level <= newLevel; level++) {
                            if (milestoneLevels.includes(level)) {
                                levelsToAnnounce.push(level);
                            }
                        }

                        // Ajouter le dernier niveau atteint s’il n’est pas déjà dans les milestones
                        if (!levelsToAnnounce.includes(newLevel)) {
                            levelsToAnnounce.push(newLevel);
                        }

                        // Envoyer un message pour chaque niveau à annoncer
                        for (const level of levelsToAnnounce) {
                            const messageTemplate = await getLevelUpMessage(guildId, level);
                            const formattedMessage = messageTemplate.replace('{user}', `<@${userId}>`);
                            const imagePath = getLevelUpImage(level);
                            await channel.send({ content: formattedMessage, files: [imagePath] });
                        }
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
                    { name: 'XP ajouté', value: `${xpToAdd}`, inline: true },
                    { name: 'Nouveau total XP', value: `${newXp}`, inline: true },
                    { name: 'Nouveau niveau', value: `${newLevel}`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`XP ajouté pour ${target.tag} par ${interaction.user.tag}: +${xpToAdd} XP, nouveau niveau: ${newLevel}`);
        } catch (error) {
            console.error('Erreur xpadd :', error.stack);
            await interaction.reply({ content: 'Erreur lors de l’ajout d’XP.', ephemeral: true });
        }
    }
};