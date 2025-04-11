const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reglement')
        .setDescription('Poster un message avec un bouton pour accepter le règlement (admins uniquement)'),

    async execute(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            console.log(`Permission refusée pour ${interaction.user.tag} : pas administrateur`);
            return interaction.reply({ content: 'Permission refusée : cette commande est réservée aux administrateurs.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        console.log(`Commande /reglement exécutée par ${interaction.user.tag}`);

        try {
            const arrivantRoleId = process.env.ARRIVANT_ROLE_ID; // Rôle à retirer
            const reglementAcceptedRoleId = process.env.REGLEMENT_ACCEPTED_ROLE_ID; // Rôle à attribuer

            if (!arrivantRoleId || !reglementAcceptedRoleId) {
                console.error('Variables d’environnement ARRIVANT_ROLE_ID ou REGLEMENT_ACCEPTED_ROLE_ID manquantes');
                return interaction.editReply({ content: 'Erreur : Les rôles ARRIVANT_ROLE_ID ou REGLEMENT_ACCEPTED_ROLE_ID ne sont pas définis dans la configuration.', ephemeral: true });
            }

            const unacceptedRole = interaction.guild.roles.cache.get(arrivantRoleId);
            const acceptedRole = interaction.guild.roles.cache.get(reglementAcceptedRoleId);

            if (!acceptedRole) {
                console.error(`Rôle REGLEMENT_ACCEPTED (${reglementAcceptedRoleId}) introuvable dans le cache`);
                return interaction.editReply({ content: `Erreur : Le rôle REGLEMENT_ACCEPTED est introuvable.`, ephemeral: true });
            }
            if (!unacceptedRole) {
                console.warn(`Rôle ARRIVANT (${arrivantRoleId}) introuvable dans le cache`);
            }

            // Bouton seul, sans texte
            const button = new ButtonBuilder()
                .setCustomId('accept_reglement')
                .setLabel('Accepter le règlement')
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder().addComponents(button);

            // Envoyer uniquement le bouton dans le canal
            await interaction.channel.send({
                components: [actionRow],
            });
            console.log(`Bouton envoyé dans ${interaction.channel.name} (ID: ${interaction.channel.id})`);

            // Confirmation éphémère pour l’admin
            const adminEmbed = new EmbedBuilder()
                .setTitle('Commande exécutée')
                .setDescription('Le bouton pour accepter le règlement a été posté avec succès.')
                .setColor('#00FFAA');

            await interaction.editReply({ embeds: [adminEmbed], ephemeral: true });
        } catch (error) {
            console.error(`Erreur dans /reglement pour ${interaction.user.tag} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’exécution de la commande.', ephemeral: true });
        }
    },

    handleButtonInteraction: async (interaction) => {
        console.log(`Interaction bouton 'accept_reglement' par ${interaction.user.tag}`);

        try {
            const member = interaction.member;
            const arrivantRoleId = process.env.ARRIVANT_ROLE_ID;
            const reglementAcceptedRoleId = process.env.REGLEMENT_ACCEPTED_ROLE_ID;

            console.log(`Rôles configurés : ARRIVANT_ROLE_ID=${arrivantRoleId}, REGLEMENT_ACCEPTED_ROLE_ID=${reglementAcceptedRoleId}`);

            const acceptedRole = interaction.guild.roles.cache.get(reglementAcceptedRoleId);
            const unacceptedRole = interaction.guild.roles.cache.get(arrivantRoleId);

            // Vérification des rôles
            if (!acceptedRole) {
                console.error(`Rôle REGLEMENT_ACCEPTED (${reglementAcceptedRoleId}) introuvable`);
                return interaction.reply({ content: 'Erreur : Le rôle REGLEMENT_ACCEPTED est introuvable.', ephemeral: true });
            }
            if (!unacceptedRole) {
                console.warn(`Rôle ARRIVANT (${arrivantRoleId}) introuvable, poursuite sans retrait`);
            }

            // Vérification des permissions du bot
            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                console.error('Le bot n’a pas la permission ManageRoles');
                return interaction.reply({ content: 'Erreur : Le bot n’a pas la permission de gérer les rôles.', ephemeral: true });
            }

            if (acceptedRole.position > botMember.roles.highest.position) {
                console.error(`Le rôle REGLEMENT_ACCEPTED (${reglementAcceptedRoleId}) est plus haut que le rôle du bot`);
                return interaction.reply({ content: 'Erreur : Le rôle à attribuer est trop haut dans la hiérarchie pour le bot.', ephemeral: true });
            }
            if (unacceptedRole && unacceptedRole.position > botMember.roles.highest.position) {
                console.warn(`Le rôle ARRIVANT (${arrivantRoleId}) est plus haut que le rôle du bot, impossible de le retirer`);
            }

            // Si le membre a déjà le rôle ACCEPTED
            if (member.roles.cache.has(reglementAcceptedRoleId)) {
                console.log(`${member.user.tag} a déjà le rôle ${acceptedRole.name}`);
                return interaction.reply({
                    content: `Vous avez déjà le rôle **${acceptedRole.name}**.`,
                    ephemeral: true
                });
            }

            // Supprimer le rôle UNACCEPTED si présent et possible
            if (unacceptedRole && member.roles.cache.has(arrivantRoleId)) {
                try {
                    await member.roles.remove(unacceptedRole);
                    console.log(`Rôle ${unacceptedRole.name} retiré de ${member.user.tag}`);
                } catch (error) {
                    console.warn(`Échec du retrait du rôle ${unacceptedRole.name} pour ${member.user.tag} :`, error.message);
                }
            }

            // Ajouter le rôle ACCEPTED
            await member.roles.add(acceptedRole);
            console.log(`Rôle ${acceptedRole.name} ajouté à ${member.user.tag}`);

            await interaction.reply({
                content: `Vous avez accepté le règlement ! Rôle **${acceptedRole.name}** obtenu.`,
                ephemeral: true
            });
        } catch (error) {
            console.error(`Erreur dans l’interaction bouton pour ${interaction.user.tag} :`, error.stack);
            await interaction.reply({
                content: 'Erreur lors de l’acceptation du règlement. Contactez un administrateur.',
                ephemeral: true
            });
        }
    }
};