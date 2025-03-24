const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const hugGifs = [
    "https://media1.tenor.com/m/TyM_PImMHB8AAAAd/coffee-smiley.gif",
    //ajouter au dessus les liens de gif
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coffee')
        .setDescription('Sert un café avec un GIF aléatoire !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('La personne servie')
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
        const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        // Créer un embed avec le GIF uniquement
        const hugEmbed = new EmbedBuilder()
            .setImage(randomGif)
            .setColor('#ff99cc');

        // Répondre avec le ping de l'utilisateur qui exécute et de la cible
        await interaction.reply({ 
            content: `${interaction.user} sert un café à ${user} !`, 
            embeds: [hugEmbed] 
        });
    },
};