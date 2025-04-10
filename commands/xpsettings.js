const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpsettings')
        .setDescription('Régler ou voir les gains d’XP')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-message')
                .setDescription('Définir l’XP par message (modo only)')
                .addIntegerOption(option => 
                    option.setName('xp')
                        .setDescription('Valeur d’XP par message')
                        .setRequired(true)
                        .setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-voice')
                .setDescription('Définir l’XP par minute en vocal (modo only)')
                .addIntegerOption(option => 
                    option.setName('xp')
                        .setDescription('Valeur d’XP par minute en vocal')
                        .setRequired(true)
                        .setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-reaction')
                .setDescription('Définir l’XP par réaction (modo only)')
                .addIntegerOption(option => 
                    option.setName('xp')
                        .setDescription('Valeur d’XP par réaction')
                        .setRequired(true)
                        .setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-image')
                .setDescription('Définir l’XP par image (modo only)')
                .addIntegerOption(option => 
                    option.setName('xp')
                        .setDescription('Valeur d’XP par image')
                        .setRequired(true)
                        .setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Voir les paramètres actuels d’XP (visible par tous)')
        ),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand.startsWith('set-')) {
                // Vérification des permissions pour les sous-commandes set-*
                if (!isAdmin && !hasModoRole) {
                    return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
                }

                const xpValue = interaction.options.getInteger('xp');
                let column;

                switch (subcommand) {
                    case 'set-message':
                        column = 'message_xp';
                        break;
                    case 'set-voice':
                        column = 'voice_xp_per_min';
                        break;
                    case 'set-reaction':
                        column = 'reaction_xp';
                        break;
                    case 'set-image':
                        column = 'image_xp';
                        break;
                }

                await pool.query(
                    `INSERT INTO xp_settings (guild_id, ${column}) VALUES ($1, $2) 
                     ON CONFLICT (guild_id) DO UPDATE SET ${column} = $2`,
                    [guildId, xpValue]
                );

                await interaction.reply({ 
                    content: `Paramètre mis à jour : ${column.replace('_', ' ')} défini à ${xpValue} XP.`, 
                    ephemeral: true 
                });
            } else if (subcommand === 'view') {
                // Pas de restriction pour view, visible par tous
                const result = await pool.query(
                    'SELECT * FROM xp_settings WHERE guild_id = $1',
                    [guildId]
                );
                const settings = result.rows[0] || {
                    message_xp: 10,
                    voice_xp_per_min: 5,
                    reaction_xp: 2,
                    image_xp: 15
                };

                const embed = new EmbedBuilder()
                    .setTitle('Paramètres XP du serveur')
                    .setColor('#00FFAA')
                    .addFields(
                        { name: 'XP par message', value: `${settings.message_xp}`, inline: true },
                        { name: 'XP par minute en vocal', value: `${settings.voice_xp_per_min}`, inline: true },
                        { name: 'XP par réaction', value: `${settings.reaction_xp}`, inline: true },
                        { name: 'XP par image', value: `${settings.image_xp}`, inline: true }
                    );

                // Réponse publique (non-éphemère)
                await interaction.reply({ embeds: [embed], ephemeral: false });
            }
        } catch (error) {
            console.error(`Erreur xpsettings (${subcommand}) :`, error.stack);
            await interaction.reply({ content: 'Erreur lors de la gestion des paramètres XP.', ephemeral: true });
        }
    }
};