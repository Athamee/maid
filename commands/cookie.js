const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const cookieGifs = [
    '',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cookie')
        .setDescription('Offre un cookie à quelqu’un avec un GIF aléatoire !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('La personne destinataire')
                .setRequired(true)),
    async execute(interaction) {
        const allowedChannelId = '1353348735660195911'; // Remplace par l'ID du salon autorisé

        // Vérifier si la commande est utilisée dans le bon salon
        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({ 
                content: 'Désolé, cette commande ne peut être utilisée que dans un salon spécifique !', 
                ephemeral: true // Message visible uniquement par l'utilisateur
            });
        }

        const user = interaction.options.getUser('cible');
        const randomGif = cookieGifs[Math.floor(Math.random() * cookieGifs.length)];

        // Créer un embed avec le GIF uniquement
        const hugEmbed = new EmbedBuilder()
            .setImage(randomGif)
            .setColor('#ff99cc');

        // Répondre avec le ping de l'utilisateur qui exécute et de la cible
        await interaction.reply({ 
            content: `${interaction.user} offre un cookie à ${user} !`, 
            embeds: [hugEmbed] 
        });
    },
};