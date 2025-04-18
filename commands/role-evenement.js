// commands/role-evenement.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    data: new SlashCommandBuilder()
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
            const imagePath = path.join(__dirname, '../img/role-evenement.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-evenement.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons pour les événements
            const eventButtons = [
                { desc: "Animations", emoji: '<:autre_animation:1340092135428325467>', role: process.env.ANIMATION_ROLE_ID },
                { desc: "Vocal", emoji: '<:autre_vocal:1340092138616000552>', role: process.env.VOCAL_ROLE_ID },
                // Ajout du bouton pour le rôle Vérité avec l'emoji et VERITE_ROLE_ID
                { desc: "Vérité ou vérité", emoji: '<:donjon_role_verite:1361442311841779772>', role: process.env.VERITE_ROLE_ID }
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

        // Différer la réponse immédiatement pour éviter les timeouts
        await interaction.deferReply({ ephemeral: true });

        try {
            // Vérifier si l’utilisateur a déjà le rôle
            if (interaction.member.roles.cache.has(roleId)) {
                // Retirer le rôle
                console.log(`Retrait du rôle : ${role.name} (${role.id})`);
                await interaction.member.roles.remove(role);
                await interaction.editReply({
                    content: `Le rôle ${role.name} a été retiré.`,
                    ephemeral: true
                });
            } else {
                // Ajouter le rôle
                console.log(`Ajout du rôle : ${role.name} (${role.id})`);
                await interaction.member.roles.add(role);
                await interaction.editReply({
                    content: `Vous avez maintenant le rôle : ${role.name}.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Erreur lors de la gestion des rôles :', error.message, error.stack);
            await interaction.editReply({
                content: 'Une erreur est survenue lors de la modification de vos rôles.',
                ephemeral: true
            });
        }
    }
};