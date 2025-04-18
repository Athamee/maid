// Importe les outils pour créer des commandes Slash et des embeds Discord
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const Canvas = require('@napi-rs/canvas');

module.exports = {
    // Définit la commande Slash /damier
    data: new SlashCommandBuilder()
        .setName('damier')
        .setDescription('Génère un damier à partir de l\'image fournie (en MP uniquement)')
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('L\'image à utiliser pour le damier')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('taille')
                .setDescription('Taille du damier (par exemple, 4x4)')
                .setRequired(true)
        )
        // Autorise l'utilisation en DM
        .setDMPermission(true),

    // Fonction exécutée quand la commande est utilisée
    async execute(interaction) {
        // Vérification que la commande est utilisée en MP
        if (interaction.guild) {
            return interaction.reply({
                content: 'Cette commande doit être utilisée en message privé avec le bot !',
                ephemeral: true
            });
        }

        // Récupère l'image attachée et la taille
        const imageAttachment = interaction.options.getAttachment('image');
        const gridSize = interaction.options.getString('taille');
        console.log('Début de /damier - Utilisateur:', interaction.user.tag, 'Taille demandée:', gridSize);

        // Vérifie si une image est fournie
        if (!imageAttachment) {
            console.log('Erreur : Aucune image fournie');
            return interaction.reply({
                content: 'Veuillez fournir une image !',
                ephemeral: true
            });
        }

        // Vérifie la validité de la taille
        const sizes = gridSize.split('x').map(Number);
        if (sizes.length !== 2 || sizes.some(size => size < 1 || isNaN(size))) {
            console.log('Erreur : Taille invalide', gridSize);
            return interaction.reply({
                content: 'Veuillez fournir une taille de grille valide, par exemple `4x4` !',
                ephemeral: true
            });
        }

        const [nw, nh] = sizes;
        const n = nw * nh;
        console.log('Grille validée :', nw, 'x', nh, '(', n, 'carrés)');

        // Répond avec un message temporaire pour indiquer que le bot travaille
        await interaction.deferReply();
        console.log('Commande différée, génération en cours...');

        try {
            // Définir une taille maximale pour le canvas
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;

            // Charge l'image pour obtenir ses dimensions
            const background = await Canvas.loadImage(imageAttachment.url);
            let newWidth = background.width;
            let newHeight = background.height;

            // Redimensionne si nécessaire
            if (newWidth > MAX_WIDTH || newHeight > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / newWidth, MAX_HEIGHT / newHeight);
                newWidth = Math.floor(newWidth * ratio);
                newHeight = Math.floor(newHeight * ratio);
                console.log('Image redimensionnée à', newWidth, 'x', newHeight);
            }

            // Crée le canvas
            const canvas = Canvas.createCanvas(newWidth, newHeight);
            const context = canvas.getContext('2d');
            context.drawImage(background, 0, 0, newWidth, newHeight);

            const w = newWidth / nw;
            const h = newHeight / nh;
            console.log('Taille des carrés :', w, 'x', h);

            // Charge les images locales pour le damier
            const noirImage = await Canvas.loadImage(fs.readFileSync(path.join(__dirname, '..', 'img', 'noir.png')));
            const blancImage = await Canvas.loadImage(fs.readFileSync(path.join(__dirname, '..', 'img', 'blanc.png')));
            console.log('Images noir/blanc chargées');

            // Crée les carrés du damier
            const carrés = [];
            let x = 0, y = 0;
            for (let i = 0; i < n; i++) {
                const color = (nw % 2 === 0)
                    ? (y % 2 === 0 ? (x % 2 === 0 ? 'noir' : 'blanc') : (x % 2 === 0 ? 'blanc' : 'noir'))
                    : (i % 2 === 0 ? 'noir' : 'blanc');
                carrés.push({ color, x: x * w, y: y * h, w, h });
                x++;
                if (x >= nw) {
                    x = 0;
                    y++;
                }
            }

            // Mélange les carrés
            const shuffleCarrés = carrés.sort(() => Math.random() - 0.5);
            console.log('Damier mélangé, génération des images...');

            // Définit le nombre d'images par groupe
            const groupSize = 5;
            const attachments = [];

            // Génère les images et les regroupe
            for (let i = 0; i < n; i++) {
                context.drawImage(background, 0, 0, newWidth, newHeight);
                for (let j = 0; j < shuffleCarrés.length; j++) {
                    const carré = shuffleCarrés[j];
                    if (j < i) {
                        const overlay = carré.color === 'noir' ? noirImage : blancImage;
                        context.drawImage(overlay, carré.x, carré.y, carré.w, carré.h);
                    }
                }

                const buffer = await canvas.encode('png', { compressionLevel: 9, filters: canvas.PNG_FILTER_NONE });
                const attachment = new AttachmentBuilder(buffer, { name: `damier_${i}.png` });
                attachments.push(attachment);

                // Envoie par groupe de 5 ou à la fin
                if (attachments.length === groupSize || i === n - 1) {
                    await interaction.followUp({ files: attachments });
                    console.log(`Groupe d'images envoyé (${attachments.length}/${n})`);
                    attachments.length = 0; // Réinitialise le tableau
                }
            }

            console.log(`Fin de /damier pour ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur dans /damier :', error.message, error.stack);
            await interaction.followUp({
                content: 'Une erreur est survenue lors de la génération du damier !',
                ephemeral: true
            });
        }
    },
};