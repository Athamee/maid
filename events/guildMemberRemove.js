// Importer le pool PostgreSQL depuis db.js
const pool = require('../db');

// Exporter l'événement guildMemberRemove
module.exports = {
    // Nom de l'événement
    name: 'guildMemberRemove',
    
    // Fonction exécutée quand un membre quitte le serveur (départ, ban, ou kick)
    async execute(member) {
        console.log(`[GuildMemberRemove] Membre ${member.user.tag} (ID: ${member.id}) a quitté ${member.guild.name} (ID: ${member.guild.id})`);

        // Récupérer user_id et guild_id
        const userId = member.id;
        const guildId = member.guild.id;

        // Utiliser une transaction pour supprimer les données dans toutes les tables
        const client = await pool.connect();
        try {
            // Démarrer la transaction
            await client.query('BEGIN');
            console.log(`[GuildMemberRemove] Début de la transaction pour ${userId}`);

            // Supprimer les données de la table xp
            await client.query(
                'DELETE FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            console.log(`[GuildMemberRemove] Données XP supprimées pour ${userId}`);

            // Supprimer les avertissements de la table warns
            await client.query(
                'DELETE FROM warns WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            console.log(`[GuildMemberRemove] Avertissements supprimés pour ${userId}`);

            // Supprimer les rôles retirés de la table warn_removed_roles
            await client.query(
                'DELETE FROM warn_removed_roles WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            console.log(`[GuildMemberRemove] Rôles retirés supprimés pour ${userId}`);

            // Supprimer les entrées de spam de la table spam_tracker
            await client.query(
                'DELETE FROM spam_tracker WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            console.log(`[GuildMemberRemove] Données de spam supprimées pour ${userId}`);

            // Valider la transaction
            await client.query('COMMIT');
            console.log(`[GuildMemberRemove] Transaction validée pour ${userId}`);
        } catch (error) {
            // Annuler la transaction en cas d’erreur
            await client.query('ROLLBACK');
            console.error(`[GuildMemberRemove] Erreur lors de la suppression pour ${userId} :`, error.stack);
        } finally {
            // Libérer le client
            client.release();
            console.log(`[GuildMemberRemove] Client libéré pour ${userId}`);
        }
    }
};