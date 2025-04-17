// Charge les variables d’environnement depuis le fichier .env
require('dotenv').config();
// Importe les outils pour créer des commandes Slash et des embeds Discord
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
// Importe axios pour faire des requêtes HTTP vers PCloud
const axios = require('axios');

module.exports = {
    // Définit la commande Slash /spank
    data: new SlashCommandBuilder()
        .setName('spank')
        .setDescription('Claque un Fiak, ou le tien !')
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('La personne destinataire (optionnel)')
                .setRequired(false)
        ),

    // Fonction exécutée quand la commande est utilisée
    async execute(interaction) {
        // ID du salon où la commande est autorisée
        const allowedChannelId = '1358519578631868658';

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
        const folderId = process.env.PCLOUD_FOLDER_ID_SPANK;

        // Log pour déboguer
        console.log('Début de /spank - Email:', email, 'Password:', password ? '[masqué]' : 'undefined', 'Folder ID:', folderId);

        if (!folderId) {
            console.log('Erreur : folderId manquant');
            return interaction.reply('Erreur : ID du dossier pour /spank non configuré !');
        }

        // Récupère l’expéditeur et la cible
        const sender = interaction.user;
        const target = interaction.options.getUser('membre') || interaction.user;

        // Log pour vérifier la cible
        console.log('Expéditeur :', sender.tag, 'Cible :', target.tag);

        // Définit le texte avec les mentions
        const messageContent = sender.id === target.id
            ? `<@${sender.id}> se met une fessée !`
            : `<@${sender.id}> claque le Fiak de <@${target.id}> !`;

        // Log pour vérifier ce qui est envoyé
        console.log('Message envoyé :', messageContent);

        // Récupère une image de PCloud
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

            // Filtre pour inclure PNG, JPEG, GIF, WebP (statique et animé)
            const supportedFormats = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
            const images = listResponse.data.metadata.contents.filter(file => supportedFormats.includes(file.contenttype));
            console.log('Images trouvées :', images.length);

            if (images.length === 0) {
                console.log('Aucune image trouvée');
                return interaction.reply('Aucune image trouvée dans le dossier /spank !');
            }

            // Choisit une image aléatoire
            const randomImage = images[Math.floor(Math.random() * images.length)];
            console.log('Image choisie :', randomImage.name, 'FileID :', randomImage.fileid);

            // Requête pour obtenir un lien temporaire vers l'image
            console.log('Requête getfilelink...');
            const linkResponse = await axios.get('https://eapi.pcloud.com/getfilelink', {
                params: {
                    username: email,
                    password: password,
                    fileid: randomImage.fileid
                }
            });
            console.log('Réponse getfilelink :', linkResponse.data);
            const imageUrl = `https://${linkResponse.data.hosts[0]}${linkResponse.data.path}`;
            console.log('Lien image généré :', imageUrl);

            // Crée l’embed sans les mentions
            const embed = new EmbedBuilder()
                .setColor('#FF69B4');

            // Crée un attachment avec le nom de fichier original
            const attachment = new AttachmentBuilder(imageUrl, { name: randomImage.name });
            embed.setImage(`attachment://${randomImage.name}`);

            // Envoie tout en une seule fois avec reply
            await interaction.reply({
                content: messageContent,
                embeds: [embed],
                files: [attachment]
            });
            console.log('/spank super well done !');
        } catch (error) {
            console.error('Erreur dans /spank :', error.response ? error.response.data : error.message);
            await interaction.reply('Erreur lors de la récupération de l’image !');
        }
    },
};