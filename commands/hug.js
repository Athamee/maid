require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios'); // Assure-toi que cette ligne est bien là.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Envoie un câlin.')
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('La personne à câliner')
                .setRequired(false)
        ),
    async execute(interaction) {
        const email = process.env.PCLOUD_EMAIL;
        const password = process.env.PCLOUD_PASSWORD;
        const folderId = process.env.PCLOUD_FOLDER_ID_HUG;

        console.log('Début de /hug - Email:', email, 'Password:', password ? '[masqué]' : 'undefined', 'Folder ID:', folderId);

        if (!folderId) {
            console.log('Erreur : folderId manquant');
            return interaction.reply('Erreur : ID du dossier pour /hug non configuré !');
        }

        const sender = interaction.user;
        const target = interaction.options.getUser('membre') || interaction.user;

        try {
            console.log('Requête listfolder...');
            const listResponse = await axios.get('https://eapi.pcloud.com/listfolder', {
                params: {
                    username: email,
                    password: password,
                    folderid: folderId
                }
            });
            console.log('listfolder réussi, contenus :', listResponse.data.metadata.contents.length);
            const gifs = listResponse.data.metadata.contents.filter(file => file.contenttype === 'image/gif');
            console.log('GIFs trouvés :', gifs.length);
            if (gifs.length === 0) {
                console.log('Aucun GIF trouvé');
                return interaction.reply('Aucun GIF trouvé dans le dossier /hug !');
            }

            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            console.log('GIF choisi :', randomGif.name, 'FileID :', randomGif.fileid);

            console.log('Requête getfilelink...');
            const linkResponse = await axios.get('https://eapi.pcloud.com/getfilelink', {
                params: {
                    username: email,
                    password: password,
                    fileid: randomGif.fileid
                }
            });
            console.log('Réponse getfilelink :', linkResponse.data);
            const gifUrl = `https://${linkResponse.data.hosts[0]}${linkResponse.data.path}`;
            console.log('Lien généré :', gifUrl);

            const embed = new EmbedBuilder()
                .setDescription(sender.id === target.id
                    ? `<@${sender.id}> se fait un câlin tout seul !`
                    : `<@${sender.id}> fait un câlin à <@${target.id}> !`)
                .setImage(gifUrl)
                .setColor('#FF69B4');

            await interaction.reply({ embeds: [embed] });
            console.log('/hug réussi');
        } catch (error) {
            console.error('Erreur dans /hug :', error.response ? error.response.data : error.message);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply('Erreur lors de la récupération du GIF !');
            }
        }
    },
};