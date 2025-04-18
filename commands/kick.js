const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick un membre spécifique (admin uniquement)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Membre à kicker')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison du kick (envoyée en DM)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        console.log(`[Kick] Commande exécutée par ${interaction.user.tag} dans ${interaction.guild.name} (ID: ${interaction.guild.id})`);

        // Vérifier permissions bot
        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
            console.error('[Kick] Erreur : Le bot manque la permission KickMembers');
            return interaction.reply({
                content: 'Erreur : Je n’ai pas la permission de kicker des membres.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('raison');
        const guild = interaction.guild;
        const inviteLink = process.env.INVITE_LINK;
        const kickChannelId = process.env.KICK_CHANNEL_ID;
        const ticketLogGuildId = process.env.TICKET_LOG_GUILD_ID;

        // Vérifier INVITE_LINK
        if (!inviteLink) {
            console.error('[Kick] Erreur : INVITE_LINK non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Lien d’invitation non configuré (INVITE_LINK manquant).',
                ephemeral: true
            });
        }

        // Vérifier KICK_CHANNEL_ID
        if (!kickChannelId) {
            console.error('[Kick] Erreur : KICK_CHANNEL_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Canal de logs non configuré (KICK_CHANNEL_ID manquant).',
                ephemeral: true
            });
        }

        // Vérifier TICKET_LOG_GUILD_ID
        if (!ticketLogGuildId) {
            console.error('[Kick] Erreur : TICKET_LOG_GUILD_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Serveur de logs non configuré (TICKET_LOG_GUILD_ID manquant).',
                ephemeral: true
            });
        }

        try {
            // Vérifier serveur de logs
            const logGuild = await interaction.client.guilds.fetch(ticketLogGuildId).catch(() => null);
            if (!logGuild) {
                console.error(`[Kick] Erreur : TICKET_LOG_GUILD_ID (${ticketLogGuildId}) introuvable`);
                return interaction.editReply({
                    content: 'Erreur : Le serveur de logs (TICKET_LOG_GUILD_ID) est introuvable.',
                    ephemeral: true
                });
            }

            // Vérifier canal de logs
            const kickChannel = logGuild.channels.cache.get(kickChannelId);
            if (!kickChannel || !kickChannel.isTextBased()) {
                console.error(`[Kick] Erreur : KICK_CHANNEL_ID (${kickChannelId}) introuvable ou non textuel`);
                return interaction.editReply({
                    content: 'Erreur : Le canal de logs (KICK_CHANNEL_ID) est invalide ou non textuel.',
                    ephemeral: true
                });
            }

            // Vérifier permissions canal
            const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
            if (!botMember.permissionsIn(kickChannel).has(requiredPerms)) {
                console.error(`[Kick] Erreur : Permissions manquantes dans ${kickChannel.name} (${kickChannelId})`);
                return interaction.editReply({
                    content: 'Erreur : Je n’ai pas les permissions (Voir le salon, Envoyer des messages) dans le canal de logs.',
                    ephemeral: true
                });
            }

            // Vérifier si membre kickable
            if (!member.kickable) {
                console.error(`[Kick] Erreur : Le membre ${member.user.tag} n’est pas kickable`);
                return interaction.editReply({
                    content: `Erreur : Je ne peux pas kicker ${member.user.tag} (non kickable, ex. rôle supérieur ou propriétaire).`,
                    ephemeral: true
                });
            }

            // Vérifier hiérarchie
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                console.error(`[Kick] Erreur : Le rôle le plus haut de ${member.user.tag} est supérieur ou égal au bot`);
                return interaction.editReply({
                    content: `Erreur : Je ne peux pas kicker ${member.user.tag} (rôle trop haut dans la hiérarchie).`,
                    ephemeral: true
                });
            }

            console.log(`[Kick] Tentative de kick pour ${member.user.tag} (${member.id})`);

            // Kicker
            try {
                await member.kick(reason);
                console.log(`[Kick] ${member.user.tag} kické avec succès`);

                // DM après kick
                const dmMessage = `Salut ${member.user.tag},\nTu as été kické du serveur **${guild.name}** pour la raison suivante : **${reason}**.\nTu peux revenir quand tu veux via ce lien : ${inviteLink}`;
                await member.send(dmMessage).catch(err => {
                    console.warn(`[Kick] Impossible d’envoyer un DM à ${member.user.tag} : ${err.message}`);
                });

                // Logger dans KICK_CHANNEL_ID
                const logMessage = `[Kick] ${member.user.tag} kické par ${interaction.user.tag}. Raison : ${reason}`;
                await kickChannel.send(logMessage);
                console.log(`[Kick] Log envoyé dans ${kickChannel.name} (ID: ${kickChannelId})`);

                // Embed
                const embed = new EmbedBuilder()
                    .setTitle('Kick effectué')
                    .setColor('#FFAA00')
                    .addFields(
                        { name: 'Membre kické', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                        { name: 'Raison', value: reason, inline: false }
                    )
                    .setFooter({ text: `Exécuté par ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                console.log(`[Kick] Terminé : ${member.user.tag} kické`);
            } catch (error) {
                console.error(`[Kick] Erreur lors du kick de ${member.user.tag} : ${error.message}`);
                await kickChannel.send(`[Kick] Échec du kick de ${member.user.tag} par ${interaction.user.tag}. Erreur : ${error.message}`);
                return interaction.editReply({
                    content: `Erreur : Impossible de kicker ${member.user.tag}.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('[Kick] Erreur globale :', error.stack);
            await interaction.editReply({
                content: 'Erreur lors de l’exécution du kick.',
                ephemeral: true
            });
        }
    }
};