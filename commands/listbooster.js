const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// Formatte une date en jj/mm/aaaa
const formatDate = (date) => {
    if (!date) return 'Inconnue';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listbooster')
        .setDescription('Affiche la liste des membres boostant le serveur (admin & modo)'),

    async execute(interaction) {
        console.log(`Commande /listbooster exécutée par ${interaction.user.tag}`);

        // Vérification des permissions
        const modoRoleId = process.env.MODO;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);

        if (!isAdmin && !hasModoRole) {
            await interaction.reply({ content: 'Permission refusée : réservé aux admins et modérateurs.', ephemeral: true });
            console.log(`[ListBooster] Permission refusée pour ${interaction.user.tag}`);
            return;
        }

        // Différer la réponse pour éviter Unknown Interaction
        await interaction.deferReply();

        try {
            // Récupérer tous les membres pour garantir un cache complet
            await interaction.guild.members.fetch();
            console.log(`[ListBooster] Membres récupérés pour ${interaction.guild.name}`);

            // Filtrer les boosters (premiumSince non null)
            const boosters = interaction.guild.members.cache
                .filter(member => member.premiumSince !== null)
                .sort((a, b) => a.premiumSince - b.premiumSince); // Trier par date de boost (plus ancien en premier)

            // Créer l’embed
            const embed = new EmbedBuilder()
                .setTitle('🌟 Boosters du Donjon 🌟')
                .setColor('#FFD700') // Or pour un look classe
                .setThumbnail(interaction.guild.iconURL({ dynamic: true })) // Icône du serveur
                .setFooter({ text: `Demandé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            // Gérer le cas où il n’y a pas de boosters
            if (boosters.size === 0) {
                embed.setDescription('Aucun booster pour le moment. 😔 Encouragez le Donjon avec un boost !');
                await interaction.editReply({ embeds: [embed] });
                console.log(`[ListBooster] Aucun booster trouvé dans ${interaction.guild.name}`);
                return;
            }

            // Construire la liste des boosters
            const boosterList = boosters
                .map(member => {
                    const boostDate = formatDate(member.premiumSince);
                    return `💎 **${member.user.tag}** (ID: ${member.id})\n> Depuis : ${boostDate}`;
                })
                .join('\n\n');

            embed.setDescription(`**${boosters.size} booster(s)** soutiennent le Donjon !\n\n${boosterList}`);

            // Envoyer l’embed
            await interaction.editReply({ embeds: [embed] });
            console.log(`[ListBooster] Liste affichée : ${boosters.size} booster(s) pour ${interaction.guild.name}`);
        } catch (error) {
            console.error(`[ListBooster] Erreur pour ${interaction.user.tag} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’affichage des boosters.', ephemeral: true });
        }
    }
};