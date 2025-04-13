const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    // Définition de la commande
    data: new SlashCommandBuilder()
        .setName('role-situation-bdsm')
        .setDescription('Sélectionnez votre situation BDSM.'),

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
            const imagePath = path.join(__dirname, '../img/role-situation-bdsm.png');
            const attachment = new AttachmentBuilder(imagePath).setName('role-situation-bdsm.png');

            // Envoyer d'abord l'image
            await interaction.channel.send({
                files: [attachment]
            });

            // Définir les boutons de situation BDSM
            const bdsmButtons = [
                { desc: "Dominant.e", emoji: '<:situation_bdsm_dominante:1340094619014266890>', role: process.env.DOM_ROLE_ID },
                { desc: "Maître.sse", emoji: '<:situation_bdsm_maitresse:1340094630963843087>', role: process.env.MASTER_ROLE_ID },
                { desc: "Brat tamer", emoji: '<:situation_bdsm_brattamer:1340094612584271952>', role: process.env.TAMER_ROLE_ID },
                { desc: "Daddy-Mommy", emoji: '<:situation_bdsm_daddy_mommy:1340094616388763759>', role: process.env.DADDY_ROLE_ID },
                { desc: "Switch", emoji: '<:situation_bdsm_switch:1340094641181167666>', role: process.env.SWITCH_ROLE_ID },
                { desc: "Brat", emoji: '<:situation_bdsm_brat:1340094610407555154>', role: process.env.BRAT_ROLE_ID },
                { desc: "Soumis.e", emoji: '<:situation_bdsm_soumise:1340094638194688183>', role: process.env.SUB_ROLE_ID },
                { desc: "Esclave", emoji: '<:situation_bdsm_esclave:1340094625104265376>', role: process.env.SLAVE_ROLE_ID },
                { desc: "Little", emoji: '<:situation_bdsm_little:1340094628258648064>', role: process.env.LITTLE_ROLE_ID },
                { desc: "Ageplay", emoji: '<:situation_bdsm_ageplay:1340094606611714251>', role: process.env.AGEPLAY_ROLE_ID },
                { desc: "Petplay", emoji: '<:situation_bdsm_petplay:1340094634298183858>', role: process.env.PETPLAY_ROLE_ID },
                { desc: "En questionnement", emoji: '<:situation_bdsm_questionnement:1340094622348873780>', role: process.env.QUESTION_ROLE_ID },
                { desc: "Vanilla", emoji: '<:situation_bdsm_vanille:1340094643592888402>', role: process.env.VANILLA_ROLE_ID }
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
            await interaction.editReply({ content: 'Les boutons de sélection de situation BDSM ont été envoyés.', ephemeral: true });
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
        // Vérifier si l’interaction concerne un bouton de situation BDSM
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