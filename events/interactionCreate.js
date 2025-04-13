module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
      if (interaction.isCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          console.warn(`Commande inconnue : ${interaction.commandName}`);
          return;
        }
        try {
          console.log(`Commande exécutée : ${interaction.commandName} par ${interaction.user.tag}`);
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
        const command = interaction.client.commands.get('ticket');
        if (command) {
          try {
            if (interaction.customId === 'ticket_type_6' && command.handleButtonInteraction) {
              console.log(`Bouton ticket_type_6 cliqué par ${interaction.user.tag}`);
              await command.handleButtonInteraction(interaction);
            } else if (interaction.customId === 'close_ticket' && command.handleCloseTicket) {
              console.log(`Bouton close_ticket cliqué par ${interaction.user.tag}`);
              await command.handleCloseTicket(interaction);
            }
          } catch (error) {
            console.error(`Erreur dans la gestion du bouton ${interaction.customId} :`, error.message, error.stack);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: 'Erreur lors du traitement du bouton !', ephemeral: true });
            }
          }
        }
      }
    },
  };