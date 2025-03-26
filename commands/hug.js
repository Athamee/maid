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
        const allowedChannelId = '1353348735660195911';

        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({ 
                content: 'Désolé, cette commande ne peut être utilisée que dans un salon spécifique !', 
                ephemeral: true 
            });
        }

        const user = interaction.options.getUser('cible');
        await interaction.deferReply();

        try {
            const folderId = process.env.GDRIVE_HUG;
            const fileResult = await getRandomFileFromDrive(folderId);

            // On suppose que fileResult est un ID, on construit l’URL
            const randomGif = `https://drive.google.com/uc?export=download&id=${fileResult}`;

            const hugEmbed = new EmbedBuilder()
                .setImage(randomGif)
                .setColor('#ff99cc');

            // On envoie l’URL dans le message pour la voir
            await interaction.editReply({ 
                content: `${interaction.user} fait un câlin à ${user} !\nURL test : ${randomGif}`, 
                embeds: [hugEmbed] 
            });
        } catch (error) {
            await interaction.editReply({ 
                content: 'Erreur lors de la récupération du GIF de câlin !', 
                ephemeral: true 
            });
        }
    },
};