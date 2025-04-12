// role-membre.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-membre')
        .setDescription('Attribuez le rôle de membre.'),

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
            const imagePath = path.join(__dirname, '../img/role-membre.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-membre.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Créer le bouton pour le rôle membre
            const button = new ButtonBuilder()
                .setCustomId(`membre_${process.env.MEMBRE_ROLE_ID}`)
                .setLabel('Devenir membre')
                .setEmoji('<:donjon_membre:1340094188670161037>')
                .setStyle(ButtonStyle.Secondary);

            // Ajouter le bouton dans une ligne d'action
            const actionRow = new ActionRowBuilder().addComponents(button);

            // Envoyer uniquement le bouton
            await interaction.channel.send({
                components: [actionRow]
            });

            // Répondre pour confirmer l'exécution de la commande
            await interaction.editReply({ content: 'Le bouton pour devenir membre a été envoyé.', ephemeral: true });
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

    // Gestion de l’interaction avec le bouton
    handleButtonInteraction: async (interaction) => {
        // Vérifier si l’interaction concerne le bouton membre
        const customId = interaction.customId;
        if (!customId.startsWith('membre_')) return;

        const roleId = customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply({
                content: 'Le rôle membre est introuvable.',
                ephemeral: true
            });
        }

        // Différer la réponse immédiatement pour éviter les timeouts
        await interaction.deferReply({ ephemeral: true });

        try {
            // Vérifier si l’utilisateur a déjà le rôle membre
            if (interaction.member.roles.cache.has(roleId)) {
                console.log(`L’utilisateur a déjà le rôle : ${role.name} (${role.id})`);
                await interaction.editReply({
                    content: 'Vous avez déjà le rôle membre !',
                    ephemeral: true
                });
            } else {
                // Retirer le rôle TAMPON_ROLE_ID s’il est présent
                const tamponRoleId = process.env.TAMPON_ROLE_ID;
                if (tamponRoleId && interaction.member.roles.cache.has(tamponRoleId)) {
                    const tamponRole = interaction.guild.roles.cache.get(tamponRoleId);
                    if (tamponRole) {
                        console.log(`Retrait du rôle : ${tamponRole.name} (${tamponRoleId})`);
                        await interaction.member.roles.remove(tamponRole);
                    }
                }

                // Ajouter le rôle membre
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
                content: 'Une erreur est survenue lors de l’attribution du rôle.',
                ephemeral: true
            });
        }
    }
};