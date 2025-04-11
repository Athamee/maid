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

            // Calcul de l’XP nécessaire pour le prochain niveau (exemple : 100 XP par niveau)
            const xpToNextLevel = level * 100;
            const xpRemaining = xpToNextLevel - totalXp;

            // Récupérer les rôles du membre (exclut @everyone)
            const roles = targetMember.roles.cache
                .filter(role => role.id !== interaction.guild.id) // Exclut @everyone
                .map(role => `<@&${role.id}>`)
                .join(', ') || 'Aucun rôle';

            // Créer l’embed pour le profil
            const embed = new EmbedBuilder()
                .setTitle(`Profil de ${targetMember.user.tag}`)
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setColor('#00FFAA')
                .addFields(
                    { name: 'Niveau', value: `${level}`, inline: true },
                    { name: 'XP Total', value: `${totalXp}`, inline: true },
                    { name: 'XP restant pour le prochain niveau', value: `${xpRemaining}`, inline: true },
                    { name: 'Dernier message', value: lastMessage, inline: false },
                    { name: 'Rôles', value: roles, inline: false }
                )
                .setFooter({ text: `Demandé par ${interaction.user.tag}` })
                .setTimestamp();

            // Envoyer l’embed visible par tous
            await interaction.editReply({ embeds: [embed] });
            console.log(`Profil affiché pour ${targetMember.user.tag} : Niveau ${level}, XP ${totalXp}, Rôles : ${roles}`);
        } catch (error) {
            console.error(`Erreur dans /profile pour ${interaction.user.tag} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’affichage du profil.', ephemeral: true });
        }
    }
};