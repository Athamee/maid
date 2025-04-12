const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    commandDatas: new SlashCommandBuilder()
        .setName('role-orientation')
        .setDescription('Sélectionnez votre orientation.'),

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
            const imagePath = path.join(__dirname, '../img/role-orientation.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-orientation.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons d’orientation
            const orientationButtons = [
                { desc: "Hétérosexuel.le", emoji: '<:orientation_heterosexual:1340037065122906202>', role: process.env.HETERO_ROLE_ID },
                { desc: "Homosexuel.le", emoji: '<:orientation_homosexual:1340037075726106654>', role: process.env.HOMO_ROLE_ID },
                { desc: "Bisexuel.le", emoji: '<:orientation_bisexual:1340037061612273664>', role: process.env.BI_ROLE_ID },
                { desc: "Pansexuel.le", emoji: '<:orientation_pansexual:1340037068109123704>', role: process.env.PAN_ROLE_ID },
                { desc: "Sapiosexuel.le", emoji: '<:orientation_sapiosexual:1340037073096278037>', role: process.env.SAPIO_ROLE_ID },
                { desc: "Asexuel.le", emoji: '<:orientation_asexual:1340037054247075951>', role: process.env.ASEXUEL_ROLE_ID },
                { desc: "Autres", emoji: '<:orientation_autres:1340037057325699072>', role: process.env.ORIENTATION_ROLE_ID }
            ];

            // Diviser les boutons en groupes de 5 max
            const buttonRows = [];
            for (let i = 0; i < orientationButtons.length; i += 5) {
                const buttons = orientationButtons.slice(i, i + 5).map((option, index) =>
                    new ButtonBuilder()
                        .setCustomId(`orientation_${option.role}_${i + index}`)
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
            await interaction.editReply({ content: 'Les boutons de sélection d’orientation ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton d’orientation
        const customId = interaction.customId;
        if (!customId.startsWith('orientation_')) return;

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