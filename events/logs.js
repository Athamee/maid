// events/logs.js
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        // Récupérer le serveur de logs
        const logGuildId = process.env.TICKET_LOG_GUILD_ID;
        const logGuild = client.guilds.cache.get(logGuildId);

        if (!logGuild) {
            console.error(`[Logs] Serveur de logs non trouvé : ${logGuildId}`);
            return;
        }

        // Récupérer les salons depuis .env
        const logChannels = {
            vocal: logGuild.channels.cache.get(process.env.LOG_VOCAL_ID),
            roles: logGuild.channels.cache.get(process.env.LOG_ROLES_ID),
            members: logGuild.channels.cache.get(process.env.LOG_MEMBERS_ID),
            channels: logGuild.channels.cache.get(process.env.LOG_CHANNELS_ID),
            messages: logGuild.channels.cache.get(process.env.LOG_MESSAGES_ID),
        };

        // Vérifier chaque salon
        for (const [type, channel] of Object.entries(logChannels)) {
            if (!channel || channel.type !== ChannelType.GuildText) {
                console.error(`[Logs] Salon textuel ${type} non trouvé ou invalide : ${process.env[`LOG_${type.toUpperCase()}_ID`]}`);
                continue;
            }
            const perms = channel.permissionsFor(client.user);
            if (!perms.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                console.error(`[Logs] Permissions manquantes pour ${type} dans ${channel.id} :`, perms.toArray());
                continue;
            }
            console.log(`[Logs] Salon ${type} prêt : ${channel.name} (serveur ${logGuild.name})`);
        }

        // Helper pour envoyer un message
        async function sendLogMessage(channel, embed) {
            if (!channel) return;
            try {
                await channel.send({ embeds: [embed] });
                console.log(`[Logs] Message envoyé dans ${channel.name} (serveur ${logGuild.name})`);
            } catch (error) {
                console.error(`[Logs] Erreur envoi message dans ${channel.name} :`, error.message, error.stack);
            }
        }

        // 1. Interactions vocales
        client.on('voiceStateUpdate', async (oldState, newState) => {
            const member = newState.member || oldState.member;
            const oldChannel = oldState.channel;
            const newChannel = newState.channel;

            if (!member || member.user.bot) return;

            let title, description;
            if (!oldChannel && newChannel) {
                title = `Vocal : ${member.user.tag} a rejoint`;
                description = `**Membre** : <@${member.id}>\n**Canal** : ${newChannel.name} (${newChannel.id})\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`;
            } else if (oldChannel && !newChannel) {
                title = `Vocal : ${member.user.tag} a quitté`;
                description = `**Membre** : <@${member.id}>\n**Canal** : ${oldChannel.name} (${oldChannel.id})\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`;
            } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
                title = `Vocal : ${member.user.tag} a changé de canal`;
                description = `**Membre** : <@${member.id}>\n**De** : ${oldChannel.name} (${oldChannel.id})\n**Vers** : ${newChannel.name} (${newChannel.id})\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`;
            } else {
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor('#00FF00')
                .setTimestamp();

            await sendLogMessage(logChannels.vocal, embed);
        });

        // 2. Rôles
        client.on('guildRoleCreate', async role => {
            const embed = new EmbedBuilder()
                .setTitle(`Rôle créé : ${role.name}`)
                .setDescription(`**Rôle** : <@&${role.id}>\n**ID** : ${role.id}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FFFF00')
                .setTimestamp();

            await sendLogMessage(logChannels.roles, embed);
        });

        client.on('guildRoleUpdate', async (oldRole, newRole) => {
            const changes = [];
            if (oldRole.name !== newRole.name) changes.push(`**Nom** : \`${oldRole.name}\` → \`${newRole.name}\``);
            if (oldRole.color !== newRole.color) changes.push(`**Couleur** : \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
            if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
                changes.push(`**Permissions** : Modifiées`);
            }

            if (!changes.length) return;

            const embed = new EmbedBuilder()
                .setTitle(`Rôle modifié : ${newRole.name}`)
                .setDescription(`**Rôle** : <@&${newRole.id}>\n**Changements** :\n${changes.join('\n')}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FFA500')
                .setTimestamp();

            await sendLogMessage(logChannels.roles, embed);
        });

        client.on('guildRoleDelete', async role => {
            const embed = new EmbedBuilder()
                .setTitle(`Rôle supprimé : ${role.name}`)
                .setDescription(`**Rôle** : ${role.name}\n**ID** : ${role.id}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FF0000')
                .setTimestamp();

            await sendLogMessage(logChannels.roles, embed);
        });

        // 3. Arrivées de membres
        client.on('guildMemberAdd', async member => {
            if (member.user.bot) return;

            const embed = new EmbedBuilder()
                .setTitle(`Membre arrivé : ${member.user.tag}`)
                .setDescription(`**Membre** : <@${member.id}>\n**ID** : ${member.id}\n**Compte créé** : <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#00FFFF')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await sendLogMessage(logChannels.members, embed);
        });

        // 4. Départs de membres
        client.on('guildMemberRemove', async member => {
            if (member.user.bot) return;

            const embed = new EmbedBuilder()
                .setTitle(`Membre parti : ${member.user.tag}`)
                .setDescription(`**Membre** : <@${member.id}>\n**ID** : ${member.id}\n**Rôles** : ${member.roles.cache.map(r => `<@&${r.id}>`).join(', ') || 'Aucun'}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FF00FF')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await sendLogMessage(logChannels.members, embed);
        });

        // 5. Salons
        client.on('channelCreate', async channel => {
            if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) return;

            const embed = new EmbedBuilder()
                .setTitle(`Salon créé : ${channel.name}`)
                .setDescription(`**Salon** : <#${channel.id}>\n**Type** : ${channel.type}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#00FF00')
                .setTimestamp();

            await sendLogMessage(logChannels.channels, embed);
        });

        client.on('channelUpdate', async (oldChannel, newChannel) => {
            if (oldChannel.type === ChannelType.DM || oldChannel.type === ChannelType.GroupDM) return;

            const changes = [];
            if (oldChannel.name !== newChannel.name) changes.push(`**Nom** : \`${oldChannel.name}\` → \`${newChannel.name}\``);
            if (oldChannel.topic !== newChannel.topic) changes.push(`**Description** : \`${oldChannel.topic || 'Aucune'}\` → \`${newChannel.topic || 'Aucune'}\``);
            if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`**NSFW** : \`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``);

            if (!changes.length) return;

            const embed = new EmbedBuilder()
                .setTitle(`Salon modifié : ${newChannel.name}`)
                .setDescription(`**Salon** : <#${newChannel.id}>\n**Changements** :\n${changes.join('\n')}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FFA500')
                .setTimestamp();

            await sendLogMessage(logChannels.channels, embed);
        });

        client.on('channelDelete', async channel => {
            if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) return;

            const embed = new EmbedBuilder()
                .setTitle(`Salon supprimé : ${channel.name}`)
                .setDescription(`**Salon** : ${channel.name}\n**ID** : ${channel.id}\n**Type** : ${channel.type}\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FF0000')
                .setTimestamp();

            await sendLogMessage(logChannels.channels, embed);
        });

        // 6. Messages
        client.on('messageUpdate', async (oldMessage, newMessage) => {
            if (oldMessage.author?.bot || oldMessage.content === newMessage.content) return;

            const embed = new EmbedBuilder()
                .setTitle(`Message modifié dans #${newMessage.channel.name}`)
                .setDescription(`**Auteur** : <@${newMessage.author.id}>\n**Avant** : \`\`\`${oldMessage.content || 'Vide'}\`\`\`\n**Après** : \`\`\`${newMessage.content || 'Vide'}\`\`\`\n**Salon** : <#${newMessage.channel.id}>\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FFFF00')
                .setTimestamp();

            await sendLogMessage(logChannels.messages, embed);
        });

        client.on('messageDelete', async message => {
            if (message.author?.bot) return;

            const embed = new EmbedBuilder()
                .setTitle(`Message supprimé dans #${message.channel.name}`)
                .setDescription(`**Auteur** : <@${message.author.id}>\n**Contenu** : \`\`\`${message.content || 'Vide'}\`\`\`\n**Salon** : <#${message.channel.id}>\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                .setColor('#FF0000')
                .setTimestamp();

            await sendLogMessage(logChannels.messages, embed);
        });
    },
};