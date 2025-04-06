const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Chemin vers le fichier JSON pour stocker les warns
const warnFile = path.join(__dirname, '../warns.json');

// Fonction pour lire les warns
async function getWarns() {
    try {
        const data = await fs.readFile(warnFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // Retourne un objet vide si le fichier n'existe pas encore
    }
}

// Fonction pour sauvegarder les warns
async function saveWarns(warns) {
    await fs.writeFile(warnFile, JSON.stringify(warns, null, 2), 'utf8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertit un membre du serveur.')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre à avertir')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('La raison de l’avertissement')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply(); // Diffère la réponse pour avoir plus de temps si besoin

        const member = interaction.options.getUser('membre');
        const reason = interaction.options.getString('raison');
        
        // Vérifie si le membre existe et peut être averti
        const target = await interaction.guild.members.fetch(member.id).catch(() => null);
        if (!target) {
            return interaction.editReply({ content: 'Ce membre n’est pas sur le serveur !' });
        }
        if (!target.moderatable) {
            return interaction.editReply({ content: 'Je ne peux pas avertir ce membre !' });
        }

        // Charge les warns existants
        let warns = await getWarns();
        const userId = member.id;
        
        // Ajoute ou met à jour le compteur de warns pour ce membre
        if (!warns[userId]) {
            warns[userId] = { count: 1, reasons: [reason] };
        } else {
            warns[userId].count += 1;
            warns[userId].reasons.push(reason);
        }

        // Sauvegarde les warns
        await saveWarns(warns);

        // Envoie un message privé clair au membre
        const warnMessage = `⚠️ **Avertissement reçu** sur ${interaction.guild.name} !\nRaison : ${reason}\nTotal des avertissements : ${warns[userId].count}\nSi tu atteins 3 warns, tu seras isolé.`;
        await target.send(warnMessage).catch(() => console.log(`Impossible d’envoyer un DM à ${member.tag}`));

        // Envoie un message dans le salon de logs
        const logChannelId = '1159895318440202433'; // Remplace par l’ID du salon de logs
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send(`⚠️ **Warn ajouté** : ${member.tag} (${member.id})\nRaison : ${reason}\nTotal : ${warns[userId].count} warns\nPar : ${interaction.user.tag}`);
        }

        // Gestion des rôles après un certain nombre de warns
        const warnThreshold = 3;
        const isolationRoleId = '1159958523548008541'; // Rôle "Isolé"
        const memberRoleId = '1159856520289341480';   // Rôle "Membre actif"
        const isolationChannelId = '1357795907940126981'; // Remplace par l’ID réel

        if (warns[userId].count >= warnThreshold) {
            const isolationRole = interaction.guild.roles.cache.get(isolationRoleId);
            const memberRole = interaction.guild.roles.cache.get(memberRoleId);
            const isolationChannel = interaction.guild.channels.cache.get(isolationChannelId);

            if (isolationRole && memberRole) {
                await target.roles.add(isolationRole).catch(console.error);
                await target.roles.remove(memberRole).catch(console.error);

                // Message dans le salon d’isolation
                if (isolationChannel && isolationChannel.isTextBased()) {
                    await isolationChannel.send(`<@${userId}>, tu as été isolé du serveur après ${warns[userId].count} avertissements. Raison du dernier warn : ${reason}. Contacte un modérateur pour plus d’infos.`);
                }

                await interaction.editReply(`${member.tag} a été averti pour : ${reason} (${warns[userId].count} warns). Il a été isolé du serveur.`);
            } else {
                await interaction.editReply(`${member.tag} a été averti pour : ${reason} (${warns[userId].count} warns). Vérifie les IDs des rôles !`);
            }
        } else {
            await interaction.editReply(`${member.tag} a été averti pour : ${reason} (${warns[userId].count} warns).`);
        }
    },
};