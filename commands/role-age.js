const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-age')
        .setDescription('Sélectionnez votre tranche d’âge.'),

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
            const imagePath = path.join(__dirname, '../img/age.png');
            const attachment = new AttachmentBuilder(imagePath).setName('age.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons d’âge
            const ageButtons = [
                { desc: "18-24 ans", emoji: '<:age_18_24:1340036002395197544>', role: process.env.AGE1_ROLE_ID },
                { desc: "25-30 ans", emoji: '<:age_25_30:1340036005885116476>', role: process.env.AGE2_ROLE_ID },
                { desc: "31-35 ans", emoji: '<:age_31_35:1340036008670134292>', role: process.env.AGE3_ROLE_ID },
                { desc: "36-40 ans", emoji: '<:age_36_40:1340036010838589523>', role: process.env.AGE4_ROLE_ID },
                { desc: "41 ans et +", emoji: '<:age_41:1340036014466535488>', role: process.env.AGE5_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = ageButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`age_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection de tranche d’âge ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton d’âge
        const customId = interaction.customId;
        if (!customId.startsWith('age_')) return;

        const roleId = customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply({
                content: 'Le rôle sélectionné est introuvable.',
                ephemeral: true
            });
        }

        // Liste des rôles d’âge
        const ageRoles = [
            process.env.AGE1_ROLE_ID,
            process.env.AGE2_ROLE_ID,
            process.env.AGE3_ROLE_ID,
            process.env.AGE4_ROLE_ID,
            process.env.AGE5_ROLE_ID
        ];

        const existingAgeRole = interaction.member.roles.cache.find(r => ageRoles.includes(r.id));

        try {
            // Retirer le rôle d’âge existant s’il y en a un
            if (existingAgeRole) {
                await interaction.member.roles.remove(existingAgeRole);
                await interaction.reply({
                    content: `Votre rôle précédent (${existingAgeRole.name}) a été retiré.`,
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