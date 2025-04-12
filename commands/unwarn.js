// unwarn.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, InteractionResponseFlags } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Retirer un warn ou tous les warns d’un membre (modo only)')
        .addUserOption(option => option.setName('user').setDescription('Membre dont retirer le(s) warn(s)').setRequired(true))
        .addBooleanOption(option => option.setName('reset').setDescription('Reset tous les warns ? (true pour reset, false pour un warn)')),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        // Vérifier les permissions
        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', flags: InteractionResponseFlags.Ephemeral });
        }

        const targetUser = interaction.options.getUser('user');
        const reset = interaction.options.getBoolean('reset') ?? false; // Par défaut : false (un warn)
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        try {
            let result;
            let messageContent;

            if (reset) {
                // Supprimer tous les warns
                result = await pool.query(
                    'DELETE FROM warns WHERE user_id = $1 AND guild_id = $2 RETURNING *',
                    [targetUser.id, interaction.guild.id]
                );
                if (result.rowCount === 0) {
                    return interaction.reply({ content: `Aucun warn trouvé pour <@${targetUser.id}>.`, flags: InteractionResponseFlags.Ephemeral });
                }
                messageContent = `Tous les warns (${result.rowCount}) retirés pour <@${targetUser.id}>.`;
            } else {
                // Supprimer le warn le plus récent
                result = await pool.query(
                    'DELETE FROM warns WHERE id = (SELECT id FROM warns WHERE user_id = $1 AND guild_id = $2 ORDER BY timestamp DESC LIMIT 1) RETURNING *',
                    [targetUser.id, interaction.guild.id]
                );
                if (result.rowCount === 0) {
                    return interaction.reply({ content: `Aucun warn trouvé pour <@${targetUser.id}>.`, flags: InteractionResponseFlags.Ephemeral });
                }
                const warn = result.rows[0];
                messageContent = `Warn retiré pour <@${warn.user_id}> (Raison : ${warn.reason}).`;
            }

            if (!targetMember) {
                await interaction.reply({
                    content: `${messageContent} Membre introuvable sur le serveur.`,
                    flags: InteractionResponseFlags.Ephemeral
                });
                console.log(`${reset ? 'Tous les warns' : 'Warn'} retirés par ${interaction.user.tag} pour ${targetUser.id}`);
                return;
            }

            // Compter les warns restants
            const warnCountResult = await pool.query(
                'SELECT COUNT(*) AS count FROM warns WHERE user_id = $1 AND guild_id = $2',
                [targetUser.id, interaction.guild.id]
            );
            const warnCount = parseInt(warnCountResult.rows[0].count, 10);

            // Vérifier si le rôle WARNED_ROLE_ID doit être retiré
            const warnedRoleId = process.env.WARNED_ROLE_ID;
            const warnedRole = interaction.guild.roles.cache.get(warnedRoleId);

            if (warnCount < 3 && targetMember.roles.cache.has(warnedRoleId)) {
                if (!warnedRole) {
                    console.error(`Erreur : Le rôle WARNED_ROLE_ID (${warnedRoleId}) est introuvable.`);
                    await interaction.reply({
                        content: `${messageContent} Attention : le rôle Warned est introuvable.`,
                        flags: InteractionResponseFlags.Ephemeral
                    });
                    return;
                }

                console.log(`Retrait du rôle ${warnedRole.name} (${warnedRoleId}) pour ${targetMember.user.tag} (${targetUser.id}) : ${warnCount} warns restants`);
                await targetMember.roles.remove(warnedRole);
                await interaction.reply({
                    content: `${messageContent} Rôle ${warnedRole.name} retiré (${warnCount}/3).`,
                    flags: InteractionResponseFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: `${messageContent} ${warnCount}/3 warns restants.`,
                    flags: InteractionResponseFlags.Ephemeral
                });
            }

            console.log(`${reset ? 'Tous les warns' : 'Warn'} retirés par ${interaction.user.tag} pour ${targetUser.id}`);
        } catch (error) {
            console.error('Erreur lors du unwarn :', error.message, error.stack);
            await interaction.reply({ content: 'Erreur lors du retrait du warn.', flags: InteractionResponseFlags.Ephemeral });
        }
    }
};