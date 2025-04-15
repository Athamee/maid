// Importer les modules nécessaires
const { PermissionFlagsBits } = require('discord.js');

// Exporter l'événement ready
module.exports = {
    // Nom de l'événement
    name: 'ready',
    // Indiquer que cet événement ne s’exécute qu’une fois
    once: true,

    // Fonction exécutée au démarrage du bot
    async execute(client) {
        console.log('[Ready] Bot démarré, synchronisation des rôles de boosters');

        // Récupérer l’ID du rôle booster depuis .env
        const boosterRoleId = process.env.BOOSTER_ROLE_ID;
        if (!boosterRoleId) {
            console.error('[Ready] Erreur : BOOSTER_ROLE_ID non défini dans .env');
            return;
        }

        // Parcourir tous les serveurs où le bot est présent
        for (const guild of client.guilds.cache.values()) {
            console.log(`[Ready] Synchronisation pour ${guild.name} (ID: ${guild.id})`);

            // Vérifier si le rôle existe
            const boosterRole = guild.roles.cache.get(boosterRoleId);
            if (!boosterRole) {
                console.error(`[Ready] Erreur : Rôle ${boosterRoleId} introuvable dans ${guild.name}`);
                continue;
            }

            // Vérifier les permissions du bot
            const botMember = guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                console.error(`[Ready] Erreur : Le bot manque la permission ManageRoles dans ${guild.name}`);
                continue;
            }
            if (boosterRole.position >= botMember.roles.highest.position) {
                console.error(`[Ready] Erreur : Le rôle ${boosterRole.name} est trop haut pour le bot dans ${guild.name}`);
                continue;
            }

            try {
                // Récupérer tous les membres (peut nécessiter fetch si le cache est incomplet)
                await guild.members.fetch();
                console.log(`[Ready] Membres récupérés pour ${guild.name}`);

                // Parcourir les membres
                for (const member of guild.members.cache.values()) {
                    const isBooster = member.premiumSince !== null;
                    const hasBoosterRole = member.roles.cache.has(boosterRoleId);

                    try {
                        if (isBooster && !hasBoosterRole) {
                            // Booster sans le rôle : ajouter
                            await member.roles.add(boosterRole);
                            console.log(`[Ready] Rôle ${boosterRole.name} ajouté à ${member.user.tag} (booster)`);
                        } else if (!isBooster && hasBoosterRole) {
                            // Non-booster avec le rôle : retirer
                            await member.roles.remove(boosterRole);
                            console.log(`[Ready] Rôle ${boosterRole.name} retiré de ${member.user.tag} (non-booster)`);
                        }
                    } catch (error) {
                        console.error(`[Ready] Erreur pour ${member.user.tag} dans ${guild.name} :`, error.stack);
                    }
                }
                console.log(`[Ready] Synchronisation terminée pour ${guild.name}`);
            } catch (error) {
                console.error(`[Ready] Erreur lors de la synchronisation pour ${guild.name} :`, error.stack);
            }
        }
        console.log('[Ready] Synchronisation des rôles de boosters terminée');
    }
};