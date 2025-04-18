module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        console.log(`Interaction reçue : ${interaction.type}, commande : ${interaction.commandName || interaction.customId || 'aucune'}, utilisateur : ${interaction.user.tag}`);

        // Vérifier si client.commands est initialisé
        if (!interaction.client.commands) {
            console.error('Erreur : client.commands est undefined !');
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: 'Erreur interne : commandes non chargées !', ephemeral: true });
                } catch (error) {
                    console.error('Erreur lors de reply pour commands undefined :', error.message);
                }
            }
            return;
        }

        try {
            // Gérer les commandes slash
            if (interaction.isCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`Commande inconnue : ${interaction.commandName}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: `Commande inconnue : ${interaction.commandName}`, ephemeral: true });
                    }
                    return;
                }
                console.log(`Exécution de la commande : ${interaction.commandName}`);
                await command.execute(interaction);
            }

            // Gérer les boutons
            else if (interaction.isButton()) {
                console.log(`Bouton cliqué : ${interaction.customId}`);

                // Liste des commandes avec gestionnaires de boutons
                const buttonHandlers = {
                    'accept_reglement': { commandName: 'reglement', handler: 'handleButtonInteraction' },
                    'ticket_type_6': { commandName: 'ticket', handler: 'handleButtonInteraction' },
                    'close_ticket': { commandName: 'ticket', handler: 'handleCloseTicket' },
                    // Boutons pour /clear (ajouté pour gérer confirm/cancel)
                    'confirm': { commandName: 'clear', handler: 'handleButtonInteraction' },
                    'cancel': { commandName: 'clear', handler: 'handleButtonInteraction' },
                    // Ajout des préfixes pour les boutons de rôles (14/04/2025) pour gérer les interactions des commandes de rôles
                    'age_': { commandName: 'role-age', handler: 'handleButtonInteraction' },
                    'connaissance-bdsm_': { commandName: 'role-connaissance-bdsm', handler: 'handleButtonInteraction' },
                    'bdsm_': { commandName: 'role-dynamique-bdsm', handler: 'handleButtonInteraction' }, // Gère aussi role-situation-bdsm (même préfixe et logique identique)
                    'event_': { commandName: 'role-evenement', handler: 'handleButtonInteraction' },
                    'experience-bdsm_': { commandName: 'role-experience-bdsm', handler: 'handleButtonInteraction' },
                    'experience-vanille_': { commandName: 'role-experience-vanille', handler: 'handleButtonInteraction' },
                    'genre_': { commandName: 'role-genre', handler: 'handleButtonInteraction' },
                    'membre_': { commandName: 'role-membre', handler: 'handleButtonInteraction' },
                    'dm_': { commandName: 'role-message-prive', handler: 'handleButtonInteraction' },
                    'orientation_': { commandName: 'role-orientation', handler: 'handleButtonInteraction' },
                    'pronom_': { commandName: 'role-pronom', handler: 'handleButtonInteraction' },
                    'relation_': { commandName: 'role-situation-relationnelle', handler: 'handleButtonInteraction' },
                };

                // Vérifier si le customId commence par un préfixe connu (pour gérer les customId dynamiques comme bdsm_<roleId>_<index>)
                const buttonInfo = Object.entries(buttonHandlers).find(([key]) => interaction.customId === key || interaction.customId.startsWith(key))?.[1];
                if (buttonInfo) {
                    const command = interaction.client.commands.get(buttonInfo.commandName);
                    if (command && command[buttonInfo.handler]) {
                        console.log(`Bouton ${interaction.customId} géré par ${buttonInfo.commandName}.${buttonInfo.handler}`);
                        await command[buttonInfo.handler](interaction, interaction.customId);
                    } else {
                        console.warn(`Commande ${buttonInfo.commandName} ou gestionnaire ${buttonInfo.handler} introuvable`);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: 'Erreur : gestionnaire de bouton introuvable !', ephemeral: true });
                        }
                    }
                } else {
                    console.warn(`Bouton inconnu : ${interaction.customId}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Action non reconnue !', ephemeral: true });
                    }
                }
            }

            // Gérer les menus déroulants
            else if (interaction.isStringSelectMenu()) {
                console.log(`Menu déroulant cliqué : ${interaction.customId}`);
                const command = interaction.client.commands.get('ticket-menu');
                if (!command) {
                    console.warn('Commande ticket-menu introuvable pour les menus !');
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Erreur : commande ticket-menu introuvable !', ephemeral: true });
                    }
                    return;
                }
                if (interaction.customId === 'select_ticket' && command.handleMenuInteraction) {
                    console.log(`Menu select_ticket cliqué par ${interaction.user.tag}`);
                    await command.handleMenuInteraction(interaction);
                } else {
                    console.warn(`Menu inconnu : ${interaction.customId}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Action non reconnue !', ephemeral: true });
                    }
                }
            }
        } catch (error) {
            console.error(`Erreur globale dans interactionCreate : ${interaction.customId || interaction.commandName || 'inconnu'} :`, error.message, error.stack);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: 'Erreur lors du traitement de l’interaction !', ephemeral: true });
                } catch (replyError) {
                    console.error('Erreur lors de reply global :', replyError.message);
                }
            }
        }
    },
};