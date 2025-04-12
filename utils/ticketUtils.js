// ticketUtils.js
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

async function createTicketChannel(client, guild, member, ticketType, customMessageOptions = null) {
    try {
        // Récupération de l’ID de la catégorie des tickets depuis les variables d’environnement
        const categoryId = process.env.TICKET_CATEGORY_ID;
        if (!categoryId) {
            throw new Error("L'ID de la catégorie des tickets (TICKET_CATEGORY_ID) n'est pas défini dans les variables d'environnement.");
        }

        // Vérifier que ticketType est une string
        if (typeof ticketType !== 'string') {
            console.error(`ticketType n'est pas une string : ${JSON.stringify(ticketType)}`);
            throw new Error('ticketType doit être une chaîne de caractères');
        }

        console.log(`Création d’un ticket pour ${member.user.tag} dans la catégorie ${categoryId} (Type: ${ticketType})`);

        // Vérification de la catégorie
        const category = await guild.channels.fetch(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory) {
            throw new Error(`Catégorie introuvable ou non valide : ${categoryId}`);
        }

        // Rôles de support depuis process.env.MODO
        const supportRoleIds = process.env.MODO ? process.env.MODO.split(',').map(id => id.trim()) : [];
        if (supportRoleIds.length === 0) {
            console.warn('MODO n’est pas défini ou vide dans les variables d’environnement.');
        }

        // Rôles spécifiques pour ticket-menu.js
        const defaultSupportRole = '1094318706487734483'; // Rôle par défaut pour tous les tickets sauf Partenariat
        const partnershipRole = '1340401306971672626';    // Rôle spécifique pour Partenariat
        const additionalRoles = ticketType === 'Partenariat' ? [partnershipRole] : [defaultSupportRole];

        // Rôles avec permission Administrator
        const adminRoleIds = [];
        for (const [roleId, role] of guild.roles.cache) {
            if (role.permissions.has(PermissionsBitField.Flags.Administrator)) {
                adminRoleIds.push(roleId);
            }
        }
        if (adminRoleIds.length === 0) {
            console.warn('Aucun rôle avec la permission Administrator trouvé dans le serveur.');
        } else {
            console.log(`Rôles admins détectés : ${adminRoleIds.join(', ')}`);
        }

        // Fusion des rôles (MODO + rôles spécifiques + admins)
        const allSupportRoles = [...new Set([...supportRoleIds, ...additionalRoles, ...adminRoleIds])]; // Évite les doublons

        // Création du canal de ticket avec un nom incluant le type
        const ticketChannel = await guild.channels.create({
            name: `🏷🔗${member.user.username}-${ticketType.toLowerCase()}`.slice(0, 32), // Nom : username-type
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `Ticket ouvert par ${member.user.tag} (${ticketType})`,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionsBitField.Flags.ViewChannel], // Invisible pour tous sauf ceux autorisés
                },
                {
                    id: member.id, // Utilisateur qui ouvre le ticket
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.AddReactions,
                        PermissionsBitField.Flags.UseExternalEmojis,
                    ],
                },
                {
                    id: client.user.id, // Le bot
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.ManageChannels,
                    ],
                },
                ...allSupportRoles.map(roleId => ({ // Rôles de support (MODO + rôles spécifiques + admins)
                    id: roleId,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.AddReactions,
                        PermissionsBitField.Flags.UseExternalEmojis,
                    ],
                })),
            ],
        });

        // Bouton de fermeture du ticket
        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fermer le ticket')
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(closeButton);

        // Construction du contenu avec ping des admins
        const adminMentions = adminRoleIds.map(roleId => `<@&${roleId}>`).join(' ');
        const baseContent = customMessageOptions?.content || `Bonjour ${member}, votre ticket a été ouvert pour "${ticketType}".`;
        const finalContent = `${baseContent} ${adminMentions}`.trim();

        // Envoi du message initial dans le ticket
        await ticketChannel.send({
            content: finalContent,
            embeds: customMessageOptions?.embeds || [],
            components: customMessageOptions?.components || [row], // Bouton par défaut si aucun composant personnalisé
        });

        console.log(`Ticket créé avec succès : ${ticketChannel.name} (ID: ${ticketChannel.id})`);
        return ticketChannel;

    } catch (error) {
        console.error('Erreur lors de la création du salon de ticket :', error.message, error.stack);
        throw error;
    }
}

async function fetchAllMessages(channel) {
    let allMessages = [];
    let lastId = null;
    while (true) {
        const messages = await channel.messages.fetch({ limit: 100, before: lastId });
        allMessages = allMessages.concat(Array.from(messages.values()));
        if (messages.size < 100) break;
        lastId = messages.last().id;
    }
    return allMessages;
}

