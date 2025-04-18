const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const roleId = process.env.ARRIVANT_ROLE_ID;
            const role = member.guild.roles.cache.get(roleId);

            if (!role) {
                console.error(`Erreur : Le rôle ARRIVANT_ROLE_ID (${roleId}) est introuvable.`);
                return;
            }

            console.log(`Ajout du rôle Arrivant (${role.name}, ${roleId}) à ${member.user.tag} (${member.id})`);
            await member.roles.add(role);
        } catch (error) {
            console.error(`Erreur lors de l'attribution du rôle Arrivant à ${member.user.tag} (${member.id}) :`, error.message, error.stack);
        }
    },
};