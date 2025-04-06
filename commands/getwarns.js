const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Chemin vers le fichier JSON
const warnFile = path.join(__dirname, '../warns.json');

// Fonction pour lire les warns
async function getWarns() {
    try {
        const data = await fs.readFile(warnFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // Retourne un objet vide si le fichier n'existe pas
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getwarns')
        .setDescription('Récupère une copie du fichier warns.json.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers), // Réservé aux modérateurs
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Réponse éphémère pour confidentialité

        // Lit le contenu du fichier warns.json
        const warns = await getWarns();

        // Si le fichier est vide
        if (Object.keys(warns).length === 0) {
            return interaction.editReply({ content: 'Le fichier warns.json est vide pour le moment.' });
        }

        // Convertit l’objet en texte JSON lisible
        const warnText = JSON.stringify(warns, null, 2);

        // Option 1 : Envoie le contenu directement si court
        if (warnText.length < 2000) { // Limite Discord pour un message
            return interaction.editReply({ content: 'Voici le contenu actuel de warns.json :\n```json\n' + warnText + '\n```' });
        }

        // Option 2 : Envoie en pièce jointe si trop long
        const buffer = Buffer.from(warnText, 'utf8');
        const attachment = {
            attachment: buffer,
            name: 'warns.json',
        };

        await interaction.editReply({
            content: 'Le fichier warns.json est trop long pour être affiché ici. Voici une copie en pièce jointe :',
            files: [attachment],
        });
    },
};