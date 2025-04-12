const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
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
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const reset = interaction.options.getBoolean('reset') ?? false;
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
                    return interaction.reply({ content: `Aucun warn trouvé pour <@${targetUser.id}>.`, ephemeral: true });
                }
                messageContent = `Tous les warns (${result.rowCount}) retirés pour <@${targetUser.id}>.`;
            } else {
                // Supprimer le warn le plus récent
                result = await pool.query(
                    'DELETE FROM warns WHERE id = (SELECT id FROM warns WHERE user_id = $1 AND guild_id = $2 ORDER BY timestamp DESC LIMIT 1) RETURNING *',
                    [targetUser.id, interaction.guild.id]
                );
                if (result.rowCount === 0) {
                    return interaction.reply({ content: `Aucun warn trouvé pour <@${targetUser.id}>.`, ephemeral: true });
                }
                const warn = result.rows[0];
                messageContent = `Warn retiré pour <@${warn.user_id}> (Raison : ${warn.reason}).`;
            }

            // Compter les warns restants
            const warnCountResult = await pool.query(
                'SELECT COUNT(*) AS count FROM warns WHERE user_id = $1 AND guild_id = $2',
                [targetUser.id, interaction.guild.id]
            );
            const warnCount = parseInt(warnCountResult.rows[0].count, 10);

            // Actions pour le rôle et restauration
            let actions = [reset ? 'tous les warns retirés' : 'warn retiré'];

            if (warnCount < 3) {
                try {
                    // Retirer le rôle Warned si membre présent
                    if (targetMember) {
                        const warnedRoleId = process.env.WARNED_ROLE_ID;
                        const warnedRole = interaction.guild.roles.cache.get(warnedRoleId);

                        if (warnedRole && targetMember.roles.cache.has(warnedRoleId)) {
                            await targetMember.roles.remove(warnedRole);
                            actions.push(`rôle ${warnedRole.name} retiré`);
                            console.log(`[Unwarn] Retrait du rôle ${warnedRole.name} (${warnedRoleId}) pour ${targetMember.user.tag} (${targetUser.id}) : ${warnCount} warns restants`);
                        } else if (!warnedRole) {
                            console.error(`[Unwarn] Erreur : Le rôle WARNED_ROLE_ID (${warnedRoleId}) est introuvable.`);
                        }

                        // Restaurer les rôles depuis warn_removed_roles
                        const rolesResult = await pool.query(
                            'SELECT removed_roles FROM warn_removed_roles WHERE guild_id = $1 AND user_id = $2',
                            [interaction.guild.id, targetUser.id]
                        );
                        const removedRoles = rolesResult.rows[0] ? JSON.parse(rolesResult.rows[0].removed_roles) : [];

                        if (removedRoles.length > 0) {
                            const rolesToRestore = [
                                { id: process.env.CERTIFIE_ROLE_ID, name: 'Certifié' },
                                { id: process.env.DM_ROLE_ID, name: 'DM' },
                                { id: process.env.GALERIE_ROLE_ID, name: 'Galerie' },
                                { id: process.env.TORTURE_ROLE_ID, name: 'Torture' },
                                { id: process.env.MEMBRE_ROLE_ID, name: 'Membre' }
                            ];

                            for (const role of rolesToRestore) {
                                if (removedRoles.includes(role.id)) {
                                    const roleObj = role.id && interaction.guild.roles.cache.get(role.id);
                                    if (roleObj && !targetMember.roles.cache.has(role.id)) {
                                        await targetMember.roles.add(roleObj);
                                        actions.push(`rôle ${roleObj.name} restauré`);
                                        console.log(`[Unwarn] Restauration du rôle ${roleObj.name} (${role.id}) pour ${targetMember.user.tag} (${targetUser.id})`);
                                    } else if (role.id && !roleObj) {
                                        console.error(`[Unwarn] Erreur : Le rôle ${role.name} (${role.id}) est introuvable.`);
                                    }
                                }
                            }
                        }
                    }

                    // Supprimer l’entrée de warn_removed_roles (même si membre absent)
                    await pool.query(
                        'DELETE FROM warn_removed_roles WHERE guild_id = $1 AND user_id = $2',
                        [interaction.guild.id, targetUser.id]
                    );
                    console.log(`[Unwarn] Entrée warn_removed_roles supprimée pour ${targetUser.tag}`);
                } catch (error) {
                    console.error('[Unwarn] Erreur lors de la gestion des rôles :', error.message, error.stack);
                    actions.push('erreur lors de la gestion des rôles');
                }
            }

            // Envoyer le message dans PILORI_CHANNEL_ID
            const piloriChannelId = process.env.PILORI_CHANNEL_ID;
            const piloriChannel = interaction.guild.channels.cache.get(piloriChannelId);

            if (piloriChannel && piloriChannel.isTextBased()) {
                const piloriMessage = `${messageContent} Warns restants : ${warnCount}.`;
                await piloriChannel.send(piloriMessage);
                console.log(`[Unwarn] Message envoyé dans #${piloriChannel.name} : ${piloriMessage}`);
            } else {
                console.error(`[Unwarn] Erreur : Salon PILORI_CHANNEL_ID (${piloriChannelId}) introuvable, non texte ou non configuré.`);
            }

            await interaction.reply({
                content: `${messageContent} ${actions.length > 1 ? actions.join(', ') + '.' : ''} Warns restants : ${warnCount}/3.`,
                ephemeral: true
            });

            console.log(`[Unwarn] ${reset ? 'Tous les warns' : 'Warn'} retirés par ${interaction.user.tag} pour ${targetUser.id}`);
        } catch (error) {
            console.error('[Unwarn] Erreur lors du unwarn :', error.message, error.stack);
            await interaction.reply({ content: 'Erreur lors du retrait du warn.', ephemeral: true });
        }
    }
};