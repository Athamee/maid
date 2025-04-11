const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

// Fonction pour générer une image de bienvenue avec l’avatar du membre
async function generateWelcomeImage(member, roleName) {
    console.log(`[Génération Image] Début pour ${member.user.tag} (ID: ${member.id}) - Rôle: ${roleName}`);

    // Chemin de l’image de fond basé sur le nom du rôle
    let backgroundPath = path.join(__dirname, `../img/${roleName}.png`);
    if (!fs.existsSync(backgroundPath)) {
        console.warn(`[Génération Image] Image introuvable pour ${roleName} : ${backgroundPath}. Utilisation de l’image par défaut.`);
        backgroundPath = path.join(__dirname, '../img/default.png'); // Image par défaut locale
    }

    try {
        const background = await loadImage(backgroundPath);
        const avatarURL = member.user.displayAvatarURL({ format: 'png', size: 1024 }).replace('webp', 'png');
        const avatar = await loadImage(avatarURL);

        // Création d’un canvas 1024x1024
        const canvas = createCanvas(1024, 1024);
        const ctx = canvas.getContext('2d');

        // Dessiner l’image de fond
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Si le rôle est 'roleadd', dessiner l’avatar en cercle
        if (roleName === 'roleadd') {
            const avatarSize = 282;
            const x = (canvas.width - avatarSize) / 1.96;
            const y = (canvas.height - avatarSize) / 3.37;

            ctx.save();
            ctx.beginPath();
            ctx.arc(x + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, x, y, avatarSize, avatarSize);
            ctx.restore();
        }

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
        console.log('[Génération Image] Image générée avec succès.');
        return attachment;
    } catch (error) {
        console.error('[Génération Image] Erreur lors de la génération :', error.stack);
        return null;
    }
}

