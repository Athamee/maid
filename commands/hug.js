require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Envoie un câlin à un.e membre')
        .addUserOption(option => // Ajout d'une option pour choisir un membre
            option
                .setName('membre')
                .setDescription('La personne à câliner')
                .setRequired(false) // Optionnel, si pas spécifié, on câline soi-même ou un message générique
        ),
    async execute(interaction) {
        const email = process.env.PCLOUD_EMAIL;
        const password = process.env.PCLOUD_PASSWORD;
        const folderId = process.env.PCLOUD_FOLDER_ID_HUG;

        console.log('Début de /hug - Email:', email, 'Folder ID:', folderId);

        if (!folderId) {
            console.log('Erreur : folderId manquant');
            return interaction.reply('Erreur : ID du dossier pour /hug non configuré !');
        }

        // Récupérer l'utilisateur cible (ou l'auteur si aucun n'est spécifié)
        const target = interaction.options.getUser('membre') || interaction.user;
        const sender = interaction.user;

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
            const gifUrl = `https://${linkResponse.data.hosts[0]}${linkResponse.data.path}`;
            console.log('Lien généré :', gifUrl);

            // Message personnalisé avec le sender et le target
            const message = sender.id === target.id
                ? `${sender.username} se fait un câlin tout seul !`
                : `${sender.username} envoie un câlin à ${target.username} !`;
            await interaction.reply({ content: message, files: [gifUrl] });
            console.log('/hug réussi');
        } catch (error) {
            console.error('Erreur dans /hug :', error.response ? error.response.data : error.message);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply('Erreur lors de la récupération du GIF !');
            }
        }
    },
};