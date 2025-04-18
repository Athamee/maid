const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    data: new SlashCommandBuilder()
        .setName('role-experience-vanille')
        .setDescription('Sélectionnez votre niveau d’expérience vanille.'),

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
            const imagePath = path.join(__dirname, '../img/role-experience-vanilla.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-experience-vanilla.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons d’expérience vanille
            const experienceButtons = [
                { desc: "Novice", emoji: '<:xp_vanille_25:1340037872329297930>', role: process.env.XPVANILLA25_ROLE_ID },
                { desc: "Amateur.e", emoji: '<:xp_vanille_50:1340037878171832371>', role: process.env.XPVANILLA50_ROLE_ID },
                { desc: "Confirmé.e", emoji: '<:xp_vanille_75:1340037881850363945>', role: process.env.XPVANILLA75_ROLE_ID },
                { desc: "Expérimenté.e", emoji: '<:xp_vanille_100:1340037885637820456>', role: process.env.XPVANILLA100_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = experienceButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`experience-vanille_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection d’expérience vanille ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton d’expérience vanille
        const customId = interaction.customId;
        if (!customId.startsWith('experience-vanille_')) return;

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

        // Liste des rôles d’expérience vanille
        const experienceRoles = [
            process.env.XPVANILLA25_ROLE_ID,
            process.env.XPVANILLA50_ROLE_ID,
            process.env.XPVANILLA75_ROLE_ID,
            process.env.XPVANILLA100_ROLE_ID
        ];

        const existingExperienceRole = interaction.member.roles.cache.find(r => experienceRoles.includes(r.id));

        try {
            // Retirer le rôle d’expérience vanille existant s’il y en a un
            if (existingExperienceRole) {
                console.log(`Retrait du rôle existant : ${existingExperienceRole.name} (${existingExperienceRole.id})`);
                await interaction.member.roles.remove(existingExperienceRole);
                await interaction.editReply({
                    content: `Votre rôle précédent (${existingExperienceRole.name}) a été retiré.`
                });
            } else {
                console.log('Aucun rôle d’expérience vanille existant trouvé.');
                await interaction.editReply({
                    content: 'Aucun rôle d’expérience vanille précédent à retirer.'
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