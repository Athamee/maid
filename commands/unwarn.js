const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Retirer un warn ou tous les warns d’un membre (modo only)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Membre dont retirer le(s) warn(s)')
                .setRequired(true))
        .addBooleanOption(option => 
            option.setName('reset')
                .setDescription('Reset tous les warns ? (true pour reset, false pour un warn)')),

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

        // Déférer la réponse pour éviter timeout
        await interaction.deferReply({ ephemeral: true });

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
                    return interaction.editReply({ content: `Aucun warn trouvé pour <@${targetUser.id}>.` });
                }
                messageContent = `Tous les warns (${result.rowCount}) retirés pour <@${targetUser.id}>.`;
            } else {
                // Supprimer le warn le plus récent
                result = await pool.query(
                    'DELETE FROM warns WHERE id = (SELECT id FROM warns WHERE user_id = $1 AND guild_id = $2 ORDER BY timestamp DESC LIMIT 1) RETURNING *',
                    [targetUser.id, interaction.guild.id]
                );
                if (result.rowCount === 0) {
                    return interaction.editReply({ content: `Aucun warn trouvé pour <@${targetUser.id}>.` });
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

            if (warnCount < 3 && targetMember) {
                try {
                    // Vérifier la permission ManageRoles
                    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                        console.error(`[Unwarn] Permission ManageRoles manquante pour gérer les rôles de ${targetUser.tag}`);
                        actions.push('erreur : permission manquante pour gérer les rôles');
                    } else {
                        // Retirer le rôle Warned si présent
                        const warnedRoleId = process.env.WARNED_ROLE_ID;
                        const warnedRole = warnedRoleId && interaction.guild.roles.cache.get(warnedRoleId);

                        if (warnedRole && targetMember.roles.cache.has(warnedRoleId)) {
                            await targetMember.roles.remove(warnedRole);
                            actions.push(`rôle ${warnedRole.name} retiré`);
                            console.log(`[Unwarn] Retrait du rôle ${warnedRole.name} (${warnedRoleId}) pour ${targetMember.user.tag} (${targetUser.id}) : ${warnCount} warns restants`);
                        } else if (!warnedRole && warnedRoleId) {
                            console.error(`[Unwarn] Erreur : Le rôle WARNED_ROLE_ID (${warnedRoleId}) est introuvable.`);
                        }

                        // Forcer la récupération des rôles pour éviter les problèmes de cache
                        await interaction.guild.roles.fetch();

                        // Restaurer tous les rôles depuis warn_removed_roles
                        const rolesResult = await pool.query(
                            'SELECT removed_roles FROM warn_removed_roles WHERE guild_id = $1 AND user_id = $2',
                            [interaction.guild.id, targetUser.id]
                        );
                        const removedRoles = rolesResult.rows[0] ? JSON.parse(rolesResult.rows[0].removed_roles) : [];

                        // Loguer les rôles à restaurer pour débogage
                        console.log(`[Unwarn] Rôles à restaurer pour ${targetUser.tag} : ${removedRoles.join(', ') || 'aucun'}`);

                        if (removedRoles.length > 0) {
                            const rolesRestored = [];
                            for (const roleId of removedRoles) {
                                const roleObj = interaction.guild.roles.cache.get(roleId);
                                if (roleObj) {
                                    // Vérifier si le bot peut assigner le rôle (hiérarchie)
                                    const botHighestRole = interaction.guild.members.me.roles.highest;
                                    if (botHighestRole.position > roleObj.position) {
                                        if (!targetMember.roles.cache.has(roleId)) {
                                            await targetMember.roles.add(roleObj);
                                            rolesRestored.push(roleObj.name);
                                            console.log(`[Unwarn] Restauration du rôle ${roleObj.name} (${roleId}) pour ${targetMember.user.tag} (${targetUser.id})`);
                                        } else {
                                            console.log(`[Unwarn] Rôle ${roleObj.name} (${roleId}) déjà assigné à ${targetMember.user.tag}`);
                                        }
                                    } else {
                                        console.error(`[Unwarn] Erreur : Le bot ne peut pas assigner ${roleObj.name} (${roleId}) car son rôle est trop bas`);
                                        actions.push(`échec restauration ${roleObj.name} : hiérarchie insuffisante`);
                                    }
                                } else {
                                    console.error(`[Unwarn] Erreur : Le rôle ${roleId} est introuvable`);
                                    actions.push(`rôle ${roleId} introuvable`);
                                }
                            }
                            if (rolesRestored.length > 0) {
                                actions.push(`rôles restaurés : ${rolesRestored.join(', ')}`);
                            } else {
                                actions.push('aucun rôle restauré (déjà présents ou introuvables)');
                                console.log(`[Unwarn] Aucun rôle restauré pour ${targetMember.user.tag} : rôles déjà présents ou introuvables`);
                            }

                            // Supprimer l’entrée warn_removed_roles après restauration
                            await pool.query(
                                'DELETE FROM warn_removed_roles WHERE guild_id = $1 AND user_id = $2',
                                [interaction.guild.id, targetUser.id]
                            );
                            console.log(`[Unwarn] Entrée warn_removed_roles supprimée pour ${targetUser.tag}`);
                        } else {
                            console.log(`[Unwarn] Aucun rôle à restaurer pour ${targetUser.tag} : warn_removed_roles vide`);
                            actions.push('aucun rôle à restaurer');
                        }
                    }
                } catch (error) {
                    console.error('[Unwarn] Erreur lors de la gestion des rôles :', error.message, error.stack);
                    actions.push('erreur lors de la gestion des rôles');
                }
            } else if (warnCount < 3 && !targetMember) {
                console.log(`[Unwarn] Membre ${targetUser.tag} absent, rôles non restaurés, warn_removed_roles conservé`);
                actions.push('membre absent, rôles non restaurés');
            }

            // Envoyer le message dans PILORI_CHANNEL_ID
            const piloriChannelId = process.env.PILORI_CHANNEL_ID;
            const piloriChannel = piloriChannelId && interaction.guild.channels.cache.get(piloriChannelId);

            if (piloriChannel && piloriChannel.isTextBased()) {
                const piloriMessage = `${messageContent} Warns restants : ${warnCount}.`;
                await piloriChannel.send(piloriMessage);
                console.log(`[Unwarn] Message envoyé dans #${piloriChannel.name} : ${piloriMessage}`);
            } else {
                console.error(`[Unwarn] Erreur : Salon PILORI_CHANNEL_ID (${piloriChannelId}) introuvable, non texte ou non configuré.`);
                actions.push('erreur : salon pilori introuvable');
            }

            // Répondre à l’interaction
            const embed = new EmbedBuilder()
                .setTitle(`Unwarn pour ${targetUser.tag}`)
                .setDescription(`${messageContent}\nActions : ${actions.join(', ')}.\nWarns restants : ${warnCount}/3.`)
                .setColor('#00FFAA')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`[Unwarn] ${reset ? 'Tous les warns' : 'Warn'} retirés par ${interaction.user.tag} pour ${targetUser.tag} (${targetUser.id})`);
        } catch (error) {
            console.error('[Unwarn] Erreur lors du unwarn :', error.message, error.stack);
            await interaction.editReply({ embeds: [
                new EmbedBuilder()
                    .setTitle('Erreur')
                    .setDescription('Une erreur est survenue lors du retrait du warn.')
                    .setColor('#FF0000')
                    .setTimestamp()
            ] });
        }
    }
};