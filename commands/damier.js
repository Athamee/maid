const { ApplicationCommandType, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const Canvas = require('@napi-rs/canvas');

module.exports = {
    commandDatas: {
        name: 'damier',
        description: 'Génère un damier à partir de l\'image fournie.',
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: 11, // Type pour un attachement (fichier/image)
                name: 'image',
                description: 'L\'image à utiliser pour le damier.',
                required: true,
            },
            {
                type: 3, // Type pour une chaîne
                name: 'taille',
                description: 'Taille du damier (par exemple, 4x4).',
                required: true,
            }
        ],
    },
    async execute(interaction) {
        // Vérification que la commande est utilisée en MP
        if (interaction.guild) {
            return interaction.reply({ content: 'Cette commande doit être utilisée en message privé avec le bot.', ephemeral: true });
        }

        // Vérification de l'image attachée
        const imageAttachment = interaction.options.getAttachment('image');
        if (!imageAttachment) {
            return interaction.reply({ content: 'Veuillez fournir une image.', ephemeral: true });
        }

        // Vérification de la taille du damier
        const gridSize = interaction.options.getString('taille');
        const sizes = gridSize.split('x').map(Number);
        if (sizes.length !== 2 || sizes.some(size => size < 1)) {
            return interaction.reply({ content: "Veuillez fournir une taille de grille valide, par exemple `4x4`.", ephemeral: true });
        }

        const [nw, nh] = sizes;
        const n = nw * nh;

        // Répondre avec un message de typage pour indiquer que le bot travaille
        await interaction.deferReply();

        try {
            // Définir une taille maximale pour le canvas (par exemple 1024x1024)
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;

            let newWidth = imageAttachment.width;
            let newHeight = imageAttachment.height;

            // Redimensionner si nécessaire
            if (newWidth > MAX_WIDTH || newHeight > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / newWidth, MAX_HEIGHT / newHeight);
                newWidth = Math.floor(newWidth * ratio);
                newHeight = Math.floor(newHeight * ratio);
            }

            // Création du canvas redimensionné
            const canvas = Canvas.createCanvas(newWidth, newHeight);
            const context = canvas.getContext('2d');

            // Chargement de l'image de fond et redimensionnement
            const background = await Canvas.loadImage(imageAttachment.url);
            context.drawImage(background, 0, 0, newWidth, newHeight);

            let w = newWidth / nw;
            let h = newHeight / nh;

            // Chargement des images noires et blanches depuis des fichiers locaux
            const noirImage = await Canvas.loadImage(fs.readFileSync(path.join(__dirname, '..', 'img', 'noir.png')));
            const blancImage = await Canvas.loadImage(fs.readFileSync(path.join(__dirname, '..', 'img', 'blanc.png')));

            // Création des carrés du damier
            let carrés = [];
            let x = 0, y = 0;
            let color;

            for (let i = 0; i < n; i++) {
                if (nw % 2 == 0) {
                    if (y % 2 == 0) {
                        color = x % 2 == 0 ? 'noir' : 'blanc';
                    } else {
                        color = x % 2 == 0 ? 'blanc' : 'noir';
                    }
                } else {
                    color = i % 2 == 0 ? 'noir' : 'blanc';
                }

                carrés.push({ color, x: x * w, y: y * h, w, h });
                x++;
                if (x >= nw) {
                    x = 0;
                    y++;
                }
            }

            // Mélange des carrés
            const shuffleCarrés = carrés.sort(() => Math.random() - 0.5);

            // Génération et envoi des images une par une
            for (let i = 0; i < n; i++) {
                // Redessine l'image de fond pour chaque carré
                context.drawImage(background, 0, 0, newWidth, newHeight);

                // Applique le motif du damier en laissant progressivement des cases sans recouvrement
                for (let j = 0; j < shuffleCarrés.length; j++) {
                    const carré = shuffleCarrés[j];
                    if (j >= i) {
                        // Ne rien faire, laisser l'image originale apparaître
                    } else {
                        if (carré.color === 'noir') {
                            context.drawImage(noirImage, carré.x, carré.y, carré.w, carré.h);
                        } else {
                            context.drawImage(blancImage, carré.x, carré.y, carré.w, carré.h);
                        }
                    }
                }

                // Encode l'image avec une qualité réduite
                const buffer = await canvas.encode('png', { compressionLevel: 9, filters: canvas.PNG_FILTER_NONE });
                
                const attachment = new AttachmentBuilder(buffer, {
                    name: `damier_${i}.png`
                });

                // Envoi de l'image une par une
                await interaction.followUp({ files: [attachment] });
            }

            console.log(`Fin de la génération d'un damier pour ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur lors de la génération du damier :', error);
            await interaction.followUp({ content: 'Une erreur est survenue lors de la génération du damier.', ephemeral: true });
        }
    },
};