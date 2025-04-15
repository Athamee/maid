// Importer les modules nécessaires
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Verrou simple pour concurrence (par utilisateur)
const activeCommands = new Set();

module.exports = {
    // Définir la commande
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Lister les 10 premières commandes du bot avec leurs permissions'),
    
    // Exécuter la commande
    async execute(interaction) {
        const commandKey = `${interaction.user.id}-${interaction.commandName}`;
        console.log(`[Commands] Exécuté par ${interaction.user.tag} dans ${interaction.guild.name}`);

        // Vérifier concurrence
        if (activeCommands.has(commandKey)) {
            console.log(`[Commands] Ignoré : ${commandKey} en cours`);
            await interaction.reply({ content: 'Commande en cours, veuillez attendre.', ephemeral: true });
            return;
        }
        if (interaction.deferred || interaction.replied) return;

        activeCommands.add(commandKey);

        try {
            // Différer la réponse
            await interaction.deferReply();
            const commands = interaction.client.commands;
            if (!commands || commands.size === 0) {
                console.warn('[Commands] Aucune commande trouvée');
                await interaction.editReply({ content: 'Erreur : Aucune commande.', ephemeral: true });
                return;
            }

            // Préparer les embeds
            const embeds = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('Liste des commandes du bot')
                .setDescription('Voici les 10 premières commandes avec leurs permissions et restrictions.')
                .setColor('#00FFAA')
                .setTimestamp();
            let commandCount = 0;
            let currentEmbedSize = 90;

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

            let commandsProcessed = 0;

            // Parcourir les commandes
            for (const command of commands.values()) {
                console.log(`[Commands] Traitement de ${command.data?.name || 'inconnue'}`);

                // Valider les données
                if (!command.data || typeof command.data.name !== 'string' || !command.data.name || 
                    typeof command.data.description !== 'string' || !command.data.description) {
                    console.warn(`[Commands] Commande ignorée : données invalides`);
                    continue;
                }

                // Limite à 10 commandes
                commandsProcessed++;
                if (commandsProcessed > 10) {
                    console.log('[Commands] Limite de 10 commandes atteinte');
                    break;
                }

                // Gérer les permissions
                let permissions = 'Inconnu';
                try {
                    const permValue = command.data.default_member_permissions ? 
                        String(command.data.default_member_permissions) : '0';
                    permissions = permissionMap[permValue] || `Permissions spécifiques (${permValue})`;
                } catch (err) {
                    console.warn(`[Commands] Erreur permissions ${command.data.name} : ${err.message}`);
                    permissions = 'Erreur';
                }

                // Gérer les restrictions
                let restrictions = 'Aucune';
                try {
                    const restrictionList = [];

                    // Restrictions de rôles
                    if (command.data.requiredRoles?.length > 0) {
                        const roleNames = command.data.requiredRoles.map(id => {
                            if (id === String(PermissionFlagsBits.Administrator)) return 'Administrateur';
                            const role = interaction.guild.roles.cache.get(id);
                            return role ? role.name : `Rôle inconnu (${id})`;
                        }).filter(name => name);
                        if (roleNames.length > 0) {
                            restrictionList.push(`Requiert le${roleNames.length > 1 ? 's' : ''} rôle${roleNames.length > 1 ? 's' : ''} : ${roleNames.join(', ')}`);
                        }
                    } else if (Array.isArray(command.data.options) && command.data.options.some(opt => opt && opt.type === 8)) {
                        restrictionList.push('Requiert des rôles spécifiques');
                    }

                    // Restrictions DM/serveur
                    if (command.data.dm_permission === false) {
                        restrictionList.push('Serveur uniquement (pas en DM)');
                    } else if (command.data.dm_permission === true) {
                        restrictionList.push('DM uniquement');
                    }

                    // Restrictions de salons
                    if (command.data.allowedChannels?.length > 0) {
                        const channelNames = command.data.allowedChannels
                            .map(id => {
                                const channel = interaction.guild.channels.cache.get(id);
                                return channel ? `#${channel.name}` : `Salon inconnu (${id})`;
                            })
                            .filter(name => name);
                        if (channelNames.length > 0) {
                            restrictionList.push(`Utilisable dans ${channelNames.length > 1 ? 'les salons' : 'le salon'} : ${channelNames.join(', ')}`);
                        }
                    }

                    restrictions = restrictionList.length > 0 ? restrictionList.join(', ') : 'Aucune';
                    console.log(`[Commands] Restrictions pour ${command.data.name} : ${restrictions}`);
                } catch (err) {
                    console.warn(`[Commands] Erreur restrictions ${command.data.name} : ${err.message}`);
                    restrictions = 'Erreur';
                }

                // Créer le champ
                const fieldValue = `**Description** : ${command.data.description}\n**Permissions** : ${permissions}\n**Restrictions** : ${restrictions}`;
                const field = { name: `/${command.data.name}`, value: fieldValue, inline: false };

                // Valider le champ
                if (typeof field.name !== 'string' || typeof field.value !== 'string' || 
                    field.name.length > 256 || field.value.length > 1024) {
                    console.warn(`[Commands] Commande ${command.data.name} rejetée : champ invalide`);
                    continue;
                }

                // Gérer la taille de l’embed
                const fieldSize = field.name.length + field.value.length;
                if (currentEmbedSize + fieldSize + 50 > 5500) {
                    embeds.push(currentEmbed);
                    currentEmbed = new EmbedBuilder()
                        .setTitle('Liste des commandes du bot (suite)')
                        .setDescription('Suite des 10 premières commandes.')
                        .setColor('#00FFAA')
                        .setTimestamp();
                    currentEmbedSize = 80;
                }

                currentEmbed.addFields(field);
                currentEmbedSize += fieldSize;
                commandCount++;
            }

            // Ajouter le dernier embed
            if (currentEmbed.data.fields?.length > 0) embeds.push(currentEmbed);

            // Vérifier si aucune commande
            if (commandCount === 0) {
                console.warn('[Commands] Aucune commande valide');
                await interaction.editReply({ content: 'Erreur : Aucune commande trouvée.', ephemeral: true });
                return;
            }

            // Ajouter le footer
            if (embeds.length > 0) {
                embeds[embeds.length - 1].setFooter({ 
                    text: `Exécuté par ${interaction.user.tag} | ${commandCount} commande(s) listée(s)` 
                });
            }

            // Limite des embeds
            if (embeds.length > 10) {
                const lastEmbed = new EmbedBuilder()
                    .setTitle('Liste des commandes du bot (résumé)')
                    .setDescription('Limite atteinte.')
                    .setColor('#00FFAA')
                    .setTimestamp()
                    .setFooter({ text: `Exécuté par ${interaction.user.tag} | ${commandCount} commande(s) listée(s)` });
                embeds.splice(10, embeds.length - 10, lastEmbed);
            }

            // Envoyer la réponse
            console.log(`[Commands] Envoi de ${embeds.length} embed(s) avec ${commandCount} commande(s)`);
            await interaction.editReply({ embeds });
            console.log('[Commands] Terminé');
        } catch (error) {
            console.error('[Commands] Erreur globale :', error.stack);
            try {
                await interaction.editReply({ content: 'Erreur lors de la récupération des commandes.', ephemeral: true });
            } catch (err) {
                console.error('[Commands] Erreur lors de editReply :', err.stack);
            }
        } finally {
            activeCommands.delete(commandKey);
            console.log(`[Commands] Verrou libéré pour ${commandKey}`);
        }
    }
};