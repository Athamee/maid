require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Envoie un câlin à un.e membre ou à toi-même')
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('La personne à câliner (optionnel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const allowedChannelId = '1353348735660195911';

        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({
                content: 'Cette commande ne peut être utilisée que dans un salon spécifique !',
                ephemeral: true
            });
        }

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

        console.log('Expéditeur :', sender.tag, 'Cible :', target.tag);

        const messageContent = sender.id === target.id
            ? `<@${sender.id}> réclame un câlin !`
            : `<@${sender.id}> fait un câlin à <@${target.id}> !`;

        console.log('Message envoyé :', messageContent);

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

            const supportedFormats = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
            const images = listResponse.data.metadata.contents.filter(file => supportedFormats.includes(file.contenttype));
            console.log('Images trouvées :', images.length);

            if (images.length === 0) {
                console.log('Aucune image trouvée');
                return interaction.reply('Aucune image trouvée dans le dossier /hug !');
            }

            const randomImage = images[Math.floor(Math.random() * images.length)];
            console.log('Image choisie :', randomImage.name, 'FileID :', randomImage.fileid);

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

            const embed = new EmbedBuilder()
                .setColor('#FF69B4');

            const attachment = new AttachmentBuilder(imageUrl, { name: randomImage.name });
            embed.setImage(`attachment://${randomImage.name}`);

            await interaction.reply({
                content: messageContent,
                embeds: [embed],
                files: [attachment]
            });
            console.log('/hug super well done !');
        } catch (error) {
            console.error('Erreur dans /hug :', error.response ? error.response.data : error.message);
            await interaction.reply('Erreur lors de la récupération de l’image !');
        }
    },
};