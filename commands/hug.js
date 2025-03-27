const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Fais un câlin à quelqu’un avec un GIF aléatoire !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('La personne à câliner')
                .setRequired(true)),
    async execute(interaction, { getGifList }) {
        const allowedChannelId = '1353348735660195911';

        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({ 
                content: 'Désolé, cette commande ne peut être utilisée que dans un salon spécifique !', 
                ephemeral: true 
            });
        }

        const user = interaction.options.getUser('cible');
        await interaction.deferReply({ content: 'Chargement du câlin en cours…' });

        try {
            const gifs = getGifList('hug'); // Plus d’await, car synchrone
            if (!gifs || gifs.length === 0) {
                throw new Error('Aucun GIF disponible pour les câlins');
            }

            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            const gifUrl = randomGif.webViewLink; // Essaie webViewLink pour l’animation

            const hugEmbed = new EmbedBuilder()
                .setImage(gifUrl)
                .setColor('#ff99cc');

            await interaction.editReply({ 
                content: `${interaction.user} fait un câlin à ${user} !`, 
                embeds: [hugEmbed] 
            });
        } catch (error) {
            console.error('Erreur lors de l’exécution de hug :', error);
            await interaction.editReply({ 
                content: 'Erreur lors de la récupération du GIF de câlin ! Utilise /refresh_gif si le problème persiste.', 
                ephemeral: true 
            });
        }
    },
};