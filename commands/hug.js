const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Fais un câlin à quelqu’un avec un GIF aléatoire depuis Google Drive !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('La personne à câliner')
                .setRequired(true)),
    async execute(interaction, { getRandomFileFromDrive }) {
        const allowedChannelId = '1353348735660195911'; // Remplace par l'ID du salon autorisé

        // Vérifier si la commande est utilisée dans le bon salon
        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({ 
                content: 'Désolé, cette commande ne peut être utilisée que dans un salon spécifique !', 
                ephemeral: true // Message visible uniquement par l'utilisateur
            });
        }

        const user = interaction.options.getUser('cible');

        // Déférer la réponse car l'appel à Google Drive peut prendre du temps
        await interaction.deferReply();

        try {
            // Récupérer un GIF aléatoire depuis le dossier Google Drive
            const folderId = process.env.GDRIVE_HUG; // ID du dossier depuis .env
            const randomGif = await getRandomFileFromDrive(folderId);

            // Créer un embed avec le GIF
            const hugEmbed = new EmbedBuilder()
                .setImage(randomGif)
                .setColor('#ff99cc');

            // Répondre avec le ping de l'utilisateur et de la cible
            await interaction.editReply({ 
                content: `${interaction.user} fait un câlin à ${user} !`, 
                embeds: [hugEmbed] 
            });
        } catch (error) {
            // Gestion des erreurs (ex. dossier vide ou problème d'accès)
            await interaction.editReply({ 
                content: 'Erreur lors de la récupération du GIF de câlin !', 
                ephemeral: true 
            });
        }
    },
};