const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-dynamique-bdsm')
        .setDescription('Sélectionnez votre dynamique BDSM.'),

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
            const imagePath = path.join(__dirname, '../img/role-dynamique-bdsm.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-dynamique-bdsm.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons de dynamique BDSM
            const bdsmButtons = [
                { desc: "D/S", emoji: '<:dynamique_bdsm_relation_ds:1340036464905424906>', role: process.env.DS_ROLE_ID },
                { desc: "M/E", emoji: '<:dynamique_bdsm_relation_me:1340036468470448138>', role: process.env.ME_ROLE_ID },
                { desc: "Sous contrat", emoji: '<:dynamique_bdsm_sous_contrat:1340036475613614192>', role: process.env.CONTRAT_ROLE_ID },
                { desc: "Sous collier", emoji: '<:dynamique_bdsm_sous_collier:1340036471934943332>', role: process.env.COLLIER_ROLE_ID },
                { desc: "Mentorat", emoji: '<:dynamique_bdsm_mentorat:1340119674045599785>', role: process.env.MENTOR_ROLE_ID },
                { desc: "Sous mentorat", emoji: '<:dynamique_bdsm_sous_mentorat:1340119681763377284>', role: process.env.MENTORAT_ROLE_ID },
                { desc: "Protectorat", emoji: '<:dynamique_bdsm_protectorat:1340119677027749969>', role: process.env.PROTECTORAT_ROLE_ID },
                { desc: "Sous protection", emoji: '<:dynamique_bdsm_sous_protectorat:1340119683906666617>', role: process.env.PROTECTION_ROLE_ID }
            ];

            // Diviser les boutons en groupes de 5 max
            const buttonRows = [];
            for (let i = 0; i < bdsmButtons.length; i += 5) {
                const buttons = bdsmButtons.slice(i, i + 5).map((option, index) =>
                    new ButtonBuilder()
                        .setCustomId(`bdsm_${option.role}_${i + index}`)
                        .setLabel(option.desc)
                        .setEmoji(option.emoji)
                        .setStyle(ButtonStyle.Secondary)
                );
                buttonRows.push(new ActionRowBuilder().addComponents(buttons));
            }

            // Envoyer les ActionRows contenant les boutons
            for (const row of buttonRows) {
                await interaction.channel.send({ components: [row] });
            }

            // Répondre pour confirmer l'exécution de la commande
            await interaction.editReply({ content: 'Les boutons de sélection de dynamique BDSM ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton de dynamique BDSM
        const customId = interaction.customId;
        if (!customId.startsWith('bdsm_')) return;

        // Extraire roleId (avant le dernier underscore)
        const parts = customId.split('_');
        const roleId = parts[1];
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
                // Ajouter le nouveau rôle
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