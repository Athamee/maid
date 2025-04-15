// Importer les modules nécessaires
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    // Définir la commande
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Lister toutes les commandes du bot avec leurs permissions'),

    // Exécuter la commande
    async execute(interaction) {
        console.log(`[Commands] Commande exécutée par ${interaction.user.tag} dans ${interaction.guild.name} (ID: ${interaction.guild.id})`);

        try {
            // Différer la réponse pour collecter les commandes
            await interaction.deferReply();

            // Récupérer toutes les commandes
            console.log('[Commands] Récupération des commandes depuis client.commands');
            const commands = interaction.client.commands;
            if (!commands || commands.size === 0) {
                console.warn('[Commands] Aucune commande trouvée dans client.commands');
                return interaction.editReply({
                    content: 'Erreur : Aucune commande disponible.',
                    ephemeral: true
                });
            }

            // Créer un tableau d’embeds
            console.log(`[Commands] Préparation des embeds pour ${commands.size} commandes`);
            const embeds = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('Liste des commandes du bot')
                .setDescription('Voici toutes les commandes disponibles avec leurs permissions et restrictions.')
                .setColor('#00FFAA')
                .setTimestamp();
            let commandCount = 0;
            let fieldsInCurrentEmbed = 0;
            const maxFieldsPerEmbed = 5; // Limite à 5 commandes par embed

            // Mapper les permissions Discord
            const permissionMap = {
                [PermissionFlagsBits.Administrator.toString()]: 'Administrateur',
                [PermissionFlagsBits.KickMembers.toString()]: 'Expulser des membres',
                [PermissionFlagsBits.BanMembers.toString()]: 'Bannir des membres',
                [PermissionFlagsBits.ManageMessages.toString()]: 'Gérer les messages',
                [PermissionFlagsBits.ManageRoles.toString()]: 'Gérer les rôles',
                [PermissionFlagsBits.ManageChannels.toString()]: 'Gérer les salons',
                '0': 'Aucune (accessible à tous)'
            };

            // Parcourir les commandes
            for (const command of commands.values()) {
                console.log(`[Commands] Traitement de la commande ${command.data.name}`);

                // Vérifier données commande
                if (!command.data.name || !command.data.description) {
                    console.warn(`[Commands] Commande invalide : ${JSON.stringify(command.data)}`);
                    continue;
                }

                // Mapper permissions
                let permissions = 'Inconnu';
                const permValue = command.data.default_member_permissions?.toString() || '0';
                permissions = permissionMap[permValue] || `Permissions spécifiques (${permValue})`;

                // Vérifier restrictions (ex. rôles)
                let restrictions = 'Aucune';
                const roleOptions = command.data.options?.filter(opt => opt.type === 8); // 8 = Role
                if (roleOptions?.length > 0) {
                    restrictions = 'Requiert des rôles spécifiques';
                }

                // Créer champ
                const field = {
                    name: `/${command.data.name}`,
                    value: `**Description** : ${command.data.description}\n**Permissions** : ${permissions}\n**Restrictions** : ${restrictions}`,
                    inline: false
                };

                // Vérifier limite de champs
                if (fieldsInCurrentEmbed >= maxFieldsPerEmbed) {
                    console.log(`[Commands] Limite de ${maxFieldsPerEmbed} champs atteinte, création d’un nouvel embed`);
                    embeds.push(currentEmbed);
                    currentEmbed = new EmbedBuilder()
                        .setTitle('Liste des commandes du bot (suite)')
                        .setDescription('Suite des commandes disponibles.')
                        .setColor('#00FFAA')
                        .setTimestamp();
                    fieldsInCurrentEmbed = 0;
                }

                // Ajouter le champ
                currentEmbed.addFields(field);
                fieldsInCurrentEmbed++;
                commandCount++;
            }

            // Ajouter le dernier embed
            if (fieldsInCurrentEmbed > 0) {
                console.log(`[Commands] Ajout du dernier embed avec ${fieldsInCurrentEmbed} champs`);
                embeds.push(currentEmbed);
            }

            // Vérifier si aucune commande ajoutée
            if (commandCount === 0) {
                console.warn('[Commands] Aucune commande valide ajoutée');
                return interaction.editReply({
                    content: 'Erreur : Aucune commande valide à lister.',
                    ephemeral: true
                });
            }

            // Ajouter footer au dernier embed
            if (embeds.length > 0) {
                embeds[embeds.length - 1].setFooter({
                    text: `Exécuté par ${interaction.user.tag} | ${commandCount} commandes listées`
                });
            }

            // Envoyer les embeds
            console.log(`[Commands] Envoi de ${embeds.length} embed(s) avec ${commandCount} commandes`);
            await interaction.editReply({ embeds });
            console.log('[Commands] Terminé : Liste envoyée');
        } catch (error) {
            console.error('[Commands] Erreur globale :', error.stack);
            await interaction.editReply({
                content: 'Erreur lors de la récupération des commandes.',
                ephemeral: true
            });
        }
    }
};