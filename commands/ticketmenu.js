// Importation des modules nécessaires depuis discord.js
const { 
    SlashCommandBuilder,        // Pour construire la commande Slash
    PermissionFlagsBits,        // Pour gérer les permissions
    ActionRowBuilder,           // Pour créer une rangée de composants interactifs
    StringSelectMenuBuilder,    // Pour créer un menu déroulant
    AttachmentBuilder,          // Pour gérer les pièces jointes (images)
    EmbedBuilder                // Pour créer des messages embed stylisés
} = require('discord.js');

// Importation du module path pour gérer les chemins de fichiers
const path = require('path');

// Importation des fonctions utilitaires pour créer et fermer les tickets
const { createTicketChannel, closeTicketChannel } = require('../utils/ticketUtils');

module.exports = {
    // Définition de la commande Slash avec SlashCommandBuilder
    data: new SlashCommandBuilder()
        .setName('ticket-menu')                          // Nom de la commande : /ticket-menu
        .setDescription('Créer un menu déroulant pour ouvrir un ticket (admins uniquement)') // Description visible dans Discord
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Réservé aux administrateurs

    // Fonction principale pour exécuter la commande /ticket-menu
    async execute(interaction) {
        try {
            // Diffère la réponse pour éviter un timeout (éphemeral = visible uniquement par l'utilisateur)
            await interaction.deferReply({ ephemeral: true });

            // Création du menu déroulant pour choisir le type de ticket
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_ticket')            // Identifiant unique pour le menu
                .setPlaceholder('Sélectionne le type de ticket') // Texte par défaut dans le menu
                .addOptions([                            // Options du menu avec étiquettes et valeurs
                    { label: '🔞🔗 Certification', description: ' ', value: 'Certification' },
                    { label: '📜📝🔗 Accès MP', description: ' ', value: 'MP' },
                    { label: '🪞🔗 Accès galerie des membres', description: ' ', value: 'galerie' },
                    { label: '⛓🗝🔗 Accès salles de tortures', description: ' ', value: 'tortures' },
                    { label: '⁉️🔗 Problèmes/questions', description: ' ', value: 'Problèmes' },
                    { label: '🫱🏽‍🫲🏼🔗 Partenariat', description: ' ', value: 'Partenariat' },
                    { label: '📮🔗 Suggestions', description: ' ', value: 'Suggestions' },
                    { label: '🥰🔗 Recrutement', description: ' ', value: 'Recrutement' },
                ]);

            // Chemin vers l’image à envoyer avec le menu
            const imagePath = path.join(__dirname, '../img/ticket_membre.png');
            // Création de la pièce jointe pour l’image
            const attachment = new AttachmentBuilder(imagePath).setName('ticket_image.png');

            // Création d’une rangée de composants contenant le menu déroulant
            const row = new ActionRowBuilder().addComponents(selectMenu);

            // Envoi du message avec le menu et l’image dans le canal
            await interaction.channel.send({
                components: [row],       // Ajoute le menu déroulant
                files: [attachment],     // Ajoute l’image
            });

            // Réponse à l’utilisateur pour confirmer l’envoi (visible uniquement par lui)
            await interaction.editReply({
                content: 'Le menu pour ouvrir un ticket a été envoyé avec succès.',
                ephemeral: true
            });
        } catch (error) {
            // Gestion des erreurs lors de l’exécution
            console.error('Erreur lors de l’exécution de /ticket-menu :', error.stack);
            if (!interaction.replied) {
                await interaction.editReply({
                    content: 'Une erreur est survenue lors de l’envoi du menu.',
                    ephemeral: true
                });
            }
        }
    },

    // Fonction pour gérer les interactions avec le menu déroulant
    async handleMenuInteraction(interaction) {
        // Vérifie si l’interaction concerne notre menu (customId: 'select_ticket')
        if (interaction.customId !== 'select_ticket') return;

        // Récupération des informations sur l’utilisateur et le serveur
        const member = interaction.member;
        const guild = interaction.guild;
        const selectedType = interaction.values[0]; // Type de ticket sélectionné

        // Messages personnalisés pour chaque type de ticket
        const customMessages = {
            'Certification': `## Bienvenue pour ta certification.\nUn membre du Staff va venir dès que possible pour la réaliser.\n\n*La certification te permettra d'avoir un accès plus large au serveur, mais aussi d'accéder aux contenus NSFW du serveur.*\n\n### Pour te faire certifier, tu as deux possibilités :\n\n> * Nous avons besoin d'une photo d'un document sur lequel on peut voir ta photo et ta date de naissance, et un selfie. Cela nous permettra de faire la vérification.\n\n> * Tu peux aussi faire la vérification via un voc (avec cam).\n\n> *Aucune information ne sera conservée.*`,
            'MP': `## Bienvenue pour ta demande d'accès à la correspondance privée.\n\n> * **Nous te rappelons que toutes les demandes doivent passer par le canal Demande de correspondance**\n> *Tout MP sauvage entraînera des sanctions.*\n\n### Nous comptons sur toi pour respecter le consentement des membres. :smiling_imp: `,
            'galerie': `## Bienvenue pour ta demande d'accès à la galerie des membres.\n\n> * **Tu pourras, avec cet accès, découvrir la tête de nos membres et nous montrer la tienne.**\n> *Aucune image NSFW ne sera tolérée dans ce canal !*\n\n> * **Par ailleurs tu auras aussi accès au répertoire des salles de tortures qui existent déjà.**\n> *Tu pourras en demander l'accès aux membres qui possèdent une salle privée uniquement dans le post de leur salon qui se trouve dans ce répertoire.*\n\n### Nous comptons sur toi pour respecter *tous* les membres. :smiling_imp: `,
            'tortures': `## Bienvenue pour ta demande d'accès aux salles des tortures.\n\n> * **Tu vas pouvoir faire la demande d'une salle de torture privative.**\n> *Attention, tu pourras gérer qui aura accès ou pas à ta salle privée. Cependant les membres non certifiés et ceux n'ayant pas l'accès à la galerie des membres n'ont pas de droits d'accès à ta salle personnelle. Si cela devait arriver, les sanctions seraient sans appel. À toi de faire les choses dans les règles pour jouir de ta salle personnelle.*\n> *Tout contenu illégal, voir <#1337753374858416230>, est proscrit et sera passible d'un bannissement sans discussion. En cas de doute, posez-nous la question via <#1159895752076689492> (Problèmes/questions).*\n\n> * **Tu peux réclamer un rôle perso avec une couleur perso.**\n> *La couleur doit nous être donnée au format #000000.*\n\n### Nous comptons sur toi pour respecter les membres tout en continuant à partager sur ce sujet qui nous passionne. :smiling_imp: `,
            'Problèmes': `## Bienvenue à toi !\n\n> * **Si tu as une question, nous ferons de notre mieux pour aider en cela.**\n> *N'oublie pas de rester courtois et respectueux. Le Staff fait de son mieux, et nous avons tous une vie en dehors de Discord. Nous tenterons toutefois de te répondre aussi vite et clairement que possible.*\n\n> * **Si tu viens pour un problème, nous étudierons le cas avec attention avant de statuer.**\n> *Nous t'invitons à décrire ton problème avec les informations nécessaires (screen si besoin). Nous serons peut-être amenés à te demander des précisions, si besoin.*\n> *Nous serons impartiaux et prendrons les mesures nécessaires le cas échéant.*\n> *Dans tous les cas, on reste zen et on respire, avec la communication on peut résoudre beaucoup de problèmes.^^*`,
            'Partenariat': `## Bonjour à toi membre estimé d'un autre serveur !\n\n> * **Tu souhaites nous rejoindre dans le but de faire un partenariat ? Nous allons avoir besoin des informations suivantes :**\n> *Le nom du serveur partenaire pour lequel tu fais cette démarche*\n> *↳*\n> *Ta place dans ledit serveur, afin que nous puissions comprendre ta latitude d'action.*\n> *↳*\n> *Le lien d'invitation de ce serveur.*\n> *↳*\n> *La raison pour laquelle tu souhaites ce partenariat avec nous.*\n> *↳*`,
            'Suggestions': `## Quel plaisir de te voir ici !\n\n> * **Tu souhaites nous soumettre une idée ?**\n> *Nous t'invitons à exposer ton idée de façon précise et claire afin que nous puissions l'étudier aussi concrètement que possible.*`,
            'Recrutement': `## Tu cherches à rejoindre le Staff ?\n\n> * **Nous allons avoir besoin de quelques informations.**\n> *Est-ce que ta candidature fait suite à une annonce du serveur (si c’est le cas, saute la question suivante et passe de suite à la troisième) ?*\n> *↳*\n> *Pour quel poste candidates-tu ?*\n> *↳*\n> *Quelles sont tes qualités pour le poste en question ?*\n> *↳*\n> *Pourquoi te choisir toi plutôt qu’une autre personne ?*\n> *↳*`,
        };

        // Sélection du message personnalisé ou message par défaut si le type est inconnu
        const customMessage = customMessages[selectedType] || 'Un message par défaut si le type n’existe pas';

        // Création d’un embed pour afficher le message personnalisé
        const embed = new EmbedBuilder()
            .setTitle(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`) // Titre avec la première lettre en majuscule
            .setDescription(customMessage) // Message personnalisé
            .setColor('#FFAA00'); // Couleur orange

        // Contenu initial avec mention de l’utilisateur qui ouvre le ticket
        let content = `<@${member.id}>`;

        // Ajout d’une mention de rôle selon le type de ticket
        if (selectedType === 'Partenariat') {
            content += ', <@&1340401306971672626>'; // Rôle spécifique pour Partenariat
        } else {
            content += ', <@&1094318706487734483>'; // Rôle par défaut pour les autres tickets
        }

        try {
            // Diffère la mise à jour de l’interaction pour éviter un timeout
            await interaction.deferUpdate();

            // Création du canal de ticket avec les informations fournies
            await createTicketChannel(interaction.client, guild, member, selectedType, { content, embeds: [embed] });

            // Confirmation à l’utilisateur (non utilisée ici car deferUpdate est suffisant, mais conservée pour cohérence)
            // await interaction.editReply({ content: 'Ticket créé avec succès.', ephemeral: true });
        } catch (error) {
            // Gestion des erreurs lors de la création du ticket
            console.error(`Erreur lors de la création du ticket (${selectedType}) :`, error.stack);
            await interaction.editReply({ content: 'Une erreur est survenue lors de la création du ticket.', ephemeral: true });
        }
    },

    // Fonction pour gérer la fermeture d’un ticket
    async handleCloseTicket(interaction) {
        const member = interaction.member;

        // Vérification des permissions : admin ou rôle modérateur
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        const modoRoleIds = process.env.MODO ? process.env.MODO.split(',').map(id => id.trim()) : [];
        const hasModoRole = modoRoleIds.some(roleId => member.roles.cache.has(roleId));

        // Si l’utilisateur n’est ni admin ni modérateur, on refuse
        if (!isAdmin && !hasModoRole) {
            return interaction.reply({
                content: "Vous n'avez pas la permission de fermer ce ticket.",
                ephemeral: true
            });
        }

        try {
            const channel = interaction.channel;
            // Fermeture du canal avec un message indiquant qui a fermé le ticket
            await closeTicketChannel(channel, `Ticket fermé par ${member.user.tag}`);
        } catch (error) {
            // Gestion des erreurs lors de la fermeture
            console.error('Erreur lors de la fermeture du ticket :', error.stack);
            await interaction.reply({
                content: "Une erreur est survenue lors de la fermeture du ticket.",
                ephemeral: true
            });
        }
    }
};