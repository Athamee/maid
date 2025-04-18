const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loaddb')
        .setDescription('Restaure la base de données du serveur à partir d’un fichier JSON (fondateur uniquement)')
        .addAttachmentOption(option =>
            option.setName('backup_file')
                .setDescription('Le fichier JSON de sauvegarde à restaurer')
                .setRequired(true)
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const ownerId = interaction.guild.ownerId;

        // Vérifie si l’utilisateur est le propriétaire du serveur
        if (userId !== ownerId) {
            return interaction.reply({ content: 'Seul le fondateur du serveur peut utiliser cette commande !', ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const attachment = interaction.options.getAttachment('backup_file');
            if (!attachment.name.endsWith('.json')) {
                return interaction.editReply({ content: 'Veuillez fournir un fichier JSON valide.', ephemeral: true });
            }

            // Télécharge le contenu du fichier JSON
            const response = await fetch(attachment.url);
            const backupData = await response.json();

            // Vérifie que le fichier contient les données attendues
            if (!backupData.warns || !backupData.xp || !backupData.xp_settings || !backupData.level_up_messages || !backupData.voice_role_settings) {
                return interaction.editReply({ content: 'Fichier de sauvegarde invalide : données manquantes.', ephemeral: true });
            }

            // Démarre une transaction pour garantir l’intégrité
            await pool.query('BEGIN');

            // Supprime les données actuelles pour ce guild_id
            await pool.query('DELETE FROM warns WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM xp WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM xp_settings WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM level_up_messages WHERE guild_id = $1', [guildId]);
            await pool.query('DELETE FROM voice_role_settings WHERE guild_id = $1', [guildId]);

            // Réinsère les données sauvegardées
            for (const warn of backupData.warns) {
                await pool.query(
                    'INSERT INTO warns (id, user_id, guild_id, reason, moderator_id, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
                    [warn.id, warn.user_id, warn.guild_id, warn.reason, warn.moderator_id, warn.timestamp]
                );
            }
            for (const xp of backupData.xp) {
                await pool.query(
                    'INSERT INTO xp (user_id, guild_id, xp, level, last_message) VALUES ($1, $2, $3, $4, $5)',
                    [xp.user_id, xp.guild_id, xp.xp, xp.level, xp.last_message]
                );
            }
            for (const settings of backupData.xp_settings) {
                await pool.query(
                    'INSERT INTO xp_settings (guild_id, message_xp, voice_xp_per_min, reaction_xp, image_xp, level_up_channel, excluded_roles, no_camera_channels, default_level_message) ' +
                    'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                    [
                        settings.guild_id, settings.message_xp, settings.voice_xp_per_min, settings.reaction_xp,
                        settings.image_xp, settings.level_up_channel, settings.excluded_roles,
                        settings.no_camera_channels, settings.default_level_message
                    ]
                );
            }
            for (const message of backupData.level_up_messages) {
                await pool.query(
                    'INSERT INTO level_up_messages (guild_id, level, message) VALUES ($1, $2, $3)',
                    [message.guild_id, message.level, message.message]
                );
            }
            for (const voiceRole of backupData.voice_role_settings) {
                await pool.query(
                    'INSERT INTO voice_role_settings (guild_id, voice_channel_id, role_id, text_channel_id) VALUES ($1, $2, $3, $4)',
                    [voiceRole.guild_id, voiceRole.voice_channel_id, voiceRole.role_id, voiceRole.text_channel_id]
                );
            }

            // Valide la transaction
            await pool.query('COMMIT');

            // Crée un embed de confirmation
            const embed = new EmbedBuilder()
                .setTitle('Restauration réussie')
                .setDescription('La base de données du serveur a été restaurée à partir du fichier fourni.')
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });
            console.log(`Base de données restaurée pour le serveur ${guildId}`);
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error(`Erreur lors de la restauration de la BD pour ${guildId} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de la restauration de la base de données.', ephemeral: true });
        }
    }
};