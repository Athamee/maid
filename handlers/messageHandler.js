module.exports = (client) => {
    client.on('messageCreate', async message => {
        // Ignore les messages du bot lui-même
        if (message.author.bot) return;

        // Liste des IDs des salons où le bot peut répondre
        const allowedChannels = [
            'ID_SALON_01', // Remplace par l’ID réel du premier salon
            'ID_SALON_02'  // Remplace par l’ID réel du deuxième salon, ajoute autant que nécessaire
        ];

        // Vérifie si le message est dans un salon autorisé
        if (!allowedChannels.includes(message.channel.id)) return;

        // Liste de mots à détecter et réponses associées
        const triggerWords = {
            'bonjour': 'Coucou ! Comment vas-tu aujourd’hui ? Tu veux un thé, un café ou un cookie pour te requinquer ? Viens par ici : <#1353348735660195911>, je t\'y attends.',
            'salut': 'Salut, chère âme ! Que puis-je faire pour toi ?',
            'aide': 'Je suis là pour t’aider ! As-tu besoin d\'une modératrice ? Dans ce cas ping @Gaystapo.',
            //'merci': 'De rien, c’est un plaisir de te servir !',
            'pizza': 'Miam, une pizza ? Tu m’en gardes une part ? 🍕',
            'lol': 'Haha, qu’est-ce qui te fait rire ?',
            'bot': 'Oui, je suis là ! Toutes les commandes des bots se font ici : <#1160229527608369213>, sauf si tu veux me parler à moi, c\'est ici : <#1353348735660195911>.',
            'calin': 'Tu veux un câlin ? Viens dans <#1353348735660195911> et fais la commande "/hug", je serais ravie de te faire un câlin.',
            'thé': 'Tu veux un thé ? Viens dans <#1353348735660195911> et fais la commande "/tea", je serais ravie de te servir.',
            'café': 'Tu veux un café ? Viens dans <#1353348735660195911> et fais la commande "/coffee", je serais ravie de te servir ce café.',
            'cookie': 'Tu veux un cookie ? Viens dans <#1353348735660195911> et fais la commande "/cookie", je serais ravie de faire chauffer le four pour toi.'
        };

        // Convertit le message en minuscules pour une détection insensible à la casse
        const content = message.content.toLowerCase();

        // Vérifie chaque mot déclencheur
        for (const [word, response] of Object.entries(triggerWords)) {
            if (content.includes(word)) {
                await message.reply(response);
                break; // Répond une seule fois par message
            }
        }
    });
};