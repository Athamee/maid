const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    // Définit la commande Slash "resetdb"
    data: new SlashCommandBuilder()
        .setName('resetdb')
        .setDescription('Réinitialise la base de données pour ce serveur (fondateur uniquement)'),

    // Fonction exécutée quand la commande est utilisée
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const ownerId = interaction.guild.ownerId;

        // Vérifie si l’utilisateur est le propriétaire du serveur
        if (userId !== ownerId) {
            return interaction.reply({ content: 'Seul le fondateur du serveur peut utiliser cette commande !', ephemeral: true });
        }

        try {
            // Démarre une transaction pour garantir que toutes les suppressions réussissent ou aucune ne s’applique
            await pool.query('BEGIN');

            // Supprime toutes les données liées à ce guild_id dans chaque table
            await pool.query('DELETE FROM xp WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM xp_settings WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM level_up_messages WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM voice_role_settings WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM warns WHERE guild_id = $1', [guildId]);

            // Valide la transaction
            await pool.query('COMMIT');

            // Crée un embed pour confirmer la réinitialisation
            const embed = new EmbedBuilder()
                .setTitle('Base de données réinitialisée')
                .setDescription('Toutes les données XP, paramètres, messages de niveau, rôles vocaux et avertissements pour ce serveur ont été supprimées.')
                .setColor('#FF0000') // Rouge pour indiquer une action importante
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: false });
            console.log(`Base de données réinitialisée pour le serveur ${guildId} par ${interaction.user.tag}`);
        } catch (error) {
            // En cas d’erreur, annule la transaction
            await pool.query('ROLLBACK');
            console.error(`Erreur lors de la réinitialisation de la BD pour ${guildId} :`, error.stack);
            await interaction.reply({ content: 'Erreur lors de la réinitialisation de la base de données.', ephemeral: true });
        }
    }
};