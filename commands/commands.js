const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Liste les 10 premières commandes avec leurs permissions et restrictions'),

    // Métadonnées pour commands.js : aucune restriction
    permissions: {
        roles: [], // Aucun rôle requis
        bitPermissions: [] // Aucune permission spécifique
    },
    restrictions: {
        allowedChannels: [], // Tous les salons autorisés
        restrictedChannels: [] // Aucun salon interdit
    },

    async execute(interaction) {
        // Reporter la réponse pour charger les commandes
        await interaction.deferReply();

        try {
            // Charger les fichiers de commandes
            const commandsPath = path.join(__dirname);
            const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith('.js'));

            // Limiter aux 10 premières commandes
            const commands = [];
            for (const file of commandFiles.slice(0, 10)) {
                const command = require(path.join(commandsPath, file));
                commands.push(command);
            }

            // Construire l'embed
            const embed = new EmbedBuilder()
                .setTitle('Liste des commandes')
                .setDescription('Voici les 10 premières commandes disponibles :')
                .setColor('#00AAFF');

            // Ajouter chaque commande
            for (const command of commands) {
                const name = command.data?.name || 'Inconnu';
                const description = command.data?.description || 'Aucune description';
                
                // Rôles autorisés (noms lisibles, sans ping)
                const roles = command.permissions?.roles?.length > 0 
                    ? command.permissions.roles.map(id => {
                        const role = interaction.guild.roles.cache.get(id);
                        return role ? role.name : 'Inconnu';
                    }).join(', ')
                    : 'Aucun';
                
                // Permissions
                const perms = command.permissions?.bitPermissions?.length > 0 
                    ? command.permissions.bitPermissions.map(perm => {
                        if (perm === PermissionFlagsBits.Administrator) return 'Administrateur';
                        if (perm === PermissionFlagsBits.ManageMessages) return 'Gérer les messages';
                        return 'Inconnu';
                    }).join(', ')
                    : 'Aucune';

                // Salons (noms lisibles, sans ping)
                const allowed = command.restrictions?.allowedChannels?.length > 0 
                    ? command.restrictions.allowedChannels.map(id => {
                        const channel = interaction.guild.channels.cache.get(id);
                        return channel ? channel.name : 'Inconnu';
                    }).join(', ')
                    : 'Tous';
                const restricted = command.restrictions?.restrictedChannels?.length > 0 
                    ? command.restrictions.restrictedChannels.map(id => {
                        const channel = interaction.guild.channels.cache.get(id);
                        return channel ? channel.name : 'Inconnu';
                    }).join(', ')
                    : 'Aucun';

                embed.addFields({
                    name: `/${name}`,
                    value: `**Description** : ${description}\n` +
                           `**Rôles** : ${roles}\n` +
                           `**Permissions** : ${perms}\n` +
                           `**Salons autorisés** : ${allowed}\n` +
                           `**Salons restreints** : ${restricted}`,
                    inline: false
                });
            }

            // Si moins de 10 commandes
            if (commands.length < 10) {
                embed.addFields({
                    name: 'Note',
                    value: `Seulement ${commands.length} commande(s) trouvée(s).`,
                    inline: false
                });
            }

            // Répondre avec l'embed (non éphémère)
            await interaction.editReply({ embeds: [embed] });

            console.log(`[Commands] Exécuté par ${interaction.user.tag} : ${commands.length} commande(s) listée(s)`);
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Erreur')
                .setDescription('Impossible de lister les commandes.')
                .setColor('#FF0000');

            // Répondre avec l'erreur (non éphémère)
            await interaction.editReply({ embeds: [errorEmbed] });

            console.error(`[Commands] Erreur pour ${interaction.user.tag} :`, error.stack);
        }
    }
};