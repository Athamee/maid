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
        .setName('cookie')
        .setDescription('Offre un cookie à un.e membre ou à toi-même')
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('La personne destinataire du cookie (optionnel)')
                .setRequired(false)
        ),

    // Fonction exécutée quand la commande est utilisée
    async execute(interaction) {
        // ID du salon où la commande est autorisée
        const allowedChannelId = '1353348735660195911';

        // Vérifie si la commande est utilisée dans le bon salon
        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({
                content: 'Cette commande ne peut être utilisée que dans un salon spécifique !',
                ephemeral: true
            });
        }

        // Récupère les identifiants PCloud depuis les variables d’environnement
        const email = process.env.PCLOUD_EMAIL;
        const password = process.env.PCLOUD_PASSWORD;
        const folderId = process.env.PCLOUD_FOLDER_ID_COOKIE;

        // Log pour déboguer
        console.log('Début de /cookie - Email:', email, 'Password:', password ? '[masqué]' : 'undefined', 'Folder ID:', folderId);

        if (!folderId) {
            console.log('Erreur : folderId manquant');
            return interaction.reply('Erreur : ID du dossier pour /cookie non configuré !');
        }

        // Récupère l’expéditeur et la cible
        const sender = interaction.user;
        const target = interaction.options.getUser('membre') || interaction.user;

        // Log pour vérifier la cible
        console.log('Expéditeur :', sender.tag, 'Cible :', target.tag);

        // Définit le texte avec les mentions
        const messageContent = sender.id === target.id
            ? `<@${sender.id}> mange un cookie !`
            : `<@${sender.id}> offre un cookie à <@${target.id}> !`;

        // Log pour vérifier ce qui est envoyé
        console.log('Message envoyé :', messageContent);

        // Récupère un GIF de PCloud
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
                return interaction.reply('Aucun GIF trouvé dans le dossier /cookie !');
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

            // Crée l’embed sans les mentions
            const embed = new EmbedBuilder()
                .setColor('#FF69B4');

            // Crée un attachment pour le GIF
            const attachment = new AttachmentBuilder(gifUrl, { name: 'cookie.gif' });
            embed.setImage('attachment://cookie.gif');

            // Envoie tout en une seule fois avec reply
            await interaction.reply({
                content: messageContent,
                embeds: [embed],
                files: [attachment]
            });
            console.log('/cookie served');
        } catch (error) {
            console.error('Erreur dans /coffee :', error.response ? error.response.data : error.message);
            await interaction.reply('Erreur lors de la récupération du GIF !');
        }
    },
};