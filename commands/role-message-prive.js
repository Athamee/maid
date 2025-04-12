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
                { desc: "Sur demande", emoji: '<:dm_sur_demande:1340036125108080813>', role: process.env.DEMANDE_ROLE_ID },
                { desc: "Fermé", emoji: '<:dm_fermes:1340036121295458395>', role: process.env.FERME_ROLE_ID }
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

        // Différer la réponse immédiatement pour éviter les timeouts
        await interaction.deferReply({ ephemeral: true });

        // Liste des rôles pour les messages privés
        const dmRoles = [
            process.env.DEMANDE_ROLE_ID,
            process.env.FERME_ROLE_ID
        ];

        const existingDmRole = interaction.member.roles.cache.find(r => dmRoles.includes(r.id));

        try {
            // Retirer le rôle de messages privés existant s’il y en a un
            if (existingDmRole) {
                console.log(`Retrait du rôle existant : ${existingDmRole.name} (${existingDmRole.id})`);
                await interaction.member.roles.remove(existingDmRole);
                await interaction.editReply({
                    content: `Votre rôle précédent (${existingDmRole.name}) a été retiré.`
                });
            } else {
                console.log('Aucun rôle de messages privés existant trouvé.');
                await interaction.editReply({
                    content: 'Aucun rôle de messages privés précédent à retirer.'
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