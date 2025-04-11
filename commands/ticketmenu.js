const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    AttachmentBuilder, 
    EmbedBuilder 
} = require('discord.js');
const path = require('path');
const { createTicketChannel } = require('../utils/ticketUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-menu')
        .setDescription('Créer un menu déroulant pour ouvrir un ticket (admins uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            console.log(`Début de /ticket-menu par ${interaction.member.user.tag}`);
            await interaction.deferReply({ ephemeral: true });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_ticket')
                .setPlaceholder('Sélectionne le type de ticket')
                .addOptions([
                    { label: '🔞🔗 Certification', description: ' ', value: 'Certification' },
                    { label: '📜📝🔗 Accès MP', description: ' ', value: 'MP' },
                    { label: '🪞🔗 Accès galerie des membres', description: ' ', value: 'galerie' },
                    { label: '⛓🗝🔗 Accès salles de tortures', description: ' ', value: 'tortures' },
                    { label: '⁉️🔗 Problèmes/questions', description: ' ', value: 'Problèmes' },
                    { label: '🫱🏽‍🫲🏼🔗 Partenariat', description: ' ', value: 'Partenariat' },
                    { label: '📮🔗 Suggestions', description: ' ', value: 'Suggestions' },
                    { label: '🥰🔗 Recrutement', description: ' ', value: 'Recrutement' },
                ]);

            const imagePath = path.join(__dirname, '../img/ticket_membre.png');
            const attachment = new AttachmentBuilder(imagePath).setName('ticket_image.png');

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.channel.send({
                components: [row],
                files: [attachment],
            });

            await interaction.editReply({
                content: 'Le menu pour ouvrir un ticket a été envoyé avec succès.',
                ephemeral: true
            });
            console.log(`Menu envoyé dans ${interaction.channel.id}`);
        } catch (error) {
            console.error('Erreur dans execute de ticket-menu :', error.stack);
            if (!interaction.replied) {
                await interaction.editReply({
                    content: 'Erreur lors de l’envoi du menu.',
                    ephemeral: true
                });
            }
        }
    },

    async handleMenuInteraction(interaction) {
        if (interaction.customId !== 'select_ticket') return;

        const member = interaction.member;
        const guild = interaction.guild;
        const selectedType = interaction.values[0];

        console.log(`Interaction reçue pour ${member.user.tag} avec type ${selectedType}`);

        try {
            // Réponse immédiate à l’interaction pour éviter le timeout
            await interaction.reply({
                content: 'Création de votre ticket en cours...',
                ephemeral: true
            });

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

            const customMessage = customMessages[selectedType] || 'Un message par défaut si le type n’existe pas';

            const embed = new EmbedBuilder()
                .setTitle(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`)
                .setDescription(customMessage)
                .setColor('#FFAA00');

            let content = `<@${member.id}>`;
            if (selectedType === 'Partenariat') {
                content += ', <@&1340401306971672626>';
            } else {
                content += ', <@&1094318706487734483>';
            }

            // Création du ticket en arrière-plan
            await createTicketChannel(interaction.client, guild, member, selectedType, { content, embeds: [embed] });
            console.log(`Ticket créé pour ${member.user.tag} (Type: ${selectedType})`);

            // Mise à jour de la réponse initiale
            await interaction.editReply({
                content: 'Votre ticket a été créé avec succès.',
                ephemeral: true
            });
        } catch (error) {
            console.error(`Erreur lors de la création du ticket (${selectedType}) :`, error.stack);
            await interaction.editReply({
                content: 'Une erreur est survenue lors de la création de votre ticket.',
                ephemeral: true
            });
        }
    },

    async handleCloseTicket(interaction) {
        if (interaction.customId !== 'close_ticket') return;

        console.log(`Bouton close_ticket cliqué par ${interaction.member.user.tag}`);
        try {
            const member = interaction.member;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const modoRoleIds = process.env.MODO ? process.env.MODO.split(',').map(id => id.trim()) : [];
            const hasModoRole = modoRoleIds.some(roleId => member.roles.cache.has(roleId));

            if (!isAdmin && !hasModoRole) {
                console.warn(`[Permissions] ${member.user.tag} a essayé de fermer un ticket sans permission`);
                return interaction.reply({
                    content: 'Vous n\'avez pas la permission de fermer ce ticket.',
                    ephemeral: true
                });
            }

            const channel = interaction.channel;
            const { closeTicketChannel } = require('../utils/ticketUtils');
            await closeTicketChannel(channel, `Ticket fermé par ${member.user.tag}`);
            console.log(`Ticket ${channel.name} fermé par ${member.user.tag}`);
        } catch (error) {
            console.error('Erreur lors de la fermeture du ticket :', error.stack);
            await interaction.reply({
                content: 'Une erreur est survenue lors de la fermeture du ticket.',
                ephemeral: true
            });
        }
    }
};