const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db'); // Si tu veux logger les kicks dans la DB (optionnel)

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
                .setRequired(true)),

    async execute(interaction) {
        // Vérifier si l'utilisateur est admin
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            return interaction.reply({ content: 'Permission refusée : cette commande est réservée aux administrateurs.', ephemeral: true });
        }

        // Reporter la réponse pour éviter Unknown Interaction
        await interaction.deferReply();

        const role = interaction.options.getRole('role');
        const reason = interaction.options.getString('raison');
        const guild = interaction.guild;
        const inviteLink = 'https://discord.gg/aGBEvsTAZJ'; // Remplace par ton lien d'invitation permanent

        try {
            // Récupérer tous les membres avec ce rôle
            const membersToKick = guild.members.cache.filter(member => member.roles.cache.has(role.id));

            if (membersToKick.size === 0) {
                return interaction.editReply({ content: `Aucun membre n’a le rôle ${role.name}.` });
            }

            let kickedCount = 0;
            const failedKicks = [];

            // Parcourir et kicker chaque membre
            for (const member of membersToKick.values()) {
                try {
                    // Envoyer un DM personnalisé
                    const dmMessage = `Salut ${member.user.tag},\nTu as été kické du serveur **${guild.name}** pour la raison suivante : **${reason}**.\nTu peux revenir quand tu veux via ce lien : ${inviteLink}`;
                    await member.send(dmMessage);

                    // Kicker le membre
                    await member.kick(reason);
                    kickedCount++;
                } catch (error) {
                    console.error(`Erreur lors du kick de ${member.user.tag} :`, error.message);
                    failedKicks.push(member.user.tag);
                }
            }

            // Embed de confirmation
            const embed = new EmbedBuilder()
                .setTitle('Kick de masse effectué')
                .setColor('#FFAA00')
                .addFields(
                    { name: 'Rôle ciblé', value: `${role.name} (${role.id})`, inline: false },
                    { name: 'Membres kickés', value: `${kickedCount}`, inline: false },
                    { name: 'Raison', value: reason, inline: false }
                );

            if (failedKicks.length > 0) {
                embed.addFields({ name: 'Échecs', value: failedKicks.join(', ') || 'Aucun', inline: false });
            }

            embed.setFooter({ text: `Exécuté par ${interaction.user.tag}` });
            embed.setTimestamp();

            // Réponse visible pour tous
            await interaction.editReply({ embeds: [embed] });

            console.log(`Kickrole exécuté par ${interaction.user.tag} : ${kickedCount} membres kickés du rôle ${role.name}`);
        } catch (error) {
            console.error('Erreur kickrole :', error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’exécution du kick de masse.', ephemeral: true });
        }
    }
};