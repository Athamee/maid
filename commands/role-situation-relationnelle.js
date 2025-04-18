const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    data: new SlashCommandBuilder()
        .setName('role-situation-relationnelle')
        .setDescription('Sélectionnez votre situation relationnelle.'),

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
            const imagePath = path.join(__dirname, '../img/role-situation-relationnelle.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-situation-relationnelle.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons de situation relationnelle
            const relationButtons = [
                { desc: "Couple", emoji: '<:relation_couple:1340037572751265846>', role: process.env.COUPLE_ROLE_ID },
                { desc: "Ouverte", emoji: '<:relation_ouverte:1340037575322239017>', role: process.env.LIBRE_ROLE_ID },
                { desc: "Célibataire", emoji: '<:relation_clibataire:1340037567361323088>', role: process.env.CELIB_ROLE_ID },
                { desc: "Compliqué", emoji: '<:relation_compliquee:1340037569542492220>', role: process.env.COMPLIQUE_ROLE_ID },
                { desc: "Polyamoureuse", emoji: '<:relation_polyamoureuse:1340037578413310045>', role: process.env.POLY_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = relationButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`relation_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection de situation relationnelle ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton de situation relationnelle
        const customId = interaction.customId;
        if (!customId.startsWith('relation_')) return;

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

        // Liste des rôles de situation relationnelle
        const relationRoles = [
            process.env.COUPLE_ROLE_ID,
            process.env.LIBRE_ROLE_ID,
            process.env.CELIB_ROLE_ID,
            process.env.COMPLIQUE_ROLE_ID,
            process.env.POLY_ROLE_ID
        ];

        const existingRelationRole = interaction.member.roles.cache.find(r => relationRoles.includes(r.id));

        try {
            // Retirer le rôle de situation relationnelle existant s’il y en a un
            if (existingRelationRole) {
                console.log(`Retrait du rôle existant : ${existingRelationRole.name} (${existingRelationRole.id})`);
                await interaction.member.roles.remove(existingRelationRole);
                await interaction.editReply({
                    content: `Votre rôle précédent (${existingRelationRole.name}) a été retiré.`
                });
            } else {
                console.log('Aucun rôle de situation relationnelle existant trouvé.');
                await interaction.editReply({
                    content: 'Aucun rôle de situation relationnelle précédent à retirer.'
                });
            }

            // Ajouter le nouveau rôle
            console.log(`Ajout du rôle : ${role.name} (${role.id})`);
            await interaction.member.roles.add(role);
            await interaction.followUp({
                content: `Vous avez maintenant le rôle : ${role.name}.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur lors de la gestion des rôles :', error.message, error.stack);
            if (interaction.replied) {
                await interaction.followUp({
                    content: 'Une erreur est survenue lors de la modification de vos rôles.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: 'Une erreur est survenue lors de la modification de vos rôles.'
                });
            }
        }
    }
};