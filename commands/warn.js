// Importer les modules nécessaires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const pool = require('../db');

module.exports = {
    // Définir la commande
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertir un membre (modo only)') // Description statique garantie
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Permissions explicites pour éviter warning
        .addUserOption(option => option.setName('target').setDescription('Membre à avertir').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Raison').setRequired(false)),

    // Exécuter la commande
    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        // Vérifier les permissions
        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({ content: 'Membre introuvable sur le serveur.', ephemeral: true });
        }
        const reason = interaction.options.getString('reason') || 'Non spécifié';

        try {
            // Insérer le warn dans la DB (sans timestamp, CURRENT_TIMESTAMP s’en charge)
            await pool.query(
                'INSERT INTO warns (user_id, guild_id, reason, moderator_id) VALUES ($1, $2, $3, $4)',
                [target.id, interaction.guild.id, reason, interaction.user.id]
            );
            console.log(`[Warn] Warn pour ${target.tag} par ${interaction.user.tag} (raison : ${reason})`);

            // Compter les warns
            const warnCountResult = await pool.query(
                'SELECT COUNT(*) AS count FROM warns WHERE user_id = $1 AND guild_id = $2',
                [target.id, interaction.guild.id]
            );
            const warnCount = parseInt(warnCountResult.rows[0].count, 10);

            // Envoyer le message dans PILORI_CHANNEL_ID pour chaque warn
            const piloriChannelId = process.env.PILORI_CHANNEL_ID;
            const piloriChannel = interaction.guild.channels.cache.get(piloriChannelId);

            if (piloriChannel && piloriChannel.isTextBased()) {
                const piloriMessage = `Le membre <@${target.id}> a reçu un warn pour la raison suivante : ${reason}.`;
                await piloriChannel.send(piloriMessage);
                console.log(`[Warn] Message envoyé dans #${piloriChannel.name} : ${piloriMessage}`);
            } else {
                console.error(`[Warn] Erreur : Salon PILORI_CHANNEL_ID (${piloriChannelId}) introuvable ou non texte.`);
            }

            // Vérifier si 3 warns pour gérer les rôles et envoyer le message
            if (warnCount >= 3) {
                const warnedRoleId = process.env.WARNED_ROLE_ID;
                const warnedRole = interaction.guild.roles.cache.get(warnedRoleId);

                if (!warnedRole) {
                    console.error(`[Warn] Erreur : Le rôle WARNED_ROLE_ID (${warnedRoleId}) est introuvable.`);
                    await interaction.reply({
                        content: `${target.tag} averti pour : ${reason} (${warnCount}/3). Attention : le rôle à 3 warns est introuvable.`,
                        ephemeral: true
                    });
                    return;
                }

                let actions = [];
                let removedRoles = [];

                // Ajouter le rôle warned si pas déjà présent
                if (!targetMember.roles.cache.has(warnedRoleId)) {
                    await targetMember.roles.add(warnedRole);
                    actions.push(`rôle ${warnedRole.name} attribué`);
                    console.log(`[Warn] Ajout du rôle ${warnedRole.name} (${warnedRoleId}) à ${target.tag} (${target.id})`);
                }

                // Liste des rôles à retirer
                const rolesToRemove = [
                    { id: process.env.CERTIFIE_ROLE_ID, name: 'Certifié' },
                    { id: process.env.DM_ROLE_ID, name: 'DM' },
                    { id: process.env.GALERIE_ROLE_ID, name: 'Galerie' },
                    { id: process.env.TORTURE_ROLE_ID, name: 'Torture' },
                    { id: process.env.MEMBRE_ROLE_ID, name: 'Membre' }
                ];

                // Retirer les rôles s’ils existent
                for (const role of rolesToRemove) {
                    const roleObj = role.id && interaction.guild.roles.cache.get(role.id);
                    if (roleObj && targetMember.roles.cache.has(role.id)) {
                        await targetMember.roles.remove(roleObj);
                        actions.push(`rôle ${roleObj.name} retiré`);
                        removedRoles.push(role.id);
                        console.log(`[Warn] Retrait du rôle ${roleObj.name} (${role.id}) de ${target.tag} (${target.id})`);
                    } else if (role.id && !roleObj) {
                        console.error(`[Warn] Erreur : Le rôle ${role.name} (${role.id}) est introuvable.`);
                    }
                }

                // Stocker les rôles retirés dans warn_removed_roles
                if (removedRoles.length > 0) {
                    await pool.query(
                        'INSERT INTO warn_removed_roles (guild_id, user_id, removed_roles) VALUES ($1, $2, $3) ' +
                        'ON CONFLICT (guild_id, user_id) DO UPDATE SET removed_roles = $3',
                        [interaction.guild.id, target.id, JSON.stringify(removedRoles)]
                    );
                    console.log(`[Warn] Rôles retirés stockés pour ${target.tag} : ${removedRoles.join(', ')}`);
                }

                // Envoyer le message dans WARN_CHANNEL_ID
                const warnChannelId = process.env.WARN_CHANNEL_ID;
                const warnChannel = interaction.guild.channels.cache.get(warnChannelId);

                if (warnChannel && warnChannel.isTextBased()) {
                    const warnMessage = `<@${target.id}>, tu viens de recevoir ton troisième warn pour : ${reason}.\nAu troisième warn, tu es désormais **isolé du serveur**. Un modérateur décidera de la suite.`;
                    await warnChannel.send(warnMessage);
                    console.log(`[Warn] Message envoyé dans #${warnChannel.name} : ${warnMessage}`);
                } else {
                    console.error(`[Warn] Erreur : Salon WARN_CHANNEL_ID (${warnChannelId}) introuvable ou non texte.`);
                }

                await interaction.reply({
                    content: `${target.tag} averti pour : ${reason} (${warnCount}/3). ${actions.length > 0 ? actions.join(', ') + '.' : 'Aucune action supplémentaire.'}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `${target.tag} averti pour : ${reason} (${warnCount}/3)`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('[Warn] Erreur lors du warn :', error.message, error.stack);
            await interaction.reply({ content: 'Erreur lors du warn.', ephemeral: true });
        }
    }
};