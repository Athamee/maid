// Importer les modules nécessaires
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    // Définir la commande
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannir un membre spécifique (admin uniquement)')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Membre à bannir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Raison du ban (envoyée en DM et affichée)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('fichier_url')
                .setDescription('URL d’une image ou GIF à afficher (facultatif)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // Exécuter la commande
    async execute(interaction) {
        console.log(`[Ban] Commande exécutée par ${interaction.user.tag} dans ${interaction.guild.name} (ID: ${interaction.guild.id})`);

        // Vérifier les permissions du bot
        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
            console.error('[Ban] Erreur : Le bot manque la permission BanMembers');
            return interaction.reply({
                content: 'Erreur : Je n’ai pas la permission de bannir des membres.',
                ephemeral: true
            });
        }

        // Différer la réponse pour les opérations longues
        await interaction.deferReply();

        // Récupérer les options
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason');
        const fichierUrl = interaction.options.getString('fichier_url');
        const guild = interaction.guild;
        const inviteLink = process.env.INVITE_LINK;
        const kickChannelId = process.env.KICK_CHANNEL_ID;
        const ticketLogGuildId = process.env.TICKET_LOG_GUILD_ID;
        const piloriChannelId = process.env.PILORI_CHANNEL_ID;

        // Vérifier INVITE_LINK
        if (!inviteLink) {
            console.error('[Ban] Erreur : INVITE_LINK non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Lien d’invitation non configuré (INVITE_LINK manquant).',
                ephemeral: true
            });
        }

        // Vérifier KICK_CHANNEL_ID
        if (!kickChannelId) {
            console.error('[Ban] Erreur : KICK_CHANNEL_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Canal de logs non configuré (KICK_CHANNEL_ID manquant).',
                ephemeral: true
            });
        }

        // Vérifier TICKET_LOG_GUILD_ID
        if (!ticketLogGuildId) {
            console.error('[Ban] Erreur : TICKET_LOG_GUILD_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Serveur de logs non configuré (TICKET_LOG_GUILD_ID manquant).',
                ephemeral: true
            });
        }

        // Vérifier PILORI_CHANNEL_ID
        if (!piloriChannelId) {
            console.error('[Ban] Erreur : PILORI_CHANNEL_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Canal de pilori non configuré (PILORI_CHANNEL_ID manquant).',
                ephemeral: true
            });
        }

        try {
            // Vérifier le serveur de logs
            console.log(`[Ban] Vérification du serveur de logs ${ticketLogGuildId}`);
            const logGuild = await interaction.client.guilds.fetch(ticketLogGuildId).catch(() => null);
            if (!logGuild) {
                console.error(`[Ban] Erreur : TICKET_LOG_GUILD_ID (${ticketLogGuildId}) introuvable`);
                return interaction.editReply({
                    content: 'Erreur : Le serveur de logs (TICKET_LOG_GUILD_ID) est introuvable.',
                    ephemeral: true
                });
            }

            // Vérifier le canal de logs
            console.log(`[Ban] Vérification du canal ${kickChannelId} dans ${logGuild.name}`);
            const kickChannel = logGuild.channels.cache.get(kickChannelId);
            if (!kickChannel || !kickChannel.isTextBased()) {
                console.error(`[Ban] Erreur : KICK_CHANNEL_ID (${kickChannelId}) introuvable ou non textuel`);
                return interaction.editReply({
                    content: 'Erreur : Le canal de logs (KICK_CHANNEL_ID) est invalide ou non textuel.',
                    ephemeral: true
                });
            }

            // Vérifier le canal de pilori
            console.log(`[Ban] Vérification du canal ${piloriChannelId} dans ${guild.name}`);
            const piloriChannel = guild.channels.cache.get(piloriChannelId);
            if (!piloriChannel || !piloriChannel.isTextBased()) {
                console.error(`[Ban] Erreur : PILORI_CHANNEL_ID (${piloriChannelId}) introuvable ou non textuel`);
                return interaction.editReply({
                    content: 'Erreur : Le canal de pilori (PILORI_CHANNEL_ID) est invalide ou non textuel.',
                    ephemeral: true
                });
            }

            // Vérifier les permissions dans les canaux
            const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
            if (!botMember.permissionsIn(kickChannel).has(requiredPerms)) {
                console.error(`[Ban] Erreur : Permissions manquantes dans ${kickChannel.name} (${kickChannelId})`);
                return interaction.editReply({
                    content: 'Erreur : Je n’ai pas les permissions (Voir le salon, Envoyer des messages) dans le canal de logs.',
                    ephemeral: true
                });
            }
            if (!botMember.permissionsIn(piloriChannel).has(requiredPerms)) {
                console.error(`[Ban] Erreur : Permissions manquantes dans ${piloriChannel.name} (${piloriChannelId})`);
                return interaction.editReply({
                    content: 'Erreur : Je n’ai pas les permissions (Voir le salon, Envoyer des messages) dans le canal de pilori.',
                    ephemeral: true
                });
            }

            // Vérifier si la cible est bannable
            if (!target.bannable) {
                console.error(`[Ban] Erreur : Le membre ${target.user.tag} n’est pas bannable`);
                return interaction.editReply({
                    content: `Erreur : Je ne peux pas bannir ${target.user.tag} (non bannable, ex. rôle supérieur ou propriétaire).`,
                    ephemeral: true
                });
            }

            // Vérifier la hiérarchie des rôles
            if (target.roles.highest.position >= botMember.roles.highest.position) {
                console.error(`[Ban] Erreur : Le rôle le plus haut de ${target.user.tag} est supérieur ou égal au bot`);
                return interaction.editReply({
                    content: `Erreur : Je ne peux pas bannir ${target.user.tag} (rôle trop haut dans la hiérarchie).`,
                    ephemeral: true
                });
            }

            // Valider fichier/URL (si fourni)
            let mediaUrl = null;
            if (fichierUrl) {
                console.log(`[Ban] Vérification de l’URL : ${fichierUrl}`);
                // Vérifier si URL valide pour image/GIF
                const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
                const isValidUrl = fichierUrl.match(/^(https?:\/\/[^\s$.?#].[^\s]*)$/) &&
                    imageExtensions.some(ext => fichierUrl.toLowerCase().endsWith(ext));
                if (isValidUrl) {
                    mediaUrl = fichierUrl;
                    console.log(`[Ban] URL valide détectée : ${mediaUrl}`);
                } else {
                    console.warn(`[Ban] URL ou fichier invalide : ${fichierUrl}`);
                    return interaction.editReply({
                        content: 'Erreur : L’URL doit pointer vers une image ou un GIF (.png, .jpg, .jpeg, .gif).',
                        ephemeral: true
                    });
                }
            }

            console.log(`[Ban] Tentative de ban pour ${target.user.tag} (${target.id})`);

            // Bannir le membre
            try {
                await target.ban({ reason });
                console.log(`[Ban] ${target.user.tag} banni avec succès`);

                // Envoyer un DM au membre banni
                const dmMessage = `Salut ${target.user.tag},\nTu as été banni du serveur **${guild.name}** pour la raison suivante : **${reason}**.\nPour toute question, contacte un modérateur.`;
                await target.send(dmMessage).catch(err => {
                    console.warn(`[Ban] Impossible d’envoyer un DM à ${target.user.tag} : ${err.message}`);
                });

                // Envoyer le message dans PILORI_CHANNEL_ID
                const piloriMessage = `${target.user.tag} a été banni !\n${reason}${mediaUrl ? `\n${mediaUrl}` : ''}`;
                await piloriChannel.send({ content: piloriMessage });
                console.log(`[Ban] Message envoyé dans ${piloriChannel.name} (ID: ${piloriChannelId})`);

                // Logger dans KICK_CHANNEL_ID sur TICKET_LOG_GUILD_ID
                const logMessage = `[Ban] ${target.user.tag} banni par ${interaction.user.tag}. Raison : ${reason}${mediaUrl ? ` | Image: ${mediaUrl}` : ''}`;
                await kickChannel.send(logMessage);
                console.log(`[Ban] Log envoyé dans ${kickChannel.name} (ID: ${kickChannelId})`);

                // Créer l’embed de confirmation
                const embed = new EmbedBuilder()
                    .setTitle('Ban effectué')
                    .setColor('#FF0000')
                    .addFields(
                        { name: 'Membre banni', value: `${target.user.tag} (<@${target.id}>)`, inline: false },
                        { name: 'Raison', value: reason, inline: false }
                    );
                if (mediaUrl) {
                    embed.addFields({ name: 'Image/GIF', value: mediaUrl, inline: false });
                }
                embed.setFooter({ text: `Exécuté par ${interaction.user.tag}` })
                    .setTimestamp();

                // Répondre avec l’embed
                await interaction.editReply({ embeds: [embed] });
                console.log(`[Ban] Terminé : ${target.user.tag} banni`);
            } catch (error) {
                console.error(`[Ban] Erreur lors du ban de ${target.user.tag} : ${error.message}`);
                await kickChannel.send(`[Ban] Échec du ban de ${target.user.tag} par ${interaction.user.tag}. Erreur : ${error.message}`);
                return interaction.editReply({
                    content: `Erreur : Impossible de bannir ${target.user.tag}.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('[Ban] Erreur globale :', error.stack);
            await interaction.editReply({
                content: 'Erreur lors de l’exécution du ban.',
                ephemeral: true
            });
        }
    }
};