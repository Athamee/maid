const { SlashCommandBuilder } = require('discord.js');
const { updateGifList } = require('../gifCache'); // Ajuste le chemin selon ton dossier

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh_gif')
        .setDescription('Rafraîchit la liste des GIFs depuis Google Drive'),
    async execute(interaction, { listGifs, oAuth2Client, FOLDER_IDS }) {
        // Liste des IDs des rôles autorisés
        const allowedRoleIds = [
            '1094318706525470908', // Remplace par le premier ID
            //'ID_ROLE_2', // Remplace par le deuxième ID
            //'ID_ROLE_3'  // Ajoute autant d'IDs que nécessaire
        ];

        // Vérifie si l'utilisateur a au moins un des rôles autorisés
        if (!interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
            return interaction.reply({
                content: 'Désolé, cette commande est réservée aux membres avec un rôle requis !',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            for (const [action, folderId] of Object.entries(FOLDER_IDS)) {
                const gifs = await listGifs(folderId, oAuth2Client); // Récupère depuis Google Drive
                await updateGifList(action, gifs); // Met à jour le cache
                console.log(`Liste des GIFs pour ${action} mise à jour`);
            }
            await interaction.editReply('Les listes de GIFs ont été rafraîchies !');
        } catch (error) {
            console.error('Erreur lors du rafraîchissement des GIFs :', error);
            await interaction.editReply({ 
                content: 'Erreur lors du rafraîchissement des GIFs !', 
                ephemeral: true 
            });
        }
    },
};