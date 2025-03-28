require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Envoie un câlin avec un GIF aléatoire'),
    async execute(interaction) {
        const email = process.env.PCLOUD_EMAIL;
        const password = process.env.PCLOUD_PASSWORD;
        const folderId = process.env.PCLOUD_FOLDER_ID_HUG; // Spécifique à /hug

        if (!folderId) {
            return interaction.reply('Erreur : ID du dossier pour /hug non configuré !');
        }

        try {
            // Lister les fichiers
            const listResponse = await axios.get('https://eapi.pcloud.com/listfolder', {
                params: {
                    username: email,
                    password: password,
                    folderid: folderId
                }
            });
            const gifs = listResponse.data.metadata.contents.filter(file => file.contenttype === 'image/gif');
            if (gifs.length === 0) {
                return interaction.reply('Aucun GIF trouvé dans le dossier /hug !');
            }

            // Choisir un GIF aléatoire
            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            const linkResponse = await axios.get('https://eapi.pcloud.com/getfilelink', {
                params: {
                    username: email,
                    password: password,
                    fileid: randomGif.fileid
                }
            });
            const gifUrl = `https://${linkResponse.data.hosts[0]}${linkResponse.data.path}`;

            // Envoyer dans Discord
            await interaction.reply(gifUrl);
        } catch (error) {
            console.error('Erreur :', error.response ? error.response.data : error.message);
            await interaction.reply('Erreur lors de la récupération du GIF !');
        }
    },
};