const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const pool = require('../db');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('savedb')
        .setDescription('Sauvegarde la base de données du serveur dans un fichier JSON (fondateur uniquement)'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const ownerId = interaction.guild.ownerId;

        // Vérifie si l’utilisateur est le propriétaire du serveur
        if (userId !== ownerId) {
            return interaction.reply({ content: 'Seul le fondateur du serveur peut utiliser cette commande !', ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true }); // Défère la réponse car ça peut prendre du temps

            // Récupère toutes les données des tables pour ce guild_id
            const warnsResult = await pool.query('SELECT * FROM warns WHERE guild_id = $1', [guildId]);
            const xpResult = await pool.query('SELECT * FROM xp WHERE guild_id = $1', [guildId]);
            const xpSettingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
            const levelMessagesResult = await pool.query('SELECT * FROM level_up_messages WHERE guild_id = $1', [guildId]);
            const voiceRoleSettingsResult = await pool.query('SELECT * FROM voice_role_settings WHERE guild_id = $1', [guildId]);

            // Structure des données à sauvegarder
            const backupData = {
                warns: warnsResult.rows,
                xp: xpResult.rows,
                xp_settings: xpSettingsResult.rows,
                level_up_messages: levelMessagesResult.rows,
                voice_role_settings: voiceRoleSettingsResult.rows
            };

            // Génère un nom de fichier unique avec timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `backup-${guildId}-${timestamp}.json`;
            const filePath = path.join(__dirname, '..', 'backups', fileName);

            // Crée le dossier backups s’il n’existe pas
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            // Écrit le fichier JSON
            await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf8');

            // Crée un embed de confirmation
            const embed = new EmbedBuilder()
                .setTitle('Sauvegarde réussie')
                .setDescription(`La base de données du serveur a été sauvegardée dans \`${fileName}\`.`)
                .setColor('#00FF00')
                .setTimestamp();

            // Envoie le fichier JSON dans la réponse
            await interaction.editReply({
                embeds: [embed],
                files: [filePath],
                ephemeral: true
            });

            console.log(`Base de données sauvegardée pour le serveur ${guildId} dans ${fileName}`);
        } catch (error) {
            console.error(`Erreur lors de la sauvegarde de la BD pour ${guildId} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de la sauvegarde de la base de données.', ephemeral: true });
        }
    }
};