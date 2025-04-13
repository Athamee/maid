module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
      console.log(`Interaction reçue : ${interaction.type}, commande : ${interaction.commandName || interaction.customId || 'aucune'}, utilisateur : ${interaction.user.tag}`);
  
      // Vérifie si client.commands existe
      if (!interaction.client.commands) {
        console.error('Erreur : client.commands est undefined !');
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Erreur interne : commandes non chargées !', ephemeral: true });
        }
        return;
      }
  
      if (interaction.isCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          console.warn(`Commande inconnue : ${interaction.commandName}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `Commande inconnue : ${interaction.commandName}`, ephemeral: true });
          }
          return;
        }
        try {
          console.log(`Exécution de la commande : ${interaction.commandName}`);
          await command.execute(interaction);
        } catch (error) {
          console.error(`Erreur dans la commande ${interaction.commandName} :`, error.message, error.stack);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur lors de l’exécution de la commande !', ephemeral: true });
          } else if (interaction.deferred) {
            await interaction.editReply({ content: 'Erreur lors de l’exécution de la commande !' });
          }
        }
      }
  
      if (interaction.isButton()) {
        console.log(`Bouton cliqué : ${interaction.customId}`);
        const command = interaction.client.commands.get('ticket');
        if (!command) {
          console.warn('Commande ticket introuvable pour les boutons !');
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur : commande ticket introuvable !', ephemeral: true });
          }
          return;
        }
        try {
          if (interaction.customId === 'ticket_type_6' && command.handleButtonInteraction) {
            console.log(`Bouton ticket_type_6 cliqué par ${interaction.user.tag}`);
            await command.handleButtonInteraction(interaction);
          } else if (interaction.customId === 'close_ticket' && command.handleCloseTicket) {
            console.log(`Bouton close_ticket cliqué par ${interaction.user.tag}`);
            await command.handleCloseTicket(interaction);
          } else {
            console.warn(`Bouton inconnu : ${interaction.customId}`);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: 'Action non reconnue !', ephemeral: true });
            }
          }
        } catch (error) {
          console.error(`Erreur dans la gestion du bouton ${interaction.customId} :`, error.message, error.stack);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur lors du traitement du bouton !', ephemeral: true });
          }
        }
      }
    },
  };