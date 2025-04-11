const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre spécifié de messages dans ce canal (admin & modo)')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);
        const canManageMessages = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

        // Vérification des permissions
        if (!isAdmin && !hasModoRole && !canManageMessages) {
            return interaction.reply({ content: 'Permission refusée : tu dois avoir la permission de gérer les messages.', ephemeral: true });
        }

        const amount = interaction.options.getInteger('nombre');

        // Reporter la réponse pour éviter Unknown Interaction
        await interaction.deferReply();

        // Embed de confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('Confirmation de suppression')
            .setDescription(`Veux-tu vraiment supprimer **${amount} message(s)** dans ce canal ?`)
            .setColor('#FFAA00');

        // Boutons de confirmation
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Oui')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Non')
                    .setStyle(ButtonStyle.Secondary)
            );

        const message = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [buttons]
        });

        // Collecteur pour les boutons
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && ['confirm', 'cancel'].includes(i.customId),
            time: 15000 // 15 secondes pour répondre
        });

        collector.on('collect', async i => {
            if (i.customId === 'cancel') {
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('Suppression annulée').setColor('#00FFAA')],
                    components: []
                });
                return;
            }

            // Confirmation : supprimer les messages
            if (i.customId === 'confirm') {
                try {
                    const channel = interaction.channel;
                    const deleted = await channel.bulkDelete(amount, true); // true pour filtrer les messages < 14 jours

                    const successEmbed = new EmbedBuilder()
                        .setTitle('Messages supprimés')
                        .setDescription(`**${deleted.size} message(s)** ont été supprimés avec succès.`)
                        .setColor('#00FFAA');

                    await i.update({
                        embeds: [successEmbed],
                        components: []
                    });

                    console.log(`Clear exécuté par ${interaction.user.tag} : ${deleted.size} messages supprimés dans ${channel.name}`);
                } catch (error) {
                    console.error('Erreur clear :', error.stack);
                    await i.update({
                        embeds: [new EmbedBuilder().setTitle('Erreur').setDescription('Impossible de supprimer les messages.').setColor('#FF0000')],
                        components: []
                    });
                }
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [new EmbedBuilder().setTitle('Suppression annulée').setDescription('Temps écoulé.').setColor('#FFAA00')],
                    components: []
                }).catch(() => {});
            }
        });
    }
};