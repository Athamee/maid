const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre spécifié de messages dans ce canal (admin & modo)')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),

    // Métadonnées pour commands.js : rôles autorisés et restrictions de salons
    permissions: {
        roles: process.env.MODO ? [process.env.MODO] : [], // Rôle MODO, si défini
        bitPermissions: [
            PermissionFlagsBits.Administrator, // Réservé aux admins
            PermissionFlagsBits.ManageMessages // Ou permission de gérer les messages
        ]
    },
    restrictions: {
        allowedChannels: [], // Aucun salon spécifique requis (tous autorisés)
        restrictedChannels: [] // Aucun salon interdit
    },

    async execute(interaction) {
        // Vérification des permissions pour admin, modo ou gestion des messages
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);
        const canManageMessages = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (!isAdmin && !hasModoRole && !canManageMessages) {
            return interaction.reply({
                content: 'Permission refusée : tu dois avoir la permission de gérer les messages.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Récupérer le nombre de messages à supprimer
        const amount = interaction.options.getInteger('nombre');

        // Tenter de supprimer les messages
        try {
            const channel = interaction.channel;

            // Vérifier la présence de messages à supprimer
            const messages = await channel.messages.fetch({ limit: amount });
            if (messages.size === 0) {
                const noMessagesEmbed = new EmbedBuilder()
                    .setTitle('Aucun message')
                    .setDescription('Aucun message à supprimer dans ce canal.')
                    .setColor('#FFAA00');

                return interaction.reply({ 
                    embeds: [noMessagesEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Filtrer messages < 14 jours
            const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const validMessages = messages.filter(msg => msg.createdTimestamp > fourteenDaysAgo);
            console.log(`[Clear] ${validMessages.size} message(s) trouvé(s) (<14 jours) pour suppression par ${interaction.user.tag} dans ${channel.name}`);

            if (validMessages.size === 0) {
                const oldMessagesEmbed = new EmbedBuilder()
                    .setTitle('Messages trop vieux')
                    .setDescription('Aucun message récent à supprimer (moins de 14 jours).')
                    .setColor('#FFAA00');

                return interaction.reply({ 
                    embeds: [oldMessagesEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Tenter bulkDelete avec messages valides
            let deleted;
            try {
                deleted = await channel.bulkDelete(validMessages, true);
            } catch (bulkError) {
                console.warn(`[Clear] Échec bulkDelete pour ${interaction.user.tag} :`, bulkError.message);
                // Fallback : supprimer individuellement
                deleted = new Map();
                for (const msg of validMessages.values()) {
                    try {
                        await msg.delete();
                        deleted.set(msg.id, msg);
                    } catch (singleError) {
                        console.warn(`[Clear] Échec suppression message ${msg.id} :`, singleError.message);
                    }
                }
            }

            // Vérifier si la suppression a réellement fonctionné
            if (deleted.size < validMessages.size) {
                console.warn(`[Clear] Moins de messages supprimés (${deleted.size}/${validMessages.size}) par ${interaction.user.tag} dans ${channel.name}`);
            }

            // Loguer avant reply pour capturer le résultat
            console.log(`[Clear] Exécuté par ${interaction.user.tag} : ${deleted.size} message(s) supprimés dans ${channel.name}`);

            // Embed de succès
            const successEmbed = new EmbedBuilder()
                .setTitle('Messages supprimés')
                .setDescription(`${deleted.size} message(s) supprimé(s) avec succès.`)
                .setColor('#00FFAA');

            // Utiliser reply pour éviter [10008] Unknown Message, éphémère
            await interaction.reply({ 
                embeds: [successEmbed],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            // Embed d'erreur
            const errorEmbed = new EmbedBuilder()
                .setTitle('Erreur')
                .setDescription('Impossible de supprimer les messages.')
                .setColor('#FF0000');

            // Utiliser reply pour éviter [10008] Unknown Message, éphémère
            await interaction.reply({ 
                embeds: [errorEmbed],
                flags: MessageFlags.Ephemeral
            });

            console.error(`[Clear] Erreur pour ${interaction.user.tag} :`, error.stack);
        }
    }
};