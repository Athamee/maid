const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Retirer un warn d’un membre (modo only)')
        .addIntegerOption(option => option.setName('warn_id').setDescription('ID du warn à retirer').setRequired(true)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        // Vérifier les permissions
        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const warnId = interaction.options.getInteger('warn_id');

        try {
            // Supprimer le warn
            const result = await pool.query(
                'DELETE FROM warns WHERE id = $1 AND guild_id = $2 RETURNING *',
                [warnId, interaction.guild.id]
            );

            if (result.rowCount === 0) {
                return interaction.reply({ content: `Aucun warn trouvé avec l’ID ${warnId}.`, ephemeral: true });
            }

            const warn = result.rows[0];
            const targetMember = await interaction.guild.members.fetch(warn.user_id).catch(() => null);
            if (!targetMember) {
                await interaction.reply({
                    content: `Warn ID ${warnId} retiré pour <@${warn.user_id}> (Raison : ${warn.reason}). Membre introuvable sur le serveur.`,
                    ephemeral: true
                });
                console.log(`Warn ID ${warnId} retiré par ${interaction.user.tag} pour ${warn.user_id}`);
                return;
            }

            // Compter les warns restants
            const warnCountResult = await pool.query(
                'SELECT COUNT(*) AS count FROM warns WHERE user_id = $1 AND guild_id = $2',
                [warn.user_id, interaction.guild.id]
            );
            const warnCount = parseInt(warnCountResult.rows[0].count, 10);

            // Vérifier si le rôle WARNED_ROLE_ID doit être retiré
            const warnedRoleId = process.env.WARNED_ROLE_ID;
            const warnedRole = interaction.guild.roles.cache.get(warnedRoleId);

            if (warnCount < 3 && targetMember.roles.cache.has(warnedRoleId)) {
                if (!warnedRole) {
                    console.error(`Erreur : Le rôle WARNED_ROLE_ID (${warnedRoleId}) est introuvable.`);
                    await interaction.reply({
                        content: `Warn ID ${warnId} retiré pour <@${warn.user_id}> (Raison : ${warn.reason}). Attention : le rôle Warned est introuvable.`,
                        ephemeral: true
                    });
                    return;
                }

                console.log(`Retrait du rôle ${warnedRole.name} (${warnedRoleId}) pour ${targetMember.user.tag} (${warn.user_id}) : ${warnCount} warns restants`);
                await targetMember.roles.remove(warnedRole);
                await interaction.reply({
                    content: `Warn ID ${warnId} retiré pour <@${warn.user_id}> (Raison : ${warn.reason}). Rôle ${warnedRole.name} retiré (${warnCount}/3).`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `Warn ID ${warnId} retiré pour <@${warn.user_id}> (Raison : ${warn.reason}). ${warnCount}/3 warns restants.`,
                    ephemeral: true
                });
            }

            console.log(`Warn ID ${warnId} retiré par ${interaction.user.tag} pour ${warn.user_id}`);
        } catch (error) {
            console.error('Erreur lors du unwarn :', error.message, error.stack);
            await interaction.reply({ content: 'Erreur lors du retrait du warn.', ephemeral: true });
        }
    }
};