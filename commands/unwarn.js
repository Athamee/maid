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
        .setName('unwarn')
        .setDescription('Retire un ou tous les avertissements d’un membre.')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre dont retirer les warns')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('nombre')
                .setDescription('Nombre de warns à retirer (laisser vide pour tout supprimer)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply(); // Diffère la réponse pour avoir plus de temps si besoin

        const member = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('nombre'); // Peut être null si non spécifié
        
        // Vérifie si le membre existe
        const target = await interaction.guild.members.fetch(member.id).catch(() => null);
        if (!target) {
            return interaction.editReply({ content: 'Ce membre n’est pas sur le serveur !' });
        }

        // Charge les warns existants
        let warns = await getWarns();
        const userId = member.id;

        // Vérifie si le membre a des warns
        if (!warns[userId] || warns[userId].count === 0) {
            return interaction.editReply({ content: `${member.tag} n’a aucun avertissement à retirer.` });
        }

        const isolationRoleId = '1159958523548008541'; // Rôle "Isolé"
        const memberRoleId = '1159856520289341480';   // Rôle "Membre actif"
        const logChannelId = '1159895318440202433';      // Remplace par l’ID du salon de logs

        if (amount === null) {
            // Supprime tous les warns
            const previousCount = warns[userId].count;
            delete warns[userId];
            await saveWarns(warns);

            // Message privé au membre
            const unwarnMessage = `✅ **Avertissements supprimés** sur ${interaction.guild.name} !\nTous tes ${previousCount} avertissements ont été retirés.`;
            await target.send(unwarnMessage).catch(() => console.log(`Impossible d’envoyer un DM à ${member.tag}`));

            // Message dans le salon de logs
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(`✅ **Warns supprimés** : ${member.tag} (${member.id})\nTous les ${previousCount} warns ont été retirés\nPar : ${interaction.user.tag}`);
            }

            // Ajuste les rôles si le membre était isolé
            const isolationRole = interaction.guild.roles.cache.get(isolationRoleId);
            const memberRole = interaction.guild.roles.cache.get(memberRoleId);
            if (isolationRole && memberRole && target.roles.cache.has(isolationRoleId)) {
                await target.roles.remove(isolationRole).catch(console.error);
                await target.roles.add(memberRole).catch(console.error);
            }

            await interaction.editReply(`Tous les avertissements de ${member.tag} ont été supprimés.`);
        } else {
            // Retire un nombre spécifique de warns
            if (amount <= 0) {
                return interaction.editReply({ content: 'Le nombre doit être supérieur à 0 !' });
            }
            if (amount > warns[userId].count) {
                return interaction.editReply({ content: `${member.tag} n’a que ${warns[userId].count} warn(s), tu ne peux pas en retirer plus !` });
            }

            warns[userId].count -= amount;
            warns[userId].reasons.splice(-amount, amount); // Retire les dernières raisons
            const remainingWarns = warns[userId].count;

            if (remainingWarns <= 0) {
                delete warns[userId]; // Supprime l’entrée si plus de warns
            }
            await saveWarns(warns);

            // Message privé au membre
            const unwarnMessage = `✅ **Avertissements retirés** sur ${interaction.guild.name} !\n${amount} avertissement(s) ont été retirés.\nIl te reste : ${remainingWarns || 0} warn(s).`;
            await target.send(unwarnMessage).catch(() => console.log(`Impossible d’envoyer un DM à ${member.tag}`));

            // Message dans le salon de logs
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(`✅ **Warns retirés** : ${member.tag} (${member.id})\nNombre retiré : ${amount}\nRestant : ${remainingWarns || 0} warns\nPar : ${interaction.user.tag}`);
            }

            // Ajuste les rôles si le membre n’est plus au seuil d’isolation
            const isolationRole = interaction.guild.roles.cache.get(isolationRoleId);
            const memberRole = interaction.guild.roles.cache.get(memberRoleId);
            if (remainingWarns < 3 && isolationRole && memberRole && target.roles.cache.has(isolationRoleId)) {
                await target.roles.remove(isolationRole).catch(console.error);
                await target.roles.add(memberRole).catch(console.error);
            }

            await interaction.editReply(`${amount} avertissement(s) ont été retirés à ${member.tag}. Il lui reste ${remainingWarns || 0} warn(s).`);
        }
    },
};