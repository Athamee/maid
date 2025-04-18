const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Affiche le profil d’un membre avec ses XP et rôles')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre dont afficher le profil (par défaut : vous-même)')
                .setRequired(false)),

    async execute(interaction) {
        console.log(`Commande /profile exécutée par ${interaction.user.tag}`);

        try {
            await interaction.deferReply(); // Réponse différée, visible par tous

            const targetMember = interaction.options.getMember('membre') || interaction.member;
            const userId = targetMember.id;
            const guildId = interaction.guild.id;

            // Récupérer les données XP depuis la base de données
            const { rows } = await pool.query(
                'SELECT xp, level, last_message FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );

            // Si pas d’entrée dans la BD, valeurs par défaut
            const xpData = rows[0] || { xp: 0, level: 1, last_message: null };
            const totalXp = xpData.xp || 0;
            const level = xpData.level || 1;
            const lastMessage = xpData.last_message ? new Date(xpData.last_message).toLocaleDateString() : 'Jamais';

            // Formule pour l’XP requis : 1000 + (level - 1)² * 400
            const getRequiredXp = (lvl) => 1000 + Math.pow(lvl - 1, 2) * 400;
            const xpForCurrentLevel = getRequiredXp(level); // XP requis pour atteindre le niveau actuel
            const xpForNextLevel = getRequiredXp(level + 1); // XP requis pour le prochain niveau
            const xpProgress = xpForNextLevel - totalXp; // Progression dans le niveau actuel (corrigé : XP restant pour le prochain niveau)

            // Calcul de la progression pour la barre (ajout 14/04/2025)
            const xpInCurrentLevel = totalXp - xpForCurrentLevel; // XP gagnés dans le niveau actuel
            const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel; // XP total pour passer au niveau suivant
            const progressPercentage = Math.min((xpInCurrentLevel / xpNeededForLevel) * 100, 100); // Pourcentage (0 à 100), limité à 100%

            // Création de la barre de progression avec emojis personnalisés (ajout 14/04/2025)
            // 10 segments, 50 étapes (chaque étape = 2%), chaque segment représente 10%
            const steps = Math.floor(progressPercentage / 2); // Nombre d'étapes (0 à 50)
            let progressBar = '';
            for (let i = 0; i < 10; i++) {
                const segmentSteps = i * 5; // Chaque segment couvre 5 étapes (10%)
                if (steps >= segmentSteps + 5) {
                    progressBar += '<:100:1361391591930986867> '; // 100% pour ce segment
                } else if (steps >= segmentSteps + 4) {
                    progressBar += '<:80:1361391593432682748>'; // 80% pour ce segment
                } else if (steps >= segmentSteps + 3) {
                    progressBar += '<:60:1361391596163043640>'; // 60% pour ce segment
                } else if (steps >= segmentSteps + 2) {
                    progressBar += '<:40:1361391597878645046>'; // 40% pour ce segment
                } else if (steps >= segmentSteps + 1) {
                    progressBar += '<:20:1361391600328245442>'; // 20% pour ce segment
                } else {
                    progressBar += '<:00:1361391603767578925>'; // 0% pour ce segment
                }
            }
            const progressDisplay = `${progressBar} (${Math.round(progressPercentage)}%)`;

            // Récupérer les rôles du membre (exclut @everyone)
            const roles = targetMember.roles.cache
                .filter(role => role.id !== interaction.guild.id) // Exclut @everyone
                .map(role => `<@&${role.id}>`)
                .join(', ') || 'Aucun rôle';

            // Créer l’embed pour le profil
            const embed = new EmbedBuilder()
                .setTitle(`Profil de ${targetMember.user.tag}`)
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setColor('#4B0082') // Changement en violet profond (14/04/2025)
                .addFields(
                    {
                        name: 'XP',
                        value: `Niveau: ${level}\nXP total: ${totalXp}\nProgression: ${progressDisplay}\nProchain niveau: ${xpProgress} / ${xpForNextLevel}`,
                        inline: false
                    },
                    { name: 'Dernier message', value: lastMessage, inline: false },
                    { name: 'Rôles', value: roles, inline: false }
                )
                .setFooter({ text: `Demandé par ${interaction.user.tag}` })
                .setTimestamp();

            // Envoyer l’embed visible par tous
            await interaction.editReply({ embeds: [embed] });
            console.log(`Profil affiché pour ${targetMember.user.tag} : Niveau ${level}, XP ${totalXp}, Prochain niveau ${xpProgress}/${xpForNextLevel}, Rôles : ${roles}`);
        } catch (error) {
            console.error(`Erreur dans /profile pour ${interaction.user.tag} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’affichage du profil.', ephemeral: true });
        }
    }
};