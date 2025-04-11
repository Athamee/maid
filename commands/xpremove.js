const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpremove')
        .setDescription('Retirer de l’XP à un membre (admin & modo)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Membre à modifier')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('xp')
                .setDescription('Quantité d’XP à retirer')
                .setRequired(true) // Changé à true car c’est la seule option
                .setMinValue(1)), // Minimum 1 pour éviter 0

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const xpToRemove = interaction.options.getInteger('xp');

        const guildId = interaction.guild.id;
        const userId = target.id;

        try {
            // Récupérer l’XP et le niveau actuels
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp) VALUES ($1, $2, 0) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = GREATEST(xp.xp - $3, 0) ' +
                'RETURNING xp, level',
                [userId, guildId, xpToRemove]
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

            const embed = new EmbedBuilder()
                .setTitle(`XP retiré pour ${target.tag}`)
                .setColor('#FFAA00')
                .addFields(
                    { name: 'XP retiré', value: `${xpToRemove}`, inline: true },
                    { name: 'Nouveau total XP', value: `${newXp}`, inline: true },
                    { name: 'Nouveau niveau', value: `${newLevel}`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`XP retiré pour ${target.tag} par ${interaction.user.tag}: -${xpToRemove} XP, nouveau niveau: ${newLevel}`);
        } catch (error) {
            console.error('Erreur xpremove :', error.stack);
            await interaction.reply({ content: 'Erreur lors du retrait d’XP.', ephemeral: true });
        }
    }
};