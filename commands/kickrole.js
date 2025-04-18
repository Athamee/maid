const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db'); // Importé mais non utilisé (kick simple)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kickrole')
        .setDescription('Kick tous les membres ayant un rôle spécifique (admin uniquement)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Rôle des membres à kicker')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison du kick (envoyée en DM)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        console.log(`[KickRole] Commande exécutée par ${interaction.user.tag} dans ${interaction.guild.name} (ID: ${interaction.guild.id})`);

        // Vérifier permissions bot
        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
            console.error('[KickRole] Erreur : Le bot manque la permission KickMembers');
            return interaction.reply({
                content: 'Erreur : Je n’ai pas la permission de kicker des membres.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const role = interaction.options.getRole('role');
        const reason = interaction.options.getString('raison');
        const guild = interaction.guild;
        const inviteLink = process.env.INVITE_LINK;
        const kickChannelId = process.env.KICK_CHANNEL_ID;
        const ticketLogGuildId = process.env.TICKET_LOG_GUILD_ID;

        // Vérifier INVITE_LINK
        if (!inviteLink) {
            console.error('[KickRole] Erreur : INVITE_LINK non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Lien d’invitation non configuré (INVITE_LINK manquant).',
                ephemeral: true
            });
        }

        // Vérifier KICK_CHANNEL_ID
        if (!kickChannelId) {
            console.error('[KickRole] Erreur : KICK_CHANNEL_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Canal de logs non configuré (KICK_CHANNEL_ID manquant).',
                ephemeral: true
            });
        }

        // Vérifier TICKET_LOG_GUILD_ID
        if (!ticketLogGuildId) {
            console.error('[KickRole] Erreur : TICKET_LOG_GUILD_ID non défini dans .env');
            return interaction.editReply({
                content: 'Erreur : Serveur de logs non configuré (TICKET_LOG_GUILD_ID manquant).',
                ephemeral: true
            });
        }

        try {
            // Vérifier serveur de logs
            const logGuild = await interaction.client.guilds.fetch(ticketLogGuildId).catch(() => null);
            if (!logGuild) {
                console.error(`[KickRole] Erreur : TICKET_LOG_GUILD_ID (${ticketLogGuildId}) introuvable`);
                return interaction.editReply({
                    content: 'Erreur : Le serveur de logs (TICKET_LOG_GUILD_ID) est introuvable.',
                    ephemeral: true
                });
            }

            // Vérifier canal de logs
            const kickChannel = logGuild.channels.cache.get(kickChannelId);
            if (!kickChannel || !kickChannel.isTextBased()) {
                console.error(`[KickRole] Erreur : KICK_CHANNEL_ID (${kickChannelId}) introuvable ou non textuel`);
                return interaction.editReply({
                    content: 'Erreur : Le canal de logs (KICK_CHANNEL_ID) est invalide ou non textuel.',
                    ephemeral: true
                });
            }

            // Vérifier permissions canal
            const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
            if (!botMember.permissionsIn(kickChannel).has(requiredPerms)) {
                console.error(`[KickRole] Erreur : Permissions manquantes dans ${kickChannel.name} (${kickChannelId})`);
                return interaction.editReply({
                    content: 'Erreur : Je n’ai pas les permissions (Voir le salon, Envoyer des messages) dans le canal de logs.',
                    ephemeral: true
                });
            }

            console.log(`[KickRole] Récupération des membres avec le rôle ${role.name} (${role.id})`);

            // Vérifier hiérarchie rôle
            if (role.position >= botMember.roles.highest.position) {
                console.error(`[KickRole] Erreur : Le rôle ${role.name} est supérieur ou égal au rôle du bot`);
                return interaction.editReply({
                    content: `Erreur : Je ne peux pas kicker les membres avec le rôle ${role.name} (trop haut dans la hiérarchie).`,
                    ephemeral: true
                });
            }

            // Récupérer membres
            console.log('[KickRole] Fetch des membres...');
            const members = await guild.members.fetch();
            console.log(`[KickRole] ${members.size} membres récupérés`);

            // Filtrer kickables
            const membersToKick = members.filter(member =>
                member.roles.cache.has(role.id) && member.kickable
            );

            if (membersToKick.size === 0) {
                console.log(`[KickRole] Aucun membre kickable avec le rôle ${role.name}`);
                await kickChannel.send(`[KickRole] Aucun membre kickable trouvé avec le rôle <@&${role.id}> par ${interaction.user.tag}`);
                return interaction.editReply({
                    content: `Aucun membre kickable n’a le rôle ${role.name}.`
                });
            }

            console.log(`[KickRole] ${membersToKick.size} membres à kicker`);

            let kickedCount = 0;
            const failedKicks = [];

            // Kicker
            for (const member of membersToKick.values()) {
                try {
                    console.log(`[KickRole] Tentative de kick pour ${member.user.tag} (${member.id})`);
                    await member.kick(reason);
                    kickedCount++;

                    // DM après kick
                    const dmMessage = `Salut ${member.user.tag},\nTu as été kické du serveur **${guild.name}** pour la raison suivante : **${reason}**.\nTu peux revenir quand tu veux via ce lien : ${inviteLink}`;
                    await member.send(dmMessage).catch(err => {
                        console.warn(`[KickRole] Impossible d’envoyer un DM à ${member.user.tag} : ${err.message}`);
                    });

                    console.log(`[KickRole] ${member.user.tag} kické avec succès`);
                } catch (error) {
                    console.error(`[KickRole] Erreur lors du kick de ${member.user.tag} : ${error.message}`);
                    failedKicks.push(member.user.tag);
                }
            }

            // Logger dans KICK_CHANNEL_ID
            const logMessage = `[KickRole] ${kickedCount} membres kickés du rôle <@&${role.id}> par ${interaction.user.tag}. Raison : ${reason}` +
                (failedKicks.length > 0 ? `\nÉchecs : ${failedKicks.join(', ')}` : '');
            await kickChannel.send(logMessage);
            console.log(`[KickRole] Log envoyé dans ${kickChannel.name} (ID: ${kickChannelId})`);

            // Embed
            const embed = new EmbedBuilder()
                .setTitle('Kick de masse effectué')
                .setColor('#FFAA00')
                .addFields(
                    { name: 'Rôle ciblé', value: `<@&${role.id}> (${role.name})`, inline: false },
                    { name: 'Membres kickés', value: `${kickedCount}`, inline: false },
                    { name: 'Raison', value: reason, inline: false }
                );

            if (failedKicks.length > 0) {
                embed.addFields({ name: 'Échecs', value: failedKicks.join(', ') || 'Aucun', inline: false });
            }

            embed.setFooter({ text: `Exécuté par ${interaction.user.tag}` });
            embed.setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            console.log(`[KickRole] Terminé : ${kickedCount} kickés, ${failedKicks.length} échecs`);
        } catch (error) {
            console.error('[KickRole] Erreur globale :', error.stack);
            await interaction.editReply({
                content: 'Erreur lors de l’exécution du kick de masse.',
                ephemeral: true
            });
        }
    }
};