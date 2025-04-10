const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertir un membre (modo only)')
        .addUserOption(option => option.setName('target').setDescription('Membre à avertir').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Raison').setRequired(false)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'Non spécifié';

        try {
            await pool.query(
                'INSERT INTO warns (user_id, guild_id, reason, moderator_id) VALUES ($1, $2, $3, $4)',
                [target.id, interaction.guild.id, reason, interaction.user.id]
            );
            await interaction.reply({ content: `${target.tag} averti pour : ${reason}`, ephemeral: true });
            console.log(`Warn pour ${target.tag} par ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur warn :', error.stack);
            await interaction.reply({ content: 'Erreur lors du warn.', ephemeral: true });
        }
    }
};