const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getwarns')
        .setDescription('Voir les warns d’un membre (modo only)')
        .addUserOption(option => option.setName('target').setDescription('Membre à vérifier').setRequired(true)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');

        try {
            const result = await pool.query(
                'SELECT * FROM warns WHERE user_id = $1 AND guild_id = $2 ORDER BY timestamp DESC',
                [target.id, interaction.guild.id]
            );
            const warns = result.rows;

            if (warns.length === 0) {
                return interaction.reply({ content: `${target.tag} n’a aucun warn.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Warns de ${target.tag}`)
                .setColor('#FFAA00')
                .setDescription(warns.map(w => 
                    `ID: ${w.id} | Raison: ${w.reason} | Par: <@${w.moderator_id}> | Date: ${w.timestamp.toLocaleString()}`
                ).join('\n'))
                .setFooter({ text: `Total : ${warns.length} warns` });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Erreur getwarns :', error.stack);
            await interaction.reply({ content: 'Erreur lors de la récupération des warns.', ephemeral: true });
        }
    }
};