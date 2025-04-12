const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-evenement')
        .setDescription('Sélectionnez vos préférences pour les événements.'),

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
            const imagePath = path.join(__dirname, '../img/event.png');
            const attachment = new AttachmentBuilder(imagePath).setName('event.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons pour les événements
            const eventButtons = [
                { desc: "Événements", emoji: '<:evenements:1340038044043747379>', role: process.env.EVENTS_ROLE_ID },
                { desc: "Munch", emoji: '<:munch:1340038047176912958>', role: process.env.MUNCH_ROLE_ID },
                { desc: "Soirée", emoji: '<:soiree:1340038050537173063>', role: process.env.SOIREE_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = eventButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`event_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection pour les événements ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton d’événement
        const customId = interaction.customId;
        if (!customId.startsWith('event_')) return;

        const roleId = customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply({
                content: 'Le rôle sélectionné est introuvable.',
                ephemeral: true
            });
        }

        try {
            // Vérifier si l’utilisateur a déjà le rôle
            if (interaction.member.roles.cache.has(roleId)) {
                // Retirer le rôle
                await interaction.member.roles.remove(role);
                await interaction.reply({
                    content: `Le rôle ${role.name} a été retiré.`,
                    ephemeral: true
                });
            } else {
                // Ajouter le rôle
                await interaction.member.roles.add(role);
                await interaction.reply({
                    content: `Vous avez maintenant le rôle : ${role.name}.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Erreur lors de la gestion des rôles :', error);
            await interaction.reply({
                content: 'Une erreur est survenue lors de la modification de vos rôles.',
                ephemeral: true
            });
        }
    }
};