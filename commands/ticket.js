// ticket.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ouvrir un ticket en sélectionnant un type avec un bouton (réservé aux modérateurs)'),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        if (!isAdmin && !hasModoRole) {
            console.warn(`[Permissions] Accès refusé pour ${interaction.member.user.tag} (pas admin ni modo)`);
            return interaction.reply({
                content: 'Vous n\'avez pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        console.log(`Début de /ticket par ${interaction.member.user.tag}`);

        try {
            await interaction.deferReply({ ephemeral: true });

            const buttonNewTicket = new ButtonBuilder()
                .setCustomId('ticket_type_6')
                .setLabel('Nouveau Ticket')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(buttonNewTicket);

            const imagePath = path.join(__dirname, '..', 'img', 'ticket.png');
            const attachment = new AttachmentBuilder(imagePath, { name: 'ticket_image.png' });

            await interaction.channel.send({
                components: [row],
                files: [attachment],
            });

            await interaction.editReply({
                content: 'Le message pour ouvrir un ticket a été envoyé.',
                ephemeral: true
            });
            console.log(`Message de ticket envoyé dans ${interaction.channel.id}`);
        } catch (error) {
            console.error('Erreur dans /ticket :', error.message, error.stack);
            await interaction.editReply({
                content: 'Une erreur est survenue lors de l\'exécution de la commande.',
                ephemeral: true
            });
        }
    },

    async handleButtonInteraction(interaction) {
        if (interaction.customId === 'ticket_type_6') {
            console.log(`Bouton ticket_type_6 cliqué par ${interaction.member.user.tag}`);
            try {
                await interaction.deferReply({ ephemeral: true }); // Ajouté

                const ticketUtils = require('../utils/ticketUtils');
                console.log('ticketUtils chargé dans handleButtonInteraction :', ticketUtils);

                const member = interaction.member;
                const guild = interaction.guild;

                const mentionRoles = '<@&1323677074631950528>';
                const content = `<@${member.id}>, ${mentionRoles}`;

                const embed = new EmbedBuilder()
                    .setDescription(`
                        ## Bienvenue sur le Donjon !
                        > Afin de débuter ton intégration, nous t'invitons à remplir ce formulaire et à répondre à **toutes** les questions.
                        > Cela nous aide à voir que tu as lu le règlement.

                        **Si tu n'as répondu à ce formulaire dans les 24h, tu seras simplement kick du serveur.**

                        > - Pseudo :
                        ↳
                        > - Âge :
                        ↳
                        > - Sexe/genre :
                        ↳
                        > - Comment as-tu connu le Donjon ?
                        ↳
                        > - Pourquoi nous rejoindre ?
                        ↳
                        > - Sous quelles conditions peux-tu avoir accès aux messages privés ?
                        ↳
                        > - As-tu lu et compris le règlement ?
                        ↳
                        > - Acceptes-tu le règlement ?
                        ↳
                        > - Comprends-tu les sanctions encourues en cas de manquement au règlement ?
                        ↳`)
                    .setColor('#FFAA00');

                await ticketUtils.createTicketChannel(interaction.client, guild, member, {
                    content: `<@${member.id}>, <@&1094318706487734483>`,
                    embeds: [embed],
                });

                await interaction.editReply({
                    content: 'Votre ticket a été créé avec succès.',
                    ephemeral: true
                });
                console.log(`Ticket créé pour ${member.user.tag}`);
            } catch (error) {
                console.error('Erreur lors de la création du ticket :', error.message, error.stack);
                await interaction.editReply({
                    content: 'Une erreur est survenue lors de la création de votre ticket.',
                    ephemeral: true
                });
            }
        }
    },

    async handleCloseTicket(interaction) {
        if (interaction.customId === 'close_ticket') {
            console.log(`Bouton close_ticket cliqué par ${interaction.member.user.tag}`);
            try {
                await interaction.deferReply({ ephemeral: true }); // Ajouté

                const ticketUtils = require('../utils/ticketUtils');
                console.log('ticketUtils chargé dans handleCloseTicket :', ticketUtils);

                const member = interaction.member;
                const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
                const modoRoleIds = process.env.MODO ? process.env.MODO.split(',').map(id => id.trim()) : [];
                const hasModoRole = modoRoleIds.some(roleId => member.roles.cache.has(roleId));

                if (!isAdmin && !hasModoRole) {
                    console.warn(`[Permissions] ${member.user.tag} a essayé de fermer un ticket sans permission`);
                    return interaction.editReply({
                        content: 'Vous n\'avez pas la permission de fermer ce ticket.',
                        ephemeral: true
                    });
                }

                const channel = interaction.channel;
                await ticketUtils.closeTicketChannel(channel, `Ticket fermé par ${member.user.tag}`);
                console.log(`Ticket ${channel.name} fermé par ${member.user.tag}`);
            } catch (error) {
                console.error('Erreur lors de la fermeture du ticket :', error.message, error.stack);
                await interaction.editReply({
                    content: 'Une erreur est survenue lors de la fermeture du ticket.',
                    ephemeral: true
                });
            }
        }
    },
};