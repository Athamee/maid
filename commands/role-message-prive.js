const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-message-prive')
        .setDescription('Sélectionnez votre préférence pour les messages privés.'),

    // Exécution de la commande
    async execute(interaction) {
        // Vérifier les permissions administratives
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'Vous n\'avez pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        try {
            // Différer la réponse initiale
            await interaction.deferReply({ ephemeral: true });

            // Définir le chemin vers l'image locale
            const imagePath = path.join(__dirname, '../img/mp.png');
            const attachment = new AttachmentBuilder(imagePath).setName('mp.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons pour les messages privés
            const dmButtons = [
                { desc: "Ouvert aux MP", emoji: '<:mp_oui:1340037973407477760>', role: process.env.DMO_ROLE_ID },
                { desc: "Fermé aux MP", emoji: '<:mp_non:1340037969812799529>', role: process.env.DMN_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = dmButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`dm_${option.role}`)
                    .setLabel(option.desc)
                    .setEmoji(option.emoji)
                    .setStyle(ButtonStyle.Secondary)
            );

            // Ajouter les boutons dans une ligne d'action
            const actionRow = new ActionRowBuilder().addComponents(buttons);

            // Envoyer uniquement les boutons
            await interaction.channel.send({
                components: [actionRow]
            });

            // Répondre pour confirmer l'exécution de la commande
            await interaction.editReply({ content: 'Les boutons de sélection pour les messages privés ont été envoyés.', ephemeral: true });
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande :', error);
            // Gérer les erreurs si la réponse n’a pas encore été envoyée
            if (!interaction.replied) {
                await interaction.editReply({
                    content: 'Une erreur est survenue.',
                    ephemeral: true
                });
            }
        }
    },

    // Gestion de l’interaction avec les boutons
    handleButtonInteraction: async (interaction) => {
        // Vérifier si l’interaction concerne un bouton de messages privés
        const customId = interaction.customId;
        if (!customId.startsWith('dm_')) return;

        const roleId = customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply({
                content: 'Le rôle sélectionné est introuvable.',
                ephemeral: true
            });
        }

        // Liste des rôles pour les messages privés
        const dmRoles = [
            process.env.DMO_ROLE_ID,
            process.env.DMN_ROLE_ID
        ];

        const existingDmRole = interaction.member.roles.cache.find(r => dmRoles.includes(r.id));

        try {
            // Retirer le rôle de messages privés existant s’il y en a un
            if (existingDmRole) {
                await interaction.member.roles.remove(existingDmRole);
                await interaction.reply({
                    content: `Votre rôle précédent (${existingDmRole.name}) a été retiré.`,
                    ephemeral: true
                });
            }

            // Ajouter le nouveau rôle
            await interaction.member.roles.add(role);
            await interaction.followUp({
                content: `Vous avez maintenant le rôle : ${role.name}.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur lors de la gestion des rôles :', error);
            await interaction.reply({
                content: 'Une erreur est survenue lors de la modification de vos rôles.',
                ephemeral: true
            });
        }
    }
};