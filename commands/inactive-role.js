const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db'); // Connexion à ta base PostgreSQL

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inactive-role')
        .setDescription('Ajoute ou enlève un rôle selon la dernière prise d’XP (admins uniquement)')
        .addIntegerOption(option =>
            option.setName('semaines')
                .setDescription('Nombre de semaines d’inactivité pour attribuer le rôle')
                .setRequired(true)
                .setMinValue(1))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Rôle à attribuer aux membres inactifs ou à enlever aux actifs')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Salon où envoyer le message pingant le rôle inactif')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const weeksInactive = interaction.options.getInteger('semaines');
            const inactiveRole = interaction.options.getRole('role');
            const targetChannel = interaction.options.getChannel('salon');
            const guild = interaction.guild;

            // Vérification que le salon est un salon textuel
            if (targetChannel.type !== 0) { // 0 = GuildText
                throw new Error('Le salon spécifié doit être un salon textuel.');
            }

            // Rôles des arrivants à ignorer (deux variables distinctes)
            const arrivantRoleId1 = process.env.ARRIVANT_ROLE_ID_1 || 'ID_DU_ROLE_ARRIVANT_1'; // Fallback
            const partenaireRoleId = process.env.PARTENAIRE_ROLE_ID || 'ID_DU_ROLE_PARTENAIRE'; // Fallback
            const arrivantRoleIds = [arrivantRoleId1, partenaireRoleId];

            // Calcul de la date limite (ex. X semaines dans le passé)
            const cutoffDate = new Date(Date.now() - weeksInactive * 7 * 24 * 60 * 60 * 1000);

            console.log(`Vérification des membres pour ${weeksInactive} semaines sans prise d’XP avec le rôle ${inactiveRole.name}, ignorant les rôles ${arrivantRoleIds.map(id => `<@&${id}>`).join(', ')}`);

            // Récupération des membres depuis la base de données avec leur dernière prise d’XP
            const { rows: xpData } = await pool.query(
                'SELECT user_id, last_message FROM xp WHERE guild_id = $1',
                [guild.id]
            );

            // Conversion en Map pour accès rapide
            const xpMap = new Map(xpData.map(row => [row.user_id, new Date(row.last_message)]));

            // Récupération des membres du serveur (seulement ceux dans xp)
            const memberIds = [...xpMap.keys()];
            const members = await guild.members.fetch({ user: memberIds }).catch(err => {
                console.warn('Certains membres n’ont pas pu être récupérés (peut-être partis) :', err.message);
                return new Map();
            });

            let addedCount = 0;
            let removedCount = 0;

            // Vérification des membres présents dans la base de données
            for (const [userId, lastXpGain] of xpMap) {
                const member = members.get(userId);
                if (!member || member.user.bot) continue; // Ignore si membre absent ou bot

                // Ignorer les membres avec l’un des rôles "Arrivant"
                if (arrivantRoleIds.some(roleId => member.roles.cache.has(roleId))) {
                    console.log(`Membre ${member.user.tag} ignoré (possède un rôle ignoré : ${arrivantRoleIds.filter(id => member.roles.cache.has(id)).map(id => `<@&${id}>`).join(', ')})`);
                    continue;
                }

                const lastActivity = lastXpGain;
                const isInactive = lastActivity < cutoffDate;

                if (isInactive && !member.roles.cache.has(inactiveRole.id)) {
                    await member.roles.add(inactiveRole);
                    addedCount++;
                    console.log(`Rôle ${inactiveRole.name} ajouté à ${member.user.tag} (sans XP depuis ${lastActivity.toISOString()})`);
                } else if (!isInactive && member.roles.cache.has(inactiveRole.id)) {
                    await member.roles.remove(inactiveRole);
                    removedCount++;
                    console.log(`Rôle ${inactiveRole.name} enlevé à ${member.user.tag} (XP gagné depuis ${lastActivity.toISOString()})`);
                }
            }

            // Vérification des membres sans entrée dans xp (jamais gagné d’XP)
            const allMembers = await guild.members.fetch();
            for (const member of allMembers.values()) {
                if (member.user.bot) continue; // Ignore les bots
                if (xpMap.has(member.id)) continue; // Déjà traité

                // Ignorer les membres avec l’un des rôles "Arrivant"
                if (arrivantRoleIds.some(roleId => member.roles.cache.has(roleId))) {
                    console.log(`Membre ${member.user.tag} ignoré (possède un rôle ignoré : ${arrivantRoleIds.filter(id => member.roles.cache.has(id)).map(id => `<@&${id}>`).join(', ')})`);
                    continue;
                }

                // Si pas d’entrée dans xp, on considère qu’ils n’ont jamais gagné d’XP
                const lastActivity = member.joinedAt; // Date d’arrivée comme fallback
                const isInactive = lastActivity < cutoffDate;

                if (isInactive && !member.roles.cache.has(inactiveRole.id)) {
                    await member.roles.add(inactiveRole);
                    addedCount++;
                    console.log(`Rôle ${inactiveRole.name} ajouté à ${member.user.tag} (jamais gagné d’XP, arrivée ${lastActivity.toISOString()})`);
                }
            }

            // Envoi du message personnalisé dans le salon spécifié
            if (addedCount > 0 || removedCount > 0) {
                const messageContent = `
    **Mise à jour de l’inactivité :**
    - ${addedCount} membres n’ont pas gagné d’XP et ont reçu le rôle <@&${inactiveRole.id}>.
    - ${removedCount} membres ont repris de l’XP et ont perdu le rôle.
    *Période d’inactivité : ${weeksInactive} semaines.*

    
    * **Si vous êtes dans ce salon c'est que vous êtes inactifs !**
    > *Vous devriez revenir pour participer, sinon la voiture-balai du Donjon vous emmènera prochainement vers la porte.*

    
    ***On vous attends, bandes de torturées & torturés du bocal !***
    😈
`.trim();
                await targetChannel.send(messageContent);
                console.log(`Message envoyé dans ${targetChannel.name} (ID: ${targetChannel.id})`);
            } else {
                console.log('Aucun changement détecté, pas de message envoyé.');
            }

            await interaction.editReply({
                content: `${addedCount} membres inactifs ont reçu le rôle ${inactiveRole.name}, ${removedCount} membres actifs l’ont perdu.`,
                ephemeral: true
            });
            console.log(`Commande /inactive-role terminée : ${addedCount} ajoutés, ${removedCount} enlevés`);
        } catch (error) {
            console.error('Erreur dans /inactive-role :', error.stack);
            await interaction.editReply({
                content: 'Une erreur est survenue lors de l’exécution de la commande.',
                ephemeral: true
            });
        }
    }
};