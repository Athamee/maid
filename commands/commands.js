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
            // Vérifier concurrence
            if (interaction.deferred || interaction.replied) {
                console.log('[Commands] Interaction déjà traitée, ignorée');
                return;
            }

            // Différer la réponse rapidement
            console.log('[Commands] Différer la réponse');
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
            let currentEmbedSize = 30 + 50; // Titre (~30) + description (~50)

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

                // Estimer taille du champ
                const fieldSize = (field.name.length || 0) + (field.value.length || 0);
                if (field.name.length > 256 || field.value.length > 1024) {
                    console.warn(`[Commands] Commande ${command.data.name} rejetée : champ trop long (nom: ${field.name.length}, valeur: ${field.value.length})`);
                    continue;
                }

                // Vérifier taille embed
                if (currentEmbedSize + fieldSize + 50 > 5500) { // Marge pour footer
                    console.log(`[Commands] Limite de ~5500 caractères atteinte, création d’un nouvel embed`);
                    embeds.push(currentEmbed);
                    currentEmbed = new EmbedBuilder()
                        .setTitle('Liste des commandes du bot (suite)')
                        .setDescription('Suite des commandes disponibles.')
                        .setColor('#00FFAA')
                        .setTimestamp();
                    currentEmbedSize = 30 + 50; // Réinitialiser
                }

                // Ajouter le champ
                console.log(`[Commands] Ajout de ${command.data.name} à l’embed (taille: ${fieldSize})`);
                currentEmbed.addFields(field);
                currentEmbedSize += fieldSize;
                commandCount++;
            }

            // Ajouter le dernier embed
            if (currentEmbed.data.fields?.length > 0) {
                console.log(`[Commands] Ajout du dernier embed avec ${currentEmbed.data.fields.length} champs`);
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
                currentEmbedSize += 50; // Estimation footer
            }

            // Vérifier limite embeds
            if (embeds.length > 10) {
                console.warn(`[Commands] Trop d’embeds (${embeds.length}), regroupement des derniers`);
                const lastEmbed = new EmbedBuilder()
                    .setTitle('Liste des commandes du bot (résumé)')
                    .setDescription('Certaines commandes n’ont pas pu être listées (limite atteinte).')
                    .setColor('#00FFAA')
                    .setTimestamp()
                    .setFooter({ text: `Exécuté par ${interaction.user.tag} | ${commandCount} commandes listées` });
                embeds.splice(10, embeds.length - 10, lastEmbed);
            }

            // Envoyer les embeds
            console.log(`[Commands] Envoi de ${embeds.length} embed(s) avec ${commandCount} commandes`);
            await interaction.editReply({ embeds });
            console.log('[Commands] Terminé : Liste envoyée');
        } catch (error) {
            console.error('[Commands] Erreur globale :', error.stack);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: 'Erreur lors de la récupération des commandes.',
                    ephemeral: true
                }).catch(err => console.error('[Commands] Erreur lors de reply :', err.stack));
            } else {
                await interaction.editReply({
                    content: 'Erreur lors de la récupération des commandes.',
                    ephemeral: true
                }).catch(err => console.error('[Commands] Erreur lors de editReply :', err.stack));
            }
        }
    }
};