module.exports = {
    // Définition de la commande Slash
    data: new SlashCommandBuilder()
        .setName('admit')
        .setDescription('Donner un rôle à un membre et envoyer un message de bienvenue')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à qui attribuer un rôle')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Le rôle à attribuer')
                .setRequired(true)
                .addChoices(
                    { name: 'Tampon', value: 'roleadd' },
                    { name: 'Certifié', value: 'roleadd2' },
                    { name: 'DM', value: 'roleadd3' },
                    { name: 'Galerie', value: 'roleadd4' },
                    { name: 'Torture', value: 'roleadd5' }
                )),

    // Fonction principale d’exécution
    async execute(interaction) {
        console.log(`[Commande /admit] Exécutée par ${interaction.user.tag} (ID: ${interaction.user.id})`);

        // Vérification des permissions : admin ou rôle modo
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = interaction.member.roles.cache.has(process.env.MODO);
        if (!isAdmin && !hasModoRole) {
            console.log(`[Permission refusée] ${interaction.user.tag} n’a pas les droits nécessaires`);
            return interaction.reply({
                content: 'Permission refusée : réservée aux administrateurs ou modérateurs.',
                ephemeral: true
            });
        }

        // Différer la réponse pour éviter un timeout (visible par tous)
        await interaction.deferReply();

        const targetMember = interaction.options.getMember('membre');
        const selectedRole = interaction.options.getString('role');

        // Vérifier si le membre existe
        if (!targetMember) {
            console.log('[Erreur] Membre introuvable');
            return interaction.editReply({ content: 'Membre introuvable.' });
        }

        console.log(`[Commande /admit] Cible : ${targetMember.user.tag} (ID: ${targetMember.id}), Rôle : ${selectedRole}`);

        // Configuration des rôles, canaux et messages personnalisés avec les nouveaux noms
        const rolesMap = {
            'roleadd': process.env.TAMPON_ROLE_ID,
            'roleadd2': process.env.CERTIFIE_ROLE_ID,
            'roleadd3': process.env.DM_ROLE_ID,
            'roleadd4': process.env.GALERIE_ROLE_ID,
            'roleadd5': process.env.TORTURE_ROLE_ID,
        };

        const channelMap = {
            'roleadd': process.env.ENTREEE_SORTIE_CHANNEL_ID,
            'roleadd2': process.env.SALLE_ELEVATION_CHANNEL_ID,
            'roleadd3': process.env.SALLE_ELEVATION_CHANNEL_ID,
            'roleadd4': process.env.SALLE_ELEVATION_CHANNEL_ID,
            'roleadd5': process.env.SALLE_ELEVATION_CHANNEL_ID,
        };

        const welcomeMessageMap = {
            'roleadd': `**Bienvenue** <@${targetMember.id}> !`,
            'roleadd2': `**Félicitations pour ton rôle de Certifié**, <@${targetMember.id}> !`,
            'roleadd3': `**Bienvenue au rôle DM**, <@${targetMember.id}> !`,
            'roleadd4': `**Tu as atteint le rôle Galerie**, <@${targetMember.id}> !`,
            'roleadd5': `**Tu as atteint le rôle Torture**, <@${targetMember.id}> !`,
        };

        const roleToAddId = rolesMap[selectedRole];
        const roleToRemoveId = process.env.REGLEMENT_ACCEPTED_ROLE_ID; // Retiré uniquement pour 'roleadd'
        const channelId = channelMap[selectedRole];

        try {
            // Récupérer les objets rôle et canal
            const roleToAdd = interaction.guild.roles.cache.get(roleToAddId);
            const roleToRemove = roleToRemoveId ? interaction.guild.roles.cache.get(roleToRemoveId) : null;
            const channel = interaction.guild.channels.cache.get(channelId);

            // Vérifier si tout est valide
            if (!roleToAdd || !channel) {
                console.error(`[Erreur] Rôle (${roleToAddId}) ou canal (${channelId}) introuvable`);
                return interaction.editReply({ content: 'Rôle ou canal introuvable.' });
            }

            // Gestion des rôles
            if (selectedRole === 'roleadd' && roleToRemove) {
                await targetMember.roles.add(roleToAdd);
                await targetMember.roles.remove(roleToRemove);
                console.log(`[Rôles] ${roleToAdd.name} ajouté, ${roleToRemove.name} retiré pour ${targetMember.user.tag}`);
            } else {
                await targetMember.roles.add(roleToAdd);
                console.log(`[Rôles] ${roleToAdd.name} ajouté à ${targetMember.user.tag}`);
            }

            // Générer et envoyer le message de bienvenue avec image
            const welcomeMessage = welcomeMessageMap[selectedRole];
            const attachment = await generateWelcomeImage(targetMember, selectedRole);

            if (attachment) {
                await channel.send({ content: welcomeMessage, files: [attachment] });
                console.log(`[Message] Bienvenue envoyé dans ${channel.name} avec image pour ${targetMember.user.tag}`);
            } else {
                await channel.send({ content: welcomeMessage });
                console.log(`[Message] Bienvenue envoyé dans ${channel.name} sans image pour ${targetMember.user.tag}`);
            }

            // Préparer la réponse avec un embed
            const replyEmbed = new EmbedBuilder()
                .setColor('#00FFAA')
                .setTimestamp()
                .setFooter({ text: `Exécuté par ${interaction.user.tag}` });

            // Message personnalisé selon le rôle
            switch (selectedRole) {
                case 'roleadd':
                    replyEmbed.setDescription(`Bienvenue ${targetMember} ! Tu peux désormais prendre tes <#1159894126607740968>. N'oublie pas le rôle membre !`);
                    break;
                case 'roleadd2':
                    replyEmbed.setDescription(`${targetMember} **est désormais certifié.e !**`);
                    break;
                case 'roleadd3':
                    replyEmbed.setDescription(`${targetMember} **a désormais accès à <#1284932254987976836> !**`);
                    break;
                case 'roleadd4':
                    replyEmbed.setDescription(`${targetMember} **a désormais accès à <#1160842845960273961> !**`);
                    break;
                case 'roleadd5':
                    replyEmbed.setDescription(`${targetMember} **est arrivé.e aux portes des ⛓🗝🔗 Salles de tortures. Faites chauffer vos outils pour l'accueillir !**`);
                    break;
            }

            // Envoyer la réponse
            await interaction.editReply({ embeds: [replyEmbed] });
            console.log(`[Commande /admit] Réponse envoyée pour ${targetMember.user.tag}`);
        } catch (error) {
            console.error(`[Erreur] Dans /admit pour ${targetMember.user.tag} :`, error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’exécution de la commande.' });
        }
    }
};