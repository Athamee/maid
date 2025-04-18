const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../db');
const path = require('path');

// Formule pour XP requis au niveau suivant : 1000 + (level-1)^2 * 400
const getRequiredXp = (level) => 1000 + Math.pow(level - 1, 2) * 400;

// Configuration des images pour les montées de niveau
const levelUpImages = {
    10: path.join(__dirname, '../img/level10.png'),
    15: path.join(__dirname, '../img/level15.png'),
    20: path.join(__dirname, '../img/level20.png')
};
const defaultImage = path.join(__dirname, '../img/default.png');

const getLevelUpImage = (level) => {
    if (!level || level < 1) {
        console.warn(`Niveau invalide : ${level}, utilisation de l'image par défaut`);
        return defaultImage;
    }
    const image = levelUpImages[level];
    if (image) {
        console.log(`Niveau ${level} exact, image sélectionnée : ${image}`);
        return image;
    }
    console.log(`Niveau ${level} sans image spécifique, image par défaut : ${defaultImage}`);
    return defaultImage;
};

// Fonction pour récupérer le message de montée de niveau
const getLevelUpMessage = async (guildId, level) => {
    const customMessageResult = await pool.query(
        'SELECT message FROM level_up_messages WHERE guild_id = $1 AND level = $2',
        [guildId, level]
    );
    if (customMessageResult.rows.length > 0) {
        return customMessageResult.rows[0].message;
    }

    const settingsResult = await pool.query(
        'SELECT default_level_message FROM xp_settings WHERE guild_id = $1',
        [guildId]
    );
    const defaultMessage = settingsResult.rows[0]?.default_level_message || '🎉 Niveau {level}, {user} ! Continue comme ça !';
    return defaultMessage.replace('{level}', level);
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xpadd')
        .setDescription('Ajouter de l’XP à un membre (admin & animateur)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Membre à modifier')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('xp')
                .setDescription('Quantité d’XP à ajouter')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const modoRoleId = process.env.MODO;
        const animatorRoleId = process.env.ANIMATOR;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasModoRole = modoRoleId && interaction.member.roles.cache.has(modoRoleId);
        const hasAnimatorRole = animatorRoleId && interaction.member.roles.cache.has(animatorRoleId);

        // Reporter la réponse pour éviter Unknown Interaction
        await interaction.deferReply();

        if (!isAdmin && !hasModoRole && !hasAnimatorRole) {
            return interaction.editReply({ content: 'Permission refusée.', ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const xpToAdd = interaction.options.getInteger('xp');

        const guildId = interaction.guild.id;
        const userId = target.id;

        try {
            // Récupérer le niveau initial du membre
            const initialResult = await pool.query(
                'SELECT level, xp FROM xp WHERE user_id = $1 AND guild_id = $2',
                [userId, guildId]
            );
            const initialLevel = initialResult.rows[0]?.level || 1;
            const initialXp = initialResult.rows[0]?.xp || 0;

            // Mise à jour de l’XP et de last_message
            const { rows } = await pool.query(
                'INSERT INTO xp (user_id, guild_id, xp, last_message) VALUES ($1, $2, $3, NOW()) ' +
                'ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = xp.xp + $3, last_message = NOW() ' +
                'RETURNING xp, level',
                [userId, guildId, xpToAdd]
            );

            let newXp = rows[0].xp;
            let newLevel = rows[0].level || 1;

            // Recalculer le niveau basé sur l’XP total
            let recalculatedLevel = 1;
            while (newXp >= getRequiredXp(recalculatedLevel + 1)) {
                recalculatedLevel++;
            }

            if (recalculatedLevel !== newLevel) {
                newLevel = recalculatedLevel;
                await pool.query(
                    'UPDATE xp SET level = $1 WHERE user_id = $2 AND guild_id = $3',
                    [newLevel, userId, guildId]
                );
            }

            console.log(`XP ajouté pour ${target.tag} : XP=${newXp}, Niveau=${newLevel}`);

            // Calculer l’XP restant pour le prochain niveau
            const xpForNextLevel = getRequiredXp(newLevel + 1);
            const xpRemaining = xpForNextLevel - newXp;

            // Calcul de la progression pour la barre (copié de profile.js)
            const xpForCurrentLevel = getRequiredXp(newLevel); // XP requis pour atteindre le niveau actuel
            const xpInCurrentLevel = newXp - xpForCurrentLevel; // XP gagnés dans le niveau actuel
            const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel; // XP total pour passer au niveau suivant
            const progressPercentage = Math.min((xpInCurrentLevel / xpNeededForLevel) * 100, 100); // Pourcentage (0 à 100)

            // Création de la barre de progression avec emojis personnalisés
            const steps = Math.floor(progressPercentage / 2); // Nombre d'étapes (0 à 50)
            let progressBar = '';
            for (let i = 0; i < 10; i++) {
                const segmentSteps = i * 5; // Chaque segment couvre 5 étapes (10%)
                if (steps >= segmentSteps + 5) {
                    progressBar += '<:100:1361391591930986867> '; // 100% pour ce segment
                } else if (steps >= segmentSteps + 4) {
                    progressBar += '<:80:1361391593432682748>'; // 80% pour ce segment
                } else if (steps >= segmentSteps + 3) {
                    progressBar += '<:60:1361391596163043640>'; // 60% pour ce segment
                } else if (steps >= segmentSteps + 2) {
                    progressBar += '<:40:1361391597878645046>'; // 40% pour ce segment
                } else if (steps >= segmentSteps + 1) {
                    progressBar += '<:20:1361391600328245442>'; // 20% pour ce segment
                } else {
                    progressBar += '<:00:1361391603767578925>'; // 0% pour ce segment
                }
            }
            const progressDisplay = `${progressBar} (${Math.round(progressPercentage)}%)`;
            console.log(`Barre de progression pour ${target.tag} : ${progressDisplay}`);

            // Vérifier si le niveau a augmenté et envoyer le message pour le dernier niveau uniquement
            if (newLevel > initialLevel) {
                const settingsResult = await pool.query(
                    'SELECT level_up_channel FROM xp_settings WHERE guild_id = $1',
                    [guildId]
                );
                const levelUpChannelId = settingsResult.rows[0]?.level_up_channel;

                if (levelUpChannelId) {
                    const channel = interaction.client.channels.cache.get(levelUpChannelId);
                    if (channel) {
                        const messageTemplate = await getLevelUpMessage(guildId, newLevel);
                        const formattedMessage = messageTemplate.replace('{user}', `<@${userId}>`);
                        const imagePath = getLevelUpImage(newLevel);
                        await channel.send({ content: formattedMessage, files: [imagePath] });
                    } else {
                        console.warn(`Canal level_up_channel (${levelUpChannelId}) introuvable.`);
                    }
                } else {
                    console.warn(`level_up_channel non défini pour guild ${guildId}.`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`XP ajouté pour ${target.tag}`)
                .setColor('#00FFAA')
                .addFields(
                    { name: 'XP reçu', value: `${xpToAdd}`, inline: false },
                    { name: 'XP total', value: `${newXp}`, inline: false },
                    { name: 'Niveau', value: `${newLevel}`, inline: false },
                    { name: 'Prochain niveau', value: `${xpRemaining} / ${xpForNextLevel}\n${progressDisplay}`, inline: false }
                );

            // Réponse visible pour tous
            await interaction.editReply({ embeds: [embed] });
            console.log(`XP ajouté pour ${target.tag} par ${interaction.user.tag}: +${xpToAdd} XP, nouveau niveau: ${newLevel}`);
        } catch (error) {
            console.error('Erreur xpadd :', error.stack);
            await interaction.editReply({ content: 'Erreur lors de l’ajout d’XP.', ephemeral: true });
        }
    }
};