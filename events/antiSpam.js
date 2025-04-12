// events/antiSpam.js
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const pool = require('../db');

// Cache des messages par utilisateur
const messageCache = new Map();

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log('[AntiSpam] Initialisation du filtre anti-spam');

        client.on('messageCreate', async message => {
            if (!message.guild || message.author.bot || message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return; // Ignorer bots et admins
            }

            const guildId = message.guild.id;
            const userId = message.author.id;
            const now = Date.now();

            // Récupérer config spam
            const result = await pool.query('SELECT spam_settings FROM xp_settings WHERE guild_id = $1', [guildId]);
            const settings = result.rows[0]?.spam_settings ? JSON.parse(result.spam_settings) : {
                message_limit: 5, // 5 messages
                time_window: 5000, // 5 secondes
                repeat_limit: 3, // 3 messages identiques
                mention_limit: 5, // 5 mentions max
                action: 'warn' // Warn par défaut
            };

            // Mettre à jour le cache
            if (!messageCache.has(userId)) {
                messageCache.set(userId, []);
            }
            const userMessages = messageCache.get(userId);
            userMessages.push({ content: message.content, timestamp: now, mentions: message.mentions.users.size });
            // Nettoyer les vieux messages
            while (userMessages.length > 0 && now - userMessages[0].timestamp > settings.time_window) {
                userMessages.shift();
            }

            // Vérifier spam
            let isSpam = false;
            let reason = '';

            // 1. Trop de messages
            if (userMessages.length >= settings.message_limit) {
                isSpam = true;
                reason = `Trop de messages (${userMessages.length} en ${settings.time_window / 1000}s)`;
            }

            // 2. Messages répétés
            const contentCounts = {};
            for (const msg of userMessages) {
                contentCounts[msg.content] = (contentCounts[msg.content] || 0) + 1;
                if (contentCounts[msg.content] >= settings.repeat_limit) {
                    isSpam = true;
                    reason = `Message répété ${contentCounts[msg.content]} fois`;
                    break;
                }
            }

            // 3. Trop de mentions
            for (const msg of userMessages) {
                if (msg.mentions >= settings.mention_limit) {
                    isSpam = true;
                    reason = `Trop de mentions (${msg.mentions}) dans un message`;
                    break;
                }
            }

            if (!isSpam) return;

            console.log(`[AntiSpam] Spam détecté par ${message.author.tag} : ${reason}`);

            try {
                // Ajouter un warn (comme /warn)
                await pool.query(
                    'INSERT INTO warns (guild_id, user_id, reason, moderator_id, timestamp) VALUES ($1, $2, $3, $4, $5)',
                    [guildId, userId, `Spam : ${reason}`, client.user.id, now]
                );

                // DM au membre
                await message.author.send({
                    content: `🚫 Attention, ${message.author}, tu as reçu un **avertissement** sur ${message.guild.name} pour : ${reason}. Évite de spammer pour rester dans le Donjon ! 😈 Contacte un modérateur si besoin.`
                }).catch(err => {
                    console.warn(`[AntiSpam] Impossible d'envoyer DM à ${message.author.tag} :`, err.message);
                });

                // Loguer dans logs-messages
                const logGuildId = process.env.TICKET_LOG_GUILD_ID;
                const logMessagesId = process.env.LOG_MESSAGES_ID;
                if (logGuildId && logMessagesId) {
                    const logGuild = client.guilds.cache.get(logGuildId);
                    const logChannel = logGuild?.channels.cache.get(logMessagesId);
                    if (!logGuild) {
                        console.error(`[AntiSpam] Serveur de logs non trouvé : ${logGuildId}`);
                        return;
                    }
                    if (!logChannel || logChannel.type !== ChannelType.GuildText) {
                        console.error(`[AntiSpam] Salon logs-messages non trouvé ou invalide : ${logMessagesId}`);
                        return;
                    }
                    const perms = logChannel.permissionsFor(client.user);
                    if (!perms.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                        console.error(`[AntiSpam] Permissions manquantes dans ${logChannel.name} :`, perms.toArray());
                        return;
                    }
                    const embed = new EmbedBuilder()
                        .setTitle('Spam détecté - Avertissement')
                        .setDescription(`**Membre** : <@${userId}>\n**Raison** : ${reason}\n**Action** : Avertissement\n**Salon** : <#${message.channel.id}>\n**Quand** : <t:${Math.floor(now / 1000)}:R>`)
                        .setColor('#FF0000')
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                    console.log(`[AntiSpam] Log envoyé dans ${logChannel.name} (serveur ${logGuild.name})`);
                }

                // Supprimer les messages spam (optionnel)
                if (message.channel.permissionsFor(client.user).has(PermissionFlagsBits.ManageMessages)) {
                    const messagesToDelete = await message.channel.messages.fetch({ limit: 100 })
                        .then(msgs => msgs.filter(m => m.author.id === userId && now - m.createdTimestamp < settings.time_window));
                    if (messagesToDelete.size > 0) {
                        await message.channel.bulkDelete(messagesToDelete, true);
                        console.log(`[AntiSpam] Supprimé ${messagesToDelete.size} messages de ${message.author.tag}`);
                    }
                }
            } catch (error) {
                console.error(`[AntiSpam] Erreur lors du traitement du spam de ${message.author.tag} :`, error.message, error.stack);
            }
        });
    },
};