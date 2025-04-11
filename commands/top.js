const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Affiche le classement des membres par XP et niveau'),

    async execute(interaction) {
        // Reporter la réponse pour éviter Unknown Interaction
        await interaction.deferReply();

        const guildId = interaction.guild.id;

        try {
            // Récupérer tous les membres avec XP dans ce serveur, triés par XP décroissant
            const { rows } = await pool.query(
                'SELECT user_id, xp, level FROM xp WHERE guild_id = $1 ORDER BY xp DESC',
                [guildId]
            );

            if (rows.length === 0) {
                return interaction.editReply({ content: 'Aucun membre n’a encore gagné d’XP sur ce serveur.' });
            }

            // Préparer la liste complète avec avatars
            const topList = await Promise.all(rows.map(async (row, index) => {
                const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                const username = member ? member.user.tag : `Utilisateur inconnu (${row.user_id})`;
                const avatar = member ? member.user.displayAvatarURL() : null;
                return {
                    rank: index + 1,
                    username,
                    level: row.level,
                    xp: row.xp,
                    avatar
                };
            }));

            const itemsPerPage = 10;
            const totalPages = Math.ceil(topList.length / itemsPerPage);

            // Fonction pour générer l’embed pour une page donnée
            const generateEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = Math.min(start + itemsPerPage, topList.length);
                const pageItems = topList.slice(start, end);

                const description = pageItems.map(item => 
                    `${item.rank}. **${item.username}** - Niveau ${item.level} (${item.xp} XP)`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Classement XP du serveur')
                    .setDescription(description || 'Aucune donnée à afficher.')
                    .setColor('#00FFAA')
                    .setFooter({ text: `Page ${page + 1}/${totalPages} | Total des membres avec XP : ${topList.length}` })
                    .setTimestamp();

                // Ajouter la photo de profil du premier membre de la page comme thumbnail
                if (pageItems.length > 0 && pageItems[0].avatar) {
                    embed.setThumbnail(pageItems[0].avatar);
                }

                return embed;
            };

            // Boutons de pagination
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Précédent')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), // Désactivé par défaut (page 1)
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Suivant')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(totalPages <= 1) // Désactivé si une seule page
                );

            let currentPage = 0;

            // Envoyer le premier embed
            const message = await interaction.editReply({
                embeds: [generateEmbed(currentPage)],
                components: totalPages > 1 ? [buttons] : []
            });

            // Si une seule page, pas besoin de collecteur
            if (totalPages <= 1) return;

            // Collecteur pour les interactions des boutons
            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && ['prev', 'next'].includes(i.customId),
                time: 60000 // 60 secondes avant expiration
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev' && currentPage > 0) {
                    currentPage--;
                } else if (i.customId === 'next' && currentPage < totalPages - 1) {
                    currentPage++;
                }

                // Mettre à jour les boutons
                buttons.components[0].setDisabled(currentPage === 0);
                buttons.components[1].setDisabled(currentPage === totalPages - 1);

                // Mettre à jour l’embed
                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [buttons]
                });
            });

            collector.on('end', () => {
                // Désactiver les boutons après expiration
                buttons.components.forEach(button => button.setDisabled(true));
                interaction.editReply({ components: [buttons] }).catch(() => {});
            });

        } catch (error) {
            console.error('Erreur top :', error.stack);
            await interaction.editReply({ content: 'Erreur lors de la récupération du classement.', ephemeral: true });
        }
    }
};