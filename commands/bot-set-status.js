// commands/bot-set-status.js
// Commande Slash réservée aux admins pour définir dynamiquement le statut du bot
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-set-status')
        .setDescription('Définit le statut personnalisé du bot (admin uniquement)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Restreint aux admins
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Le message du statut (ex: Protège la Famiglia)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type d\'activité')
                .setRequired(true)
                .addChoices(
                    { name: 'Joue', value: '0' }, // Joue à...
                    { name: 'Regarde', value: '3' }, // Regarde...
                    { name: 'Écoute', value: '2' }, // Écoute...
                    { name: 'Diffuse', value: '1' } // Diffuse... (nécessite une URL)
                )
        )
        .addStringOption(option =>
            option
                .setName('status')
                .setDescription('Statut du bot')
                .setRequired(true)
                .addChoices(
                    { name: 'En ligne', value: 'online' },
                    { name: 'Inactif', value: 'idle' },
                    { name: 'Ne pas déranger', value: 'dnd' },
                    { name: 'Invisible', value: 'invisible' }
                )
        ),
    async execute(interaction) {
        // Récupérer les options fournies par l'utilisateur
        const message = interaction.options.getString('message');
        const type = parseInt(interaction.options.getString('type')); // Convertir en nombre pour setPresence
        const status = interaction.options.getString('status');

        // Valider les entrées
        if (message.length > 128) {
            return interaction.reply({
                content: 'Erreur : Le message ne doit pas dépasser 128 caractères.',
                ephemeral: true
            });
        }

        const validTypes = [0, 1, 2, 3]; // Types autorisés : Joue, Diffuse, Écoute, Regarde
        if (!validTypes.includes(type)) {
            return interaction.reply({
                content: 'Erreur : Type d\'activité invalide. Choisissez Joue, Regarde, Écoute ou Diffuse.',
                ephemeral: true
            });
        }

        const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
        if (!validStatuses.includes(status)) {
            return interaction.reply({
                content: 'Erreur : Statut invalide. Choisissez En ligne, Inactif, Ne pas déranger ou Invisible.',
                ephemeral: true
            });
        }

        // Gestion spéciale pour Diffuse (type 1)
        let activityOptions = { name: message, type };
        if (type === 1) {
            // Vérifier si le message est une URL valide pour Diffuse
            const urlRegex = /^(https?:\/\/[^\s$.?#].[^\s]*)$/;
            if (!urlRegex.test(message)) {
                return interaction.reply({
                    content: 'Erreur : Pour "Diffuse", le message doit être une URL valide (ex: https://twitch.tv/...).',
                    ephemeral: true
                });
            }
            activityOptions.url = message; // Ajouter l’URL pour le streaming
            activityOptions.name = 'streaming'; // Nom générique pour Diffuse
        }

        try {
            // Mettre à jour le statut du bot
            await interaction.client.user.setPresence({
                status: status,
                activities: [activityOptions]
            });

            // Confirmer à l’utilisateur
            const typeNames = { 0: 'Joue à', 1: 'Diffuse', 2: 'Écoute', 3: 'Regarde' };
            await interaction.reply({
                content: `Statut mis à jour : ${typeNames[type]} "${message}" (${status}).`,
                ephemeral: true
            });
        } catch (error) {
            console.error('[BotSetStatus] Erreur lors de la mise à jour du statut :', error.message);
            await interaction.reply({
                content: 'Erreur : Impossible de mettre à jour le statut. Veuillez réessayer.',
                ephemeral: true
            });
        }
    },
};