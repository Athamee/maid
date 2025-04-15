// Importer les modules nécessaires
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Verrou simple pour concurrence (par utilisateur)
const activeCommands = new Set();

module.exports = {
    // Définir la commande
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Lister toutes les commandes du bot (sauf role-*) avec leurs permissions'),

    // Exécuter la commande
    async execute(interaction) {
        // Créer clé unique pour verrou
        const commandKey = `${interaction.user.id}-${interaction.commandName}`;
        console.log(`[Commands] Commande exécutée par ${interaction.user.tag} dans ${interaction.guild.name} (ID: ${interaction.guild.id})`);

        // Vérifier concurrence tôt
        if (activeCommands.has(commandKey)) {
            console.log(`[Commands] Ignoré : ${commandKey} déjà en cours`);
            return;
        }
        if (interaction.deferred || interaction.replied) {
            console.log('[Commands] Interaction déjà traitée, ignorée');
            return;
        }

        // Ajouter au verrou
        activeCommands.add(commandKey);

        try {
            // Différer la réponse rapidement
            console.log('[Commands] Différer la réponse');
            await interaction.deferReply();

            // Récupérer toutes les commandes
            console.log('[Commands] Récupération des commandes depuis client.commands');
            const commands = interaction.client.commands;
            if (!commands || commands.size === 0) {
                console.warn('[Commands] Aucune commande trouvée dans client.commands');
                await interaction.editReply({
                    content: 'Erreur : Aucune commande disponible.',
                    ephemeral: true
                });
                return;
            }

            // Créer un tableau d’embeds
            console.log(`[Commands] Préparation des embeds pour ${commands.size} commandes`);
            const embeds = [];
            let currentEmbed = new EmbedBuilder()
                .setTitle('Liste des commandes du bot')
                .setDescription('Voici toutes les commandes disponibles (sauf role-*) avec leurs permissions et restrictions.')
                .setColor('#00FFAA')
                .setTimestamp();
            let commandCount = 0;
            let currentEmbedSize = 30 + 60; // Titre (~30) + description (~60)

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
                // Loguer chaque commande
                console.log(`[Commands] Traitement de la commande ${command.data?.name || 'inconnue'}`);

                // Valider commande tôt
                if (!command.data || typeof command.data.name !== 'string' || !command.data.name) {
                    console.warn(`[Commands] Commande ignorée : nom invalide ou manquant (${JSON.stringify(command.data)})`);
                    continue;
                }
                if (typeof command.data.description !== 'string' || !command.data.description) {
                    console.warn(`[Commands] Commande ${command.data.name} ignorée : description invalide ou manquante`);
                    continue;
                }

                // Exclure les commandes role-*
                if (command.data.name.startsWith('role-')) {
                    console.log(`[Commands] Commande ${command.data.name} exclue (role-*)`);
                    continue;
                }

                // Mapper permissions avec sécurité
                let permissions = 'Inconnu';
                try {
                    const permValue = command.data.default_member_permissions
                        ? String(command.data.default_member_permissions)
                        : '0';
                    permissions = permissionMap[permValue] || `Permissions spécifiques (${permValue})`;
                } catch (err) {
                    console.warn(`[Commands] Erreur permissions ${command.data.name} : ${err.message}`);
                    permissions = 'Erreur lors du calcul';
                }

                // Vérifier restrictions (ex. rôles)
                let restrictions = 'Aucune';
                try {
                    const roleOptions = command.data.options?.filter(opt => opt.type === 8) || []; // 8 = Role
                    if (roleOptions.length > 0) {
                        restrictions = 'Requiert des rôles spécifiques';
                    }
                } catch (err) {
                    console.warn(`[Commands] Erreur restrictions ${command.data.name} : ${err.message}`);
                    restrictions = 'Erreur lors du calcul';
                }

                // Créer champ avec validation stricte
                const field = {
                    name: `/${command.data.name}`,
                    value: `**Description** : ${command.data.description}\n**Permissions** : ${permissions}\n**Restrictions** : ${restrictions}`,
                    inline: false
                };

                // Vérifier type et taille
                if (typeof field.name !== 'string' || typeof field.value !== 'string') {
                    console.warn(`[Commands] Commande ${command.data.name} rejetée : type champ invalide (name: ${typeof field.name}, value: ${typeof field.value})`);
                    continue;
                }
                if (field.name.length > 256 || field.value.length > 1024) {
                    console.warn(`[Commands] Commande ${command.data.name} rejetée : champ trop long (nom: ${field.name.length}, valeur: ${field.value.length})`);
                    continue;
                }

                // Estimer taille du champ
                const fieldSize = field.name.length + field.value.length;
                console.log(`[Commands] Champ préparé pour ${command.data.name} (taille: ${fieldSize})`);

                // Vérifier taille embed
                if (currentEmbedSize + fieldSize + 50 > 5500) {
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
                await interaction.editReply({
                    content: 'Erreur : Aucune commande valide à lister.',
                    ephemeral: true
                });
                return;
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
            try {
                await interaction.editReply({
                    content: 'Erreur lors de la récupération des commandes.',
                    ephemeral: true
                });
            } catch (err) {
                console.error('[Commands] Erreur lors de editReply :', err.stack);
            }
        } finally {
            // Retirer le verrou
            activeCommands.delete(commandKey);
            console.log(`[Commands] Verrou libéré pour ${commandKey}`);
        }
    }
};