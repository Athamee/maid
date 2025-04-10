const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpadd')
        .setDescription('Ajouter de l’XP ou des niveaux à un membre (modo only)')
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
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        if (!isAdmin && !hasModoRole) {
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

            const newXp = rows[0].xp;
            const newLevel = rows[0].level;

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