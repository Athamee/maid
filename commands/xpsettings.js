const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpsettings')
        .setDescription('Régler ou voir les gains d’XP et paramètres (admins uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('set-message').setDescription('Définir l’XP par message')
                .addIntegerOption(option => option.setName('xp').setDescription('Valeur d’XP par message').setRequired(true).setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-voice').setDescription('Définir l’XP par minute en vocal')
                .addIntegerOption(option => option.setName('xp').setDescription('Valeur d’XP par minute en vocal').setRequired(true).setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-reaction').setDescription('Définir l’XP par réaction')
                .addIntegerOption(option => option.setName('xp').setDescription('Valeur d’XP par réaction').setRequired(true).setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-image').setDescription('Définir l’XP par image')
                .addIntegerOption(option => option.setName('xp').setDescription('Valeur d’XP par image').setRequired(true).setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-channel').setDescription('Définir le salon pour les annonces de niveau')
                .addChannelOption(option => option.setName('channel').setDescription('Salon où envoyer les montées de niveau').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-level-message').setDescription('Définir un message personnalisé pour un niveau')
                .addIntegerOption(option => option.setName('level').setDescription('Niveau à personnaliser').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('message').setDescription('Message avec {user} pour le membre et @mentions pour ping').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('exclude-roles').setDescription('Exclure des rôles des gains d’XP')
                .addStringOption(option => option.setName('roles').setDescription('Liste d’IDs de rôles séparés par des virgules').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-no-camera').setDescription('Interdire la caméra dans des salons vocaux')
                .addStringOption(option => option.setName('channels').setDescription('Liste d’IDs de salons séparés par des virgules').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-voice-role').setDescription('Définir un rôle et canal écrit pour un salon vocal')
                .addChannelOption(option => option.setName('voice_channel').setDescription('Salon vocal').setRequired(true))
                .addRoleOption(option => option.setName('role').setDescription('Rôle à attribuer').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-default-message').setDescription('Définir le message par défaut pour les niveaux non personnalisés')
                .addStringOption(option => option.setName('message').setDescription('Message avec {level} et {user}').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('set-spam').setDescription('Configurer le filtre anti-spam')
                .addIntegerOption(option => option.setName('message_limit').setDescription('Max messages dans le temps imparti').setRequired(true).setMinValue(1))
                .addIntegerOption(option => option.setName('time_window').setDescription('Fenêtre temporelle (secondes)').setRequired(true).setMinValue(1))
                .addIntegerOption(option => option.setName('repeat_limit').setDescription('Max messages identiques').setRequired(true).setMinValue(1))
                .addIntegerOption(option => option.setName('mention_limit').setDescription('Max mentions par message').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('action').setDescription('Action à prendre').setRequired(true)
                    .addChoices(
                        { name: 'Avertir', value: 'warn' }
                    ))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('view').setDescription('Voir les paramètres actuels d’XP')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-channel').setDescription('Effacer le salon des annonces de niveau')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-excluded-roles').setDescription('Effacer la liste des rôles exclus')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-no-camera').setDescription('Effacer la liste des salons sans caméra')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-level-message').setDescription('Effacer le message personnalisé d’un niveau spécifique')
                .addIntegerOption(option => option.setName('level').setDescription('Niveau à effacer').setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-default-message').setDescription('Réinitialiser le message par défaut')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-spam').setDescription('Réinitialiser les paramètres anti-spam')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('clear-voice-role').setDescription('Supprimer l’association rôle/salon vocal et le canal texte associé')
                .addChannelOption(option => option.setName('voice_channel').setDescription('Salon vocal à nettoyer').setRequired(true))
        ),

    async execute(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand.startsWith('set-') || subcommand === 'exclude-roles') {
                if (!isAdmin) {
                    return interaction.reply({ content: 'Permission refusée. Seuls les administrateurs peuvent modifier ces paramètres.', ephemeral: true });
                }

                if (subcommand === 'set-channel') {
                    const channel = interaction.options.getChannel('channel');
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, level_up_channel) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET level_up_channel = $2',
                        [guildId, channel.id]
                    );
                    await interaction.reply({ content: `Salon des annonces de niveau défini sur ${channel}.`, ephemeral: true });
                } else if (subcommand === 'set-level-message') {
                    const level = interaction.options.getInteger('level');
                    const message = interaction.options.getString('message');
                    await pool.query(
                        'INSERT INTO level_up_messages (guild_id, level, message) VALUES ($1, $2, $3) ON CONFLICT (guild_id, level) DO UPDATE SET message = $3',
                        [guildId, level, message]
                    );
                    await interaction.reply({ content: `Message pour le niveau ${level} défini : "${message}"`, ephemeral: true });
                } else if (subcommand === 'exclude-roles') {
                    const roles = interaction.options.getString('roles').split(',').map(id => id.trim());
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, excluded_roles) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET excluded_roles = $2',
                        [guildId, JSON.stringify(roles)]
                    );
                    await interaction.reply({ content: `Rôles exclus des XP : ${roles.map(id => `<@&${id}>`).join(', ')}`, ephemeral: true });
                } else if (subcommand === 'set-no-camera') {
                    const channels = interaction.options.getString('channels').split(',').map(id => id.trim());
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, no_camera_channels) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET no_camera_channels = $2',
                        [guildId, JSON.stringify(channels)]
                    );
                    await interaction.reply({ content: `Caméra interdite dans : ${channels.map(id => `<#${id}>`).join(', ')}`, ephemeral: true });
                } else if (subcommand === 'set-voice-role') {
                    const voiceChannel = interaction.options.getChannel('voice_channel');
                    const role = interaction.options.getRole('role');
                    const textChannel = await interaction.guild.channels.create({
                        name: voiceChannel.name,
                        type: 0,
                        parent: voiceChannel.parentId,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            {
                                id: role.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.AddReactions,
                                    PermissionFlagsBits.EmbedLinks,
                                    PermissionFlagsBits.UseExternalEmojis
                                ]
                            }
                        ]
                    });
                    await pool.query(
                        'INSERT INTO voice_role_settings (guild_id, voice_channel_id, role_id, text_channel_id) VALUES ($1, $2, $3, $4) ' +
                        'ON CONFLICT (guild_id, voice_channel_id) DO UPDATE SET role_id = $3, text_channel_id = $4',
                        [guildId, voiceChannel.id, role.id, textChannel.id]
                    );
                    await interaction.reply({ content: `Rôle ${role} et canal ${textChannel} liés à ${voiceChannel}.`, ephemeral: true });
                } else if (subcommand === 'set-default-message') {
                    const message = interaction.options.getString('message');
                    if (!message) {
                        return interaction.reply({ content: 'Le message ne peut pas être vide.', ephemeral: true });
                    }
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, default_level_message) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET default_level_message = $2',
                        [guildId, message]
                    );
                    await interaction.reply({ content: `Message par défaut défini : "${message}"`, ephemeral: true });
                } else if (subcommand === 'set-spam') {
                    const spamSettings = {
                        message_limit: interaction.options.getInteger('message_limit'),
                        time_window: interaction.options.getInteger('time_window') * 1000, // Convertir en ms
                        repeat_limit: interaction.options.getInteger('repeat_limit'),
                        mention_limit: interaction.options.getInteger('mention_limit'),
                        action: interaction.options.getString('action')
                    };
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, spam_settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET spam_settings = $2',
                        [guildId, JSON.stringify(spamSettings)]
                    );
                    await interaction.reply({ content: `Filtre anti-spam configuré : ${spamSettings.message_limit} messages en ${spamSettings.time_window / 1000}s, ${spamSettings.repeat_limit} répétés, ${spamSettings.mention_limit} mentions, action: ${spamSettings.action}.`, ephemeral: true });
                } else {
                    const xpValue = interaction.options.getInteger('xp');
                    let column;

                    switch (subcommand) {
                        case 'set-message': column = 'message_xp'; break;
                        case 'set-voice': column = 'voice_xp_per_min'; break;
                        case 'set-reaction': column = 'reaction_xp'; break;
                        case 'set-image': column = 'image_xp'; break;
                    }

                    await pool.query(
                        `INSERT INTO xp_settings (guild_id, ${column}) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET ${column} = $2`,
                        [guildId, xpValue]
                    );
                    await interaction.reply({ content: `Paramètre mis à jour : ${column.replace('_', ' ')} défini à ${xpValue} XP.`, ephemeral: true });
                }
            } else if (subcommand.startsWith('clear-')) {
                if (!isAdmin) {
                    return interaction.reply({ content: 'Permission refusée. Seuls les administrateurs peuvent effacer ces paramètres.', ephemeral: true });
                }

                if (subcommand === 'clear-channel') {
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, level_up_channel) VALUES ($1, NULL) ON CONFLICT (guild_id) DO UPDATE SET level_up_channel = NULL',
                        [guildId]
                    );
                    await interaction.reply({ content: 'Le salon des annonces de niveau a été effacé.', ephemeral: true });
                } else if (subcommand === 'clear-excluded-roles') {
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, excluded_roles) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET excluded_roles = $2',
                        [guildId, '[]']
                    );
                    await interaction.reply({ content: 'La liste des rôles exclus a été effacée.', ephemeral: true });
                } else if (subcommand === 'clear-no-camera') {
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, no_camera_channels) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET no_camera_channels = $2',
                        [guildId, '[]']
                    );
                    await interaction.reply({ content: 'La liste des salons sans caméra a été effacée.', ephemeral: true });
                } else if (subcommand === 'clear-level-message') {
                    const level = interaction.options.getInteger('level');
                    await pool.query(
                        'DELETE FROM level_up_messages WHERE guild_id = $1 AND level = $2',
                        [guildId, level]
                    );
                    await interaction.reply({ content: `Le message personnalisé pour le niveau ${level} a été effacé.`, ephemeral: true });
                } else if (subcommand === 'clear-default-message') {
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, default_level_message) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET default_level_message = $2',
                        [guildId, 'Félicitations {user}, tu es désormais niveau {level} ! Continue d’explorer tes désirs intimes sur le Donjon. 😈']
                    );
                    await interaction.reply({ content: 'Le message par défaut a été réinitialisé à sa valeur initiale.', ephemeral: true });
                } else if (subcommand === 'clear-spam') {
                    await pool.query(
                        'INSERT INTO xp_settings (guild_id, spam_settings) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET spam_settings = $2',
                        [guildId, '{}']
                    );
                    await interaction.reply({ content: 'Les paramètres anti-spam ont été réinitialisés.', ephemeral: true });
                } else if (subcommand === 'clear-voice-role') {
                    const voiceChannel = interaction.options.getChannel('voice_channel');
                    const result = await pool.query(
                        'DELETE FROM voice_role_settings WHERE guild_id = $1 AND voice_channel_id = $2 RETURNING text_channel_id',
                        [guildId, voiceChannel.id]
                    );

                    if (result.rowCount === 0) {
                        return interaction.reply({ content: `Aucune association trouvée pour le salon vocal ${voiceChannel}.`, ephemeral: true });
                    }

                    const textChannelId = result.rows[0].text_channel_id;
                    const textChannel = interaction.guild.channels.cache.get(textChannelId);

                    if (textChannel) {
                        try {
                            await textChannel.delete();
                            console.log(`[xpsettings] Canal texte ${textChannel.name} (${textChannelId}) supprimé pour ${voiceChannel.name}`);
                        } catch (error) {
                            console.error(`[xpsettings] Erreur lors de la suppression du canal texte ${textChannelId} :`, error.message);
                        }
                    }

                    await interaction.reply({ content: `Association pour ${voiceChannel} supprimée.${textChannel ? ` Canal texte ${textChannel.name} également supprimé.` : ''}`, ephemeral: true });
                }
            } else if (subcommand === 'view') {
                const xpSettingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
                const xpSettings = xpSettingsResult.rows[0] || {
                    message_xp: 10,
                    voice_xp_per_min: 5,
                    reaction_xp: 2,
                    image_xp: 15,
                    level_up_channel: null,
                    excluded_roles: '[]',
                    no_camera_channels: '[]',
                    spam_settings: '{}',
                    default_level_message: 'Félicitations {user}, tu es désormais niveau {level} ! Continue d’explorer tes désirs intimes sur le Donjon. 😈'
                };

                const excludedRoles = JSON.parse(xpSettings.excluded_roles || '[]');
                const noCameraChannels = JSON.parse(xpSettings.no_camera_channels || '[]');
                const spamSettings = JSON.parse(xpSettings.spam_settings || '{}');

                const voiceRoleResult = await pool.query('SELECT * FROM voice_role_settings WHERE guild_id = $1', [guildId]);
                const voiceRoleSettings = voiceRoleResult.rows;

                const levelMessagesResult = await pool.query(
                    'SELECT level, message FROM level_up_messages WHERE guild_id = $1 ORDER BY level ASC',
                    [guildId]
                );
                const levelMessages = levelMessagesResult.rows;

                const embed = new EmbedBuilder()
                    .setTitle('Paramètres XP du serveur')
                    .setColor('#00FFAA')
                    .addFields(
                        { name: 'XP par message', value: `${xpSettings.message_xp}`, inline: true },
                        { name: 'XP par minute en vocal', value: `${xpSettings.voice_xp_per_min}`, inline: true },
                        { name: 'XP par réaction', value: `${xpSettings.reaction_xp}`, inline: true },
                        { name: 'XP par image', value: `${xpSettings.image_xp}`, inline: true },
                        { name: 'Salon des niveaux', value: xpSettings.level_up_channel ? `<#${xpSettings.level_up_channel}>` : 'Non défini', inline: true },
                        { name: 'Rôles exclus', value: excludedRoles.length > 0 ? excludedRoles.map(id => `<@&${id}>`).join(', ') : 'Aucun', inline: true },
                        { name: 'Salons sans caméra', value: noCameraChannels.length > 0 ? noCameraChannels.map(id => `<#${id}>`).join(', ') : 'Aucun', inline: true },
                        {
                            name: 'Anti-spam',
                            value: spamSettings.message_limit
                                ? `${spamSettings.message_limit} messages en ${spamSettings.time_window / 1000}s, ${spamSettings.repeat_limit} répétés, ${spamSettings.mention_limit} mentions, action: ${spamSettings.action}`
                                : 'Non configuré',
                            inline: true
                        },
                        {
                            name: 'Rôles vocaux',
                            value: voiceRoleSettings.length > 0
                                ? voiceRoleSettings.map(v => `<#${v.voice_channel_id}> : <@&${v.role_id}> (texte: <#${v.text_channel_id}>)`).join('\n')
                                : 'Aucun',
                            inline: false
                        },
                        {
                            name: 'Message par défaut',
                            value: xpSettings.default_level_message,
                            inline: false
                        },
                        {
                            name: 'Messages de niveau personnalisés',
                            value: levelMessages.length > 0
                                ? levelMessages.map(m => `Niveau ${m.level} : ${m.message}`).join('\n')
                                : 'Aucun message personnalisé défini',
                            inline: false
                        }
                    );

                await interaction.reply({ embeds: [embed], ephemeral: false });
            }
        } catch (error) {
            console.error(`Erreur xpsettings (${subcommand}) :`, error.stack);
            await interaction.reply({ content: 'Erreur lors de la gestion des paramètres XP.', ephemeral: true });
        }
    }
};