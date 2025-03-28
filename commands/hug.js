// Charge les variables d’environnement depuis le fichier .env
require('dotenv').config();
// Importe les outils pour créer des commandes Slash et des embeds Discord
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
// Importe axios pour faire des requêtes HTTP vers PCloud
const axios = require('axios');

module.exports = {
    // Définit la commande Slash /hug
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Envoie un câlin à un.e membre ou à toi-même')
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('La personne à câliner (optionnel)')
                .setRequired(false) // L’option reste facultative
        ),

    // Fonction exécutée quand la commande est utilisée
    async execute(interaction) {
        // Récupère les identifiants PCloud depuis les variables d’environnement
        const email = process.env.PCLOUD_EMAIL;
        const password = process.env.PCLOUD_PASSWORD;
        const folderId = process.env.PCLOUD_FOLDER_ID_HUG;

        // Log pour déboguer
        console.log('Début de /hug - Email:', email, 'Password:', password ? '[masqué]' : 'undefined', 'Folder ID:', folderId);

        if (!folderId) {
            console.log('Erreur : folderId manquant');
            return interaction.reply('Erreur : ID du dossier pour /hug non configuré !');
        }

        // Récupère l’expéditeur et la cible
        const sender = interaction.user;
        const target = interaction.options.getUser('membre') || interaction.user; // Si pas de cible, c’est l’expéditeur

        // Log pour vérifier la cible
        console.log('Expéditeur :', sender.tag, 'Cible :', target.tag);

        // Diffère la réponse pour éviter l’expiration
        await interaction.deferReply();

        try {
            // Requête pour lister les fichiers dans le dossier PCloud
            console.log('Requête listfolder...');
            const listResponse = await axios.get('https://eapi.pcloud.com/listfolder', {
                params: {
                    username: email,
                    password: password,
                    folderid: folderId
                }
            });
            console.log('listfolder réussi, contenus :', listResponse.data.metadata.contents.length);

            // Filtre pour ne garder que les GIFs
            const gifs = listResponse.data.metadata.contents.filter(file => file.contenttype === 'image/gif');
            console.log('GIFs trouvés :', gifs.length);

            if (gifs.length === 0) {
                console.log('Aucun GIF trouvé');
                return interaction.editReply('Aucun GIF trouvé dans le dossier /hug !');
            }

            // Choisit un GIF aléatoire
            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            console.log('GIF choisi :', randomGif.name, 'FileID :', randomGif.fileid);

            // Requête pour obtenir un lien temporaire vers le GIF
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
            console.log('Lien GIF généré :', gifUrl);

            // Crée l’embed avec le texte adapté
            const embed = new EmbedBuilder()
                .setDescription(sender.id === target.id
                    ? `<@${sender.id}> se fait un câlin !`
                    : `<@${sender.id}> fait un câlin à <@${target.id}> !`)
                .setColor('#FF69B4');

            // Crée un attachment pour le GIF
            const attachment = new AttachmentBuilder(gifUrl, { name: 'hug.gif' });
            embed.setImage('attachment://hug.gif');

            // Envoie la réponse
            await interaction.editReply({ embeds: [embed], files: [attachment] });
            console.log('/hug réussi');
        } catch (error) {
            console.error('Erreur dans /hug :', error.response ? error.response.data : error.message);
            await interaction.editReply('Erreur lors de la récupération du GIF !');
        }
    },
};