async function closeTicketChannel(channel, reason) {
    try {
        console.log(`Tentative de fermeture du ticket ${channel.name} pour raison : "${reason}"`);

        // Vérifier permissions bot
        const botPermissions = channel.permissionsFor(channel.guild.members.me);
        if (!botPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
            console.error('Le bot manque la permission ManageChannels pour fermer le ticket');
            throw new Error('Permission ManageChannels manquante');
        }
        console.log('Permissions vérifiées pour fermeture');

        // Récupération de tous les messages du canal
        console.log('Récupération des messages');
        const messages = await fetchAllMessages(channel);
        const ticketOwner = channel.topic?.match(/Ticket ouvert par (.+?) \(/)?.[1] || 'Inconnu';
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        // Fonction pour générer une couleur unique par auteur
        const getAuthorColor = (authorId) => {
            const hash = authorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const hue = hash % 360;
            return `hsl(${hue}, 70%, 60%)`;
        };

        // Génération du contenu HTML pour la transcription
        console.log('Génération transcription HTML');
        let htmlContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Transcription du ticket ${channel.name}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #2f3136; color: #dcddde; padding: 20px; margin: 0; }
                    .container { max-width: 800px; margin: 0 auto; background-color: #36393f; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); }
                    .ticket-info { border-bottom: 2px solid #4f545c; padding-bottom: 15px; margin-bottom: 20px; }
                    .ticket-info h1 { margin: 0; color: #ffffff; font-size: 24px; }
                    .ticket-info p { margin: 5px 0; color: #b9bbbe; }
                    .message { padding: 10px; margin: 5px 0; border-radius: 5px; background-color: #40444b; }
                    .author { font-weight: bold; margin-right: 10px; }
                    .timestamp { color: #72767d; font-size: 0.85em; }
                    .content { margin: 5px 0; word-wrap: break-word; }
                    .embed { background-color: #202225; padding: 10px; border-left: 4px solid #5865f2; margin-top: 5px; border-radius: 3px; }
                    .embed-title { color: #ffffff; font-weight: bold; }
                    .embed-description { color: #dcddde; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="ticket-info">
                        <h1>Transcription du ticket : ${channel.name}</h1>
                        <p><strong>Serveur :</strong> ${channel.guild.name}</p>
                        <p><strong>Ouvert par :</strong> ${ticketOwner}</p>
                        <p><strong>Raison de fermeture :</strong> ${reason}</p>
                        <p><strong>Date de fermeture :</strong> ${new Date().toLocaleString()}</p>
                    </div>
        `;

        sortedMessages.forEach(msg => {
            const authorColor = getAuthorColor(msg.author.id);
            htmlContent += `
                <div class="message">
                    <span class="author" style="color: ${authorColor}">${msg.author.tag}</span>
                    <span class="timestamp">[${msg.createdAt.toLocaleString()}]</span>
                    <div class="content">${msg.content || '[Contenu vide]'}</div>
            `;

            if (msg.embeds.length > 0) {
                msg.embeds.forEach(embed => {
                    htmlContent += `
                        <div class="embed">
                            ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
                            ${embed.description ? `<div class="embed-description">${embed.description}</div>` : ''}
                        </div>
                    `;
                });
            }

            htmlContent += `</div>`;
        });

        htmlContent += `
                </div>
            </body>
            </html>
        `;

        // Sauvegarde de la transcription en fichier HTML
        console.log('Sauvegarde transcription');
        const safeOwnerName = ticketOwner.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = path.join(__dirname, `ticket_${safeOwnerName}_${channel.id}.html`);
        await fs.writeFile(filePath, htmlContent, 'utf8');

        // Embed pour annoncer la fermeture dans le canal
        console.log('Envoi embed fermeture');
        const closeEmbed = new EmbedBuilder()
            .setTitle('Ticket fermé')
            .setDescription(`Le ticket a été fermé pour la raison suivante :\n\n"${reason}"`)
            .setColor('#FF0000');

        await channel.send({ embeds: [closeEmbed] });

        // Envoi de la transcription dans le canal de logs (si défini)
        console.log('Vérification canal de logs');
        const logGuildId = process.env.TICKET_LOG_GUILD_ID;
        const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;

        if (!logGuildId || !logChannelId) {
            console.warn('TICKET_LOG_GUILD_ID ou TICKET_LOG_CHANNEL_ID non défini(s). Transcription non envoyée.');
        } else {
            const logGuild = channel.client.guilds.cache.get(logGuildId);
            if (!logGuild) {
                console.error(`Serveur cible ${logGuildId} introuvable. Le bot doit être présent sur ce serveur.`);
            } else {
                const logChannel = logGuild.channels.cache.get(logChannelId);
                if (!logChannel || logChannel.type !== ChannelType.GuildText) {
                    console.error(`Salon textuel ${logChannelId} introuvable ou non valide dans le serveur ${logGuildId}.`);
                } else {
                    console.log('Envoi transcription au canal de logs');
                    await logChannel.send({
                        content: `**Transcription du ticket ${channel.name}**\nOuvert par : ${ticketOwner}\nRaison de fermeture : "${reason}"`,
                        files: [filePath]
                    });
                    console.log(`Transcription HTML envoyée dans le salon ${logChannel.name} (ID: ${logChannel.id}) du serveur ${logGuild.name}`);
                }
            }
        }

        // Suppression du fichier temporaire
        console.log('Suppression fichier temporaire');
        try {
            await fs.unlink(filePath);
            console.log('Fichier temporaire supprimé');
        } catch (unlinkError) {
            console.error('Erreur lors de la suppression du fichier temporaire :', unlinkError.message);
        }

        // Suppression du canal
        console.log('Suppression du canal');
        await channel.delete(`Ticket fermé : ${reason}`);
        console.log(`Ticket fermé avec succès : ${channel.name}`);

        return { success: true };

    } catch (error) {
        console.error('Erreur lors de la fermeture du ticket :', error.message, error.stack);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createTicketChannel,
    closeTicketChannel
};