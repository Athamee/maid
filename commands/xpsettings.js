const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpsettings')
        .setDescription('Régler ou voir les gains d’XP (admins uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Restreint aux admins uniquement
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
            subcommand.setName('view').setDescription('Voir les paramètres actuels d’XP')
        ),

    async execute(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        try {
            // Vérification uniquement pour les admins (modoRoleId n’est plus utilisé ici)
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
                        name: `vocal-${voiceChannel.name}`,
                        type: 0,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
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
            } else if (subcommand === 'view') {
                // La sous-commande 'view' est accessible aux admins uniquement ici
                const xpSettingsResult = await pool.query('SELECT * FROM xp_settings WHERE guild_id = $1', [guildId]);
                const xpSettings = xpSettingsResult.rows[0] || {
                    message_xp: 10,
                    voice_xp_per_min: 5,
                    reaction_xp: 2,
                    image_xp: 15,
                    level_up_channel: null,
                    excluded_roles: '[]',
                    no_camera_channels: '[]',
                    default_level_message: '🎉 Niveau {level}, {user} ! Continue comme ça !'
                };
                const excludedRoles = JSON.parse(xpSettings.excluded_roles);
                const noCameraChannels = JSON.parse(xpSettings.no_camera_channels);

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