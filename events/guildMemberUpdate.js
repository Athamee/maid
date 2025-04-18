// Importer les modules nécessaires
const { PermissionFlagsBits } = require('discord.js');

// Exporter l'événement guildMemberUpdate
module.exports = {
    // Nom de l'événement
    name: 'guildMemberUpdate',

    // Fonction exécutée quand les données d’un membre changent (ex. boost)
    async execute(oldMember, newMember) {
        console.log(`[GuildMemberUpdate] Mise à jour pour ${newMember.user.tag} (ID: ${newMember.id}) dans ${newMember.guild.name}`);

        // Récupérer l’ID du rôle booster depuis .env
        const boosterRoleId = process.env.BOOSTER_ROLE_ID;
        if (!boosterRoleId) {
            console.error('[GuildMemberUpdate] Erreur : BOOSTER_ROLE_ID non défini dans .env');
            return;
        }

        // Vérifier si le rôle existe
        const boosterRole = newMember.guild.roles.cache.get(boosterRoleId);
        if (!boosterRole) {
            console.error(`[GuildMemberUpdate] Erreur : Rôle ${boosterRoleId} introuvable`);
            return;
        }

        // Vérifier les permissions du bot
        const botMember = newMember.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            console.error('[GuildMemberUpdate] Erreur : Le bot manque la permission ManageRoles');
            return;
        }
        if (boosterRole.position >= botMember.roles.highest.position) {
            console.error(`[GuildMemberUpdate] Erreur : Le rôle ${boosterRole.name} est trop haut pour le bot`);
            return;
        }

        try {
            // Vérifier si le statut de boost a changé
            const wasBooster = oldMember.premiumSince !== null;
            const isBooster = newMember.premiumSince !== null;

            if (!wasBooster && isBooster) {
                // Nouveau booster : ajouter le rôle
                await newMember.roles.add(boosterRole);
                console.log(`[GuildMemberUpdate] Rôle ${boosterRole.name} ajouté à ${newMember.user.tag} (nouveau booster)`);
            } else if (wasBooster && !isBooster) {
                // Plus booster : retirer le rôle
                await newMember.roles.remove(boosterRole);
                console.log(`[GuildMemberUpdate] Rôle ${boosterRole.name} retiré de ${newMember.user.tag} (plus booster)`);
            } else {
                console.log(`[GuildMemberUpdate] Pas de changement de boost pour ${newMember.user.tag}`);
            }
        } catch (error) {
            console.error(`[GuildMemberUpdate] Erreur pour ${newMember.user.tag} :`, error.stack);
        }
    }
};