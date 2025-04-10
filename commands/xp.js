const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const pool = require('../db');

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('Voir ton XP et ton niveau, ou ceux d’un autre membre')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Membre dont tu veux voir l’XP (optionnel)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('target') || interaction.user;
        const guildId = interaction.guild.id;
        const userId = target.id;

        try {
            const result = await pool.query(
                'SELECT xp, level FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            const data = result.rows[0] || { xp: 0, level: 1 };

            const currentXp = data.xp;
            const currentLevel = data.level;
            const xpForNextLevel = getRequiredXp(currentLevel + 1);
            const xpRemaining = xpForNextLevel - currentXp;

            const embed = new EmbedBuilder()
                .setTitle(`Profil XP de ${target.tag}`)
                .setColor('#00FFAA')
                .addFields(
                    { name: 'Niveau actuel', value: `${currentLevel}`, inline: true },
                    { name: 'XP total', value: `${currentXp}`, inline: true },
                    { name: 'XP pour le prochain niveau', value: `${xpRemaining} / ${xpForNextLevel}`, inline: true }
                )
                .setThumbnail(target.displayAvatarURL());

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Erreur xp :', error.stack);
            await interaction.reply({ content: 'Erreur lors de la récupération de l’XP.', ephemeral: true });
        }
    }
};