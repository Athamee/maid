// events/voiceCamera.js
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const pool = require('../db');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log('[VoiceCamera] Initialisation du handler no-camera');

        client.on('voiceStateUpdate', async (oldState, newState) => {
            const member = newState.member || oldState.member;
            const channel = newState.channel || oldState.channel;

            if (!member || member.user.bot || !channel) return;

            // Vérifier si le membre a activé sa caméra
            if (newState.selfVideo && !oldState.selfVideo) {
                console.log(`[VoiceCamera] Caméra activée par ${member.user.tag} dans ${channel.name}`);

                // Récupérer la liste no_camera_channels
                const guildId = member.guild.id;
                const result = await pool.query('SELECT no_camera_channels FROM xp_settings WHERE guild_id = $1', [guildId]);
                const settings = result.rows[0];
                const noCameraChannels = settings?.no_camera_channels ? JSON.parse(settings.no_camera_channels) : [];

                // Vérifier si le salon est dans no_camera_channels
                if (noCameraChannels.includes(channel.id)) {
                    console.log(`[VoiceCamera] Salon ${channel.name} interdit caméra pour ${member.user.tag}`);

                    try {
                        // Déconnecter le membre
                        await member.voice.disconnect('Caméra interdite dans ce salon');
                        console.log(`[VoiceCamera] ${member.user.tag} déconnecté de ${channel.name}`);

                        // Envoyer un message privé
                        await member.send({
                            content: `Désolé, la caméra est interdite dans le salon <#${channel.id}> ! 😈 Contacte un modérateur si besoin.`
                        }).catch(err => {
                            console.warn(`[VoiceCamera] Impossible d'envoyer DM à ${member.user.tag} :`, err.message);
                        });

                        // Loguer sur le serveur de logs (si configuré)
                        const logGuildId = process.env.TICKET_LOG_GUILD_ID;
                        const logMessagesId = process.env.LOG_VOCAL_ID;
                        if (logGuildId && logMessagesId) {
                            const logGuild = client.guilds.cache.get(logGuildId);
                            const logChannel = logGuild?.channels.cache.get(logMessagesId);
                            if (logChannel && logChannel.type === ChannelType.GuildText) {
                                const embed = new EmbedBuilder()
                                    .setTitle(`Caméra interdite utilisée`)
                                    .setDescription(`**Membre** : <@${member.id}>\n**Salon** : <#${channel.id}>\n**Action** : Déconnecté\n**Quand** : <t:${Math.floor(Date.now() / 1000)}:R>`)
                                    .setColor('#FF0000')
                                    .setTimestamp();
                                await logChannel.send({ embeds: [embed] });
                                console.log(`[VoiceCamera] Log envoyé dans ${logChannel.name} (serveur ${logGuild.name})`);
                            }
                        }
                    } catch (error) {
                        console.error(`[VoiceCamera] Erreur lors de la déconnexion de ${member.user.tag} :`, error.message, error.stack);
                    }
                }
            }
        });
    },
};