// Charge les variables d’environnement depuis le fichier .env
require('dotenv').config();
// Importe les outils pour créer des commandes Slash et des embeds Discord
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
// Importe axios pour faire des requêtes HTTP vers PCloud
const axios = require('axios');

module.exports = {
    // Définit la commande Slash /hug
    data: new SlashCommandBuilder()
        .setName('hug') // Nom de la commande
        .setDescription('Envoie un câlin à un.e membre') // Description visible dans Discord
        .addUserOption(option => // Ajoute une option pour choisir un membre
            option
                .setName('membre') // Nom de l’option
                .setDescription('La personne à câliner') // Description de l’option
                .setRequired(false) // Optionnel : si pas de membre choisi, on câline soi-même
        ),

    // Fonction exécutée quand la commande est utilisée
    async execute(interaction) {
        // Récupère les identifiants PCloud depuis les variables d’environnement
        const email = process.env.PCLOUD_EMAIL;
        const password = process.env.PCLOUD_PASSWORD;
        const folderId = process.env.PCLOUD_FOLDER_ID_HUG;

        // Log pour déboguer : affiche les infos de connexion (mot de passe masqué pour sécurité)
        console.log('Début de /hug - Email:', email, 'Password:', password ? '[masqué]' : 'undefined', 'Folder ID:', folderId);

        // Vérifie si l’ID du dossier est défini
        if (!folderId) {
            console.log('Erreur : folderId manquant');
            return interaction.reply('Erreur : ID du dossier pour /hug non configuré !');
        }

        // Récupère l’expéditeur (celui qui tape la commande) et le destinataire (optionnel)
        const sender = interaction.user;
        const target = interaction.options.getUser('membre') || interaction.user; // Par défaut, l’expéditeur

        // Diffère la réponse pour éviter l’expiration de l’interaction (3s max sinon)
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

            // Si aucun GIF n’est trouvé, renvoie un message d’erreur
            if (gifs.length === 0) {
                console.log('Aucun GIF trouvé');
                return interaction.editReply('Aucun GIF trouvé dans le dossier /hug !');
            }

            // Choisit un GIF aléatoire parmi ceux trouvés
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

            // Construit l’URL complète du GIF
            const gifUrl = `https://${linkResponse.data.hosts[0]}${linkResponse.data.path}`;
            console.log('Lien GIF généré :', gifUrl);

            // Crée un embed avec le texte et le GIF
            const embed = new EmbedBuilder()
                .setDescription(sender.id === target.id
                    ? `<@${sender.id}> se fait un câlin tout seul !` // Si l’expéditeur se câline lui-même
                    : `<@${sender.id}> fait un câlin à <@${target.id}> !`) // Sinon, mentionne les deux membres
                .setImage(gifUrl) // Ajoute le GIF dans l’embed
                .setColor('#FF69B4'); // Couleur rose pour le style

            // Envoie l’embed en modifiant la réponse différée
            await interaction.editReply({ embeds: [embed] });
            console.log('/hug réussi');
        } catch (error) {
            // En cas d’erreur (ex. problème réseau ou PCloud), logge l’erreur et envoie un message
            console.error('Erreur dans /hug :', error.response ? error.response.data : error.message);
            await interaction.editReply('Erreur lors de la récupération du GIF !');
        }
    },
};