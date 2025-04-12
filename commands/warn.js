const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertir un membre (modo only)')
        .addUserOption(option => option.setName('target').setDescription('Membre à avertir').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Raison').setRequired(false)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        // Vérifier les permissions
        if (!isAdmin && !hasModoRole) {
            return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({ content: 'Membre introuvable sur le serveur.', ephemeral: true });
        }
        const reason = interaction.options.getString('reason') || 'Non spécifié';

        try {
            // Insérer le warn dans la DB
            await pool.query(
                'INSERT INTO warns (user_id, guild_id, reason, moderator_id) VALUES ($1, $2, $3, $4)',
                [target.id, interaction.guild.id, reason, interaction.user.id]
            );
            console.log(`Warn pour ${target.tag} par ${interaction.user.tag} (raison : ${reason})`);

            // Compter les warns
            const warnCountResult = await pool.query(
                'SELECT COUNT(*) AS count FROM warns WHERE user_id = $1 AND guild_id = $2',
                [target.id, interaction.guild.id]
            );
            const warnCount = parseInt(warnCountResult.rows[0].count, 10);

            // Envoyer le message dans le salon PILORI_CHANNEL_ID pour chaque warn
            const piloriChannelId = process.env.PILORI_CHANNEL_ID;
            const piloriChannel = interaction.guild.channels.cache.get(piloriChannelId);

            if (piloriChannel && piloriChannel.isTextBased()) {
                const piloriMessage = `Le membre <@${target.id}> a reçu un warn pour la raison suivante : ${reason}.`;
                await piloriChannel.send(piloriMessage);
                console.log(`Message envoyé dans #${piloriChannel.name} : ${piloriMessage}`);
            } else {
                console.error(`Erreur : Salon PILORI_CHANNEL_ID (${piloriChannelId}) introuvable ou non texte.`);
            }

            // Vérifier si 3 warns pour attribuer le rôle et envoyer le message dans WARN_CHANNEL_ID
            if (warnCount >= 3) {
                const warnedRoleId = process.env.WARNED_ROLE_ID;
                const warnedRole = interaction.guild.roles.cache.get(warnedRoleId);

                if (!warnedRole) {
                    console.error(`Erreur : Le rôle WARNED_ROLE_ID (${warnedRoleId}) est introuvable.`);
                    await interaction.reply({
                        content: `${target.tag} averti pour : ${reason} (${warnCount}/3). Attention : le rôle à 3 warns est introuvable.`,
                        ephemeral: true
                    });
                    return;
                }

                // Ajouter le rôle si pas déjà présent
                if (!targetMember.roles.cache.has(warnedRoleId)) {
                    console.log(`Ajout du rôle ${warnedRole.name} (${warnedRoleId}) à ${target.tag} (${target.id}) pour 3 warns`);
                    await targetMember.roles.add(warnedRole);

                    // Envoyer le message personnalisé dans WARN_CHANNEL_ID
                    const warnChannelId = process.env.WARN_CHANNEL_ID;
                    const warnChannel = interaction.guild.channels.cache.get(warnChannelId);

                    if (warnChannel && warnChannel.isTextBased()) {
                        // Récupérer les rôles gaystapo et dicktateur
                        const gaystapoRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'gaystapo') || process.env.GAYSTAPO_ROLE_ID
                            ? interaction.guild.roles.cache.get(process.env.GAYSTAPO_ROLE_ID)
                            : null;
                        const dicktateurRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'dicktateur') || process.env.DICKTATEUR_ROLE_ID
                            ? interaction.guild.roles.cache.get(process.env.DICKTATEUR_ROLE_ID)
                            : null;

                        const gaystapoMention = gaystapoRole ? `<@&${gaystapoRole.id}>` : '@1094318706487734483';
                        const dicktateurMention = dicktateurRole ? `<@&${dicktateurRole.id}>` : '@1094318706525470901';

                        const warnMessage = `<@${target.id}>, tu viens de te faire warn pour la troisième fois. Le dernier warn était pour ${reason}.\nUn ${gaystapoMention} ou ${dicktateurMention} viendra bientôt s'occuper de ton cas.`;

                        await warnChannel.send(warnMessage);
                        console.log(`Message envoyé dans #${warnChannel.name} : ${warnMessage}`);
                    } else {
                        console.error(`Erreur : Salon WARN_CHANNEL_ID (${warnChannelId}) introuvable ou non texte.`);
                    }

                    await interaction.reply({
                        content: `${target.tag} averti pour : ${reason} (${warnCount}/3). Rôle ${warnedRole.name} attribué.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `${target.tag} averti pour : ${reason} (${warnCount}/3). Le rôle ${warnedRole.name} est déjà attribué.`,
                        ephemeral: true
                    });
                }
            } else {
                await interaction.reply({
                    content: `${target.tag} averti pour : ${reason} (${warnCount}/3)`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Erreur lors du warn :', error.message, error.stack);
            await interaction.reply({ content: 'Erreur lors du warn.', ephemeral: true });
        }
    }
};