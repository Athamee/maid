const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db'); // Connexion à ta base PostgreSQL

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inactive-role')
        .setDescription('Ajoute ou enlève un rôle aux membres selon leur activité (admins uniquement)')
        .addIntegerOption(option =>
            option.setName('semaines')
                .setDescription('Nombre de semaines d’inactivité pour attribuer le rôle')
                .setRequired(true)
                .setMinValue(1))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Rôle à attribuer aux membres inactifs ou à enlever aux actifs')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const weeksInactive = interaction.options.getInteger('semaines');
            const inactiveRole = interaction.options.getRole('role');
            const guild = interaction.guild;

            // Calcul de la date limite (ex. 4 semaines dans le passé)
            const cutoffDate = new Date(Date.now() - weeksInactive * 7 * 24 * 60 * 60 * 1000);

            console.log(`Vérification des membres pour ${weeksInactive} semaines d’inactivité avec le rôle ${inactiveRole.name}`);

            // Récupération des membres depuis la base de données avec leur dernière activité
            const { rows: xpData } = await pool.query(
                'SELECT user_id, last_message FROM xp WHERE guild_id = $1',
                [guild.id]
            );

            // Conversion en Map pour accès rapide
            const xpMap = new Map(xpData.map(row => [row.user_id, new Date(row.last_message)]));

            // Récupération des membres du serveur (seulement ceux nécessaires)
            const memberIds = [...xpMap.keys()];
            const members = await guild.members.fetch({ user: memberIds }).catch(err => {
                console.warn('Certains membres n’ont pas pu être récupérés (peut-être partis) :', err.message);
                return new Map(); // Retourne une Map vide si erreur
            });

            let addedCount = 0;
            let removedCount = 0;

            // Vérification des membres présents dans la base de données
            for (const [userId, lastMessage] of xpMap) {
                const member = members.get(userId);
                if (!member || member.user.bot) continue; // Ignore si membre absent ou bot

                const lastActivity = lastMessage;
                const isInactive = lastActivity < cutoffDate;

                if (isInactive && !member.roles.cache.has(inactiveRole.id)) {
                    await member.roles.add(inactiveRole);
                    addedCount++;
                    console.log(`Rôle ${inactiveRole.name} ajouté à ${member.user.tag} (inactif depuis ${lastActivity.toISOString()})`);
                } else if (!isInactive && member.roles.cache.has(inactiveRole.id)) {
                    await member.roles.remove(inactiveRole);
                    removedCount++;
                    console.log(`Rôle ${inactiveRole.name} enlevé à ${member.user.tag} (actif depuis ${lastActivity.toISOString()})`);
                }
            }

            // Vérification des membres sans entrée dans xp (nouveaux ou jamais actifs)
            const allMembers = await guild.members.fetch();
            for (const member of allMembers.values()) {
                if (member.user.bot) continue; // Ignore les bots
                if (xpMap.has(member.id)) continue; // Déjà traité

                const lastActivity = member.joinedAt;
                const isInactive = lastActivity < cutoffDate;

                if (isInactive && !member.roles.cache.has(inactiveRole.id)) {
                    await member.roles.add(inactiveRole);
                    addedCount++;
                    console.log(`Rôle ${inactiveRole.name} ajouté à ${member.user.tag} (inactif depuis arrivée ${lastActivity.toISOString()})`);
                }
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