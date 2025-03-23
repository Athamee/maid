const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const hugGifs = [
    'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzAzdmxoczNydm56dXRqM2oycXk1OXZqeHU5enphamhzY2dqdWFzcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KG5oq4vesf9r8JbBEN/giphy.gif',
    'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWV3cmIxaW52OTMybmNzdzRkc3BlbnI5ZzJpbThza3A2MW44OTV5aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BVNhieQ6tT9A9h0dp3/giphy.gif',
    'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjlpNjVkazZwbWpkNHl5b21pYzg2bnM4bWt0cXd3bTJ3MWIyZmE4ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/qJlDB5QdbIMPxALdnv/giphy.gif',
    'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExczMxcXBmNzFjZnZrcjRwbThjdWl4eDUzMnMxdXN3ZWZrZ2F4eXBrZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/8ORo4eBT9i2zu/giphy.gif',
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmFrNW10ODR3a2hndjEwZnMzczk3bXJmOG1uZWM4NzF1emZpdHZxYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/PT0kQUBzWMOWI/giphy.gif',
    'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXhqcTJhbHF2OWd4cWo0dWNsaGVpanJkc3hrb3Z6NXZwNWhpOGEyaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/TIWxMcRbtVeIU/giphy.gif',
    'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDN2ZWs0cjk2M3BlbTVpM3lhM25oM2hhNDIzNGx2YjdjN2t2MGk1dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vnx1NMcTTcJWg/giphy.gif',
    'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmt0ZWQxaWlyM3U0MXl1dHhudnVjdXE0OHEzNzlnaGcyYnh0b294YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/RmZemRytXqmic/giphy.gif',
    'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzF6bmNseGNudnJuYzJoenNib25scWZldDF6ZnFsN3c4cWl6NG1kcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iFVIEkMduXNII/giphy.gif',
    'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExc3Z0MTR2NGlidXIzMmNxNTV5cWF1OW8ycmxiOXhvMjEzZ3VyYjR5YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/CjzllG1RAnY3K/giphy.gif',
    'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdTZ0ZDBpZHRtajZjcmhycGg4c2NzZGpweXhvMmZ1bDU5ZHh3eDhmNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12hAqqMqwgnV9C/giphy.gif',
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGZ4MjgxMWowZHFqYm1mOHVoZHYza3ZnY2JkcGkxbm0zdzlrZXkyMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mr8eXWPaLM2cw/giphy.gif',
    'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2Q3dnR6bTl0cWFsZHN1eHE2cW9jc3p0b2NvNjg5c2dmN3kyemg0ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26gs6DXO9OPEUMuw8/giphy.gif',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Fais un câlin à quelqu’un avec un GIF aléatoire !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('La personne à câliner')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('cible');
        const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        // Créer un embed avec le GIF uniquement
        const hugEmbed = new EmbedBuilder()
            .setImage(randomGif) // Le GIF s'affiche directement dans l'embed
            .setColor('#ff99cc'); // Couleur optionnelle (rose ici, tu peux changer)

        // Répondre avec le ping au-dessus de l'embed
        await interaction.reply({ content: `Voici un câlin pour toi, ${user} !`, embeds: [hugEmbed] });
    },
};