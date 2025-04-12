const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-genre')
        .setDescription('Sélectionnez votre genre.'),

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
            const imagePath = path.join(__dirname, '../img/genre.png');
            const attachment = new AttachmentBuilder(imagePath).setName('genre.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons de genre
            const genreButtons = [
                { desc: "Femme", emoji: '<:genre_femme:1340036682149265552>', role: process.env.FEMME_ROLE_ID },
                { desc: "MTF", emoji: '<:genre_mtf:1340036690076631230>', role: process.env.MTF_ROLE_ID },
                { desc: "Autres", emoji: '<:genre_autre:1340036680048054343>', role: process.env.AUTRES_ROLE_ID },
                { desc: "FTM", emoji: '<:genre_ftm:1340036684686954508>', role: process.env.FTM_ROLE_ID },
                { desc: "Homme", emoji: '<:genre_homme:1340036687149011089>', role: process.env.HOMME_ROLE_ID }
            ];

            // Créer les boutons
            const buttons = genreButtons.map(option =>
                new ButtonBuilder()
                    .setCustomId(`genre_${option.role}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection de genre ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton de genre
        const customId = interaction.customId;
        if (!customId.startsWith('genre_')) return;

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

        // Liste des rôles de genre
        const genreRoles = [
            process.env.FEMME_ROLE_ID,
            process.env.MTF_ROLE_ID,
            process.env.AUTRES_ROLE_ID,
            process.env.FTM_ROLE_ID,
            process.env.HOMME_ROLE_ID
        ];

        const existingGenreRole = interaction.member.roles.cache.find(r => genreRoles.includes(r.id));

        try {
            // Retirer le rôle de genre existant s’il y en a un
            if (existingGenreRole) {
                console.log(`Retrait du rôle existant : ${existingGenreRole.name} (${existingGenreRole.id})`);
                await interaction.member.roles.remove(existingGenreRole);
                await interaction.editReply({
                    content: `Votre rôle précédent (${existingGenreRole.name}) a été retiré.`
                });
            } else {
                console.log('Aucun rôle de genre existant trouvé.');
                await interaction.editReply({
                    content: 'Aucun rôle de genre précédent à retirer.'
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
            // Si editReply a déjà été appelé, utiliser followUp pour les erreurs
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