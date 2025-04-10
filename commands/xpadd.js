const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpadd')
        .setDescription('Ajouter de l’XP ou des niveaux à un membre (admin & animateur)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Membre à modifier')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('xp')
                .setDescription('Quantité d’XP à ajouter')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option => 
            option.setName('levels')
                .setDescription('Nombre de niveaux à ajouter')
                .setRequired(false)
                .setMinValue(0)),

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
        const xpToAdd = interaction.options.getInteger('xp') || 0;
        const levelsToAdd = interaction.options.getInteger('levels') || 0;

        if (xpToAdd === 0 && levelsToAdd === 0) {
            return interaction.reply({ content: 'Veuillez spécifier au moins une quantité d’XP ou de niveaux à ajouter.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const userId = target.id;

        try {
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, level) VALUES ($1, $2, $3, $4) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, level = xp.level + $4 ' +
                'RETURNING xp, level',
                [userId, guildId, xpToAdd, levelsToAdd]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level;

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
                .setTitle(`XP/Niveaux ajoutés pour ${target.tag}`)
                .setColor('#00FFAA')
                .addFields(
                    { name: 'XP ajouté', value: `${xpToAdd}`, inline: true },
                    { name: 'Niveaux ajoutés', value: `${levelsToAdd}`, inline: true },
                    { name: 'Nouveau total XP', value: `${newXp}`, inline: true },
                    { name: 'Nouveau niveau', value: `${newLevel}`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`XP/Niveaux ajoutés pour ${target.tag} par ${interaction.user.tag}: +${xpToAdd} XP, +${levelsToAdd} niveaux`);
        } catch (error) {
            console.error('Erreur xpadd :', error.stack);
            await interaction.reply({ content: 'Erreur lors de l’ajout d’XP ou de niveaux.', ephemeral: true });
        }
    }
};