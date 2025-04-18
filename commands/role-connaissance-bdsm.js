const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    data: new SlashCommandBuilder()
        .setName('role-connaissance-bdsm')
        .setDescription('Sélectionnez votre niveau de connaissance BDSM.'),

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
            const imagePath = path.join(__dirname, '../img/role-connaissance-bdsm.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-connaissance.bdsm.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons de connaissance BDSM
            const connaissanceButtons = [
                { desc: "Novice", emoji: '<:connaissances_bdsm_25:1340126508500516875>', role: process.env.KWBDSM25_ROLE_ID },
                { desc: "Amateur.e", emoji: '<:connaissances_bdsm_50:1340126511260237846>', role: process.env.KWBDSM50_ROLE_ID },
                { desc: "Confirmé.e", emoji: '<:connaissances_bdsm_75:1340126514817269770>', role: process.env.KWBDSM75_ROLE_ID },
                { desc: "Expérimenté.e", emoji: '<:connaissances_bdsm_100:1340126517887500378>', role: process.env.KWBDSM100_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = connaissanceButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`connaissance-bdsm_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection de connaissance BDSM ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton de connaissance BDSM
        const customId = interaction.customId;
        if (!customId.startsWith('connaissance-bdsm_')) return;

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

        // Liste des rôles de connaissance BDSM
        const connaissanceRoles = [
            process.env.KWBDSM25_ROLE_ID,
            process.env.KWBDSM50_ROLE_ID,
            process.env.KWBDSM75_ROLE_ID,
            process.env.KWBDSM100_ROLE_ID
        ];

        const existingConnaissanceRole = interaction.member.roles.cache.find(r => connaissanceRoles.includes(r.id));

        try {
            // Retirer le rôle de connaissance BDSM existant s’il y en a un
            if (existingConnaissanceRole) {
                console.log(`Retrait du rôle existant : ${existingConnaissanceRole.name} (${existingConnaissanceRole.id})`);
                await interaction.member.roles.remove(existingConnaissanceRole);
                await interaction.editReply({
                    content: `Votre rôle précédent (${existingConnaissanceRole.name}) a été retiré.`
                });
            } else {
                console.log('Aucun rôle de connaissance BDSM existant trouvé.');
                await interaction.editReply({
                    content: 'Aucun rôle de connaissance BDSM précédent à retirer.'
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