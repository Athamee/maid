const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
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

            // Construire la liste pour l’embed
            const topList = await Promise.all(rows.map(async (row, index) => {
                const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                const username = member ? member.user.tag : `Utilisateur inconnu (${row.user_id})`;
                return `${index + 1}. **${username}** - Niveau ${row.level} (${row.xp} XP)`;
            }));

            // Limiter à 10 premiers (ou ajuster selon tes besoins)
            const displayList = topList.slice(0, 10).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🏆 Classement XP du serveur')
                .setDescription(displayList || 'Aucune donnée à afficher.')
                .setColor('#00FFAA')
                .setFooter({ text: `Total des membres avec XP : ${rows.length}` })
                .setTimestamp();

            // Réponse visible pour tous
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur top :', error.stack);
            await interaction.editReply({ content: 'Erreur lors de la récupération du classement.', ephemeral: true });
        }
    }
};