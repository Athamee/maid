const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Chemin vers le fichier JSON
const warnFile = path.join(__dirname, '../warns.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uploadwarns')
        .setDescription('Charge un fichier warns.json pour mettre à jour les avertissements.')
        .addAttachmentOption(option =>
            option.setName('fichier')
                .setDescription('Le fichier warns.json à uploader')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const attachment = interaction.options.getAttachment('fichier');

        if (!attachment.name.endsWith('.json')) {
            return interaction.editReply({ content: 'Veuillez uploader un fichier .json valide !' });
        }

        try {
            const response = await fetch(attachment.url);
            const jsonText = await response.text();

            let newWarns;
            try {
                newWarns = JSON.parse(jsonText);
            } catch (error) {
                return interaction.editReply({ content: 'Le fichier contient un JSON invalide !' });
            }

            await fs.writeFile(warnFile, JSON.stringify(newWarns, null, 2), 'utf8');

            await interaction.editReply({ content: 'Le fichier warns.json a été mis à jour avec succès !' });
        } catch (error) {
            console.error('Erreur lors de l’upload de warns.json :', error);
            await interaction.editReply({ content: 'Une erreur est survenue lors de la mise à jour de warns.json.' });
        }
    },
};