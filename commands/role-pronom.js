const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    data: new SlashCommandBuilder()
        .setName('role-pronom')
        .setDescription('Sélectionnez votre pronom.'),

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
            const imagePath = path.join(__dirname, '../img/role-pronom.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-pronom.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons de pronom
            const pronomButtons = [
                { desc: "Elle", emoji: '<:pronom_elle:1340037474831040603>', role: process.env.ELLE_ROLE_ID },
                { desc: "Iel", emoji: '<:pronom_iel:1340037478383489137>', role: process.env.IEL_ROLE_ID },
                { desc: "Il", emoji: '<:pronom_il:1340037481340604568>', role: process.env.IL_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = pronomButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`pronom_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection de pronom ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton de pronom
        const customId = interaction.customId;
        if (!customId.startsWith('pronom_')) return;

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

        // Liste des rôles de pronom
        const pronomRoles = [
            process.env.ELLE_ROLE_ID,
            process.env.IEL_ROLE_ID,
            process.env.IL_ROLE_ID
        ];

        const existingPronomRole = interaction.member.roles.cache.find(r => pronomRoles.includes(r.id));

        try {
            // Retirer le rôle de pronom existant s’il y en a un
            if (existingPronomRole) {
                console.log(`Retrait du rôle existant : ${existingPronomRole.name} (${existingPronomRole.id})`);
                await interaction.member.roles.remove(existingPronomRole);
                await interaction.editReply({
                    content: `Votre rôle précédent (${existingPronomRole.name}) a été retiré.`
                });
            } else {
                console.log('Aucun rôle de pronom existant trouvé.');
                await interaction.editReply({
                    content: 'Aucun rôle de pronom précédent à retirer.'
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