const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const teaGifs = [
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmQ5czZ1M3dweHlxaWNwdXloY3pycnp3YTI2ZTFoY3RrZTB0Mm95YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZErmptaZPGQQXeO2Lw/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYXRiOGNoeWNyb2ZtMDRmNXltbjF2Yzh4OW9odW5jaTRza2Uxd2JjaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlwwRxfcVEr4AUg/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExb3dramxkMTNhMDUxeDFmYnBwMWVlczN5em03Mzlpd3h0Mm9lNHdpcCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hQdWtl18ibA58nil8t/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2M2ZHB6cmN0Ym9qeXlyYWU4cGlxdmdtYWI4M3h4dGJrb2IyOXAzNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o85xGocUH8RYoDKKs/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGlvZHU2NW4ya3F6a3RxYnQ0ejhpdzdmeXMxd251ZTA2Nm1xYnR6dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/31UDILmnnQOjnKKoKB/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHpiM3ViZ2Nuazh3d3BwZmo4OHNyc3NveG5oN3k4bjg4ejZ6eDQ3dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oz8xFA1SJJZd8Bkly/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjF0bmVrbjB2cXc1cnFzcnpvdWhwOXYweWw0dmdiOTFpdnVwMWNjNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/gLcUFh2TrdySKUnTHD/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcG1mcTlocXAxc2kydHM0cWJ6aDJ3M2dqdDl4NTNmMXphYndqbG91ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/11mPvWj3R3mCKA/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExODE2MHNwZDdjNHJ5eDd2NmtkN3cwdWtoYzg1aWw1Y25jZ2QyZDdrbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l092lTtYG7mmRysZso/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWpmYWMyeG9odjA2N2ttN3RwcXYzcWxlbG90aXdybWZxNWdrMGdmbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Tcxpqk0Dh6LWU/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJucG5lYjhoYjdjdWFlcjMwM3drOTZ6eDVxZmRmMTlxa29uZHpqdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/sQbMs7aLA6Hle/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmd0ZWxjYnF6Y2g0OHB1NHppYjk1OXpkMmQyaHR6Z3hlc2V2bDQ1ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/uqrwVGzfSpFg4/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3h3MWphbGY3NW03a25hMHRvM2IyaGpzdHBoNWl1ZXd3dmtidWViciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2z0GFIoCNUVY4/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDhqcm9tMGttMnd6cmw1YjZlaWVvdGh3NnZ6amZ1cWJoOHNwczRqZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/UeAyHIgB8YSoypGEsY/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHR3bTF4bHd1c2ZldTJlejhidmhuMmoxajBoamhhZnhzMHRvOWt5ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WQMgnHWQdyZjO/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXIzZ3dsNnd5eDNpZHdqbDR6bm1pdW1zNHlqd2dzZnlzZHJlOXB3MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WPO1IoXaFIVuE/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2g0aWNiZ3M4NmVjbnF1cjY4cnZpMDF5emFwamZzdXllZmJqNjR4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26BkNJMHsPXIKcwdq/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjNxdnVpMWo2ZGJjczVwMHl2d3ZkbHFzcjM5Mm0yejQzZzN4bHVsNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/f7LzboaTi5tk7CPy0r/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWFveDRwdWc1Y21nb21waHAydG1rdzIyMGQ2YTFxcGdrMm5mY2NwZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ww7NbJTq4Ghby/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdm9reXgxMDJoeHhsODVnMmJuemJjOTh3NTh5MW56azMwd2UwYzY3byZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xTgeINddi79Gnuyek0/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjRraHcwOGVjaGxia3VkanZocWZuNnNwd2t5dWVhNzFjbmZwdWZzayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/DiEg10HvY4Wn6/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYXFyaWptaHBzZm5xcmZ0OTRycmQ3a2o0dzdoM2tpcXM4emVieHVycCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LnHWbJquvFpE4/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjRpa2xzejJodm54emIybHY2dWZxNG5ycnBmOWQxcDRpMWRyamEzeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JbTbqjdjJDySre4o18/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzlrdmU3cXFmbjY1Z2xvY3V4NnJsdDFmNmNrM2Q3aDRxcmEwcjJsZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/bFdwo67CJST4c/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHk3azVkaGxrcGRhcHBianI1NzdlcHJ0Y3UxeXpna3Z0c2U3Y3VqMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ueZD42FJbvhsqgE/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmZ4cDI1ZGZ4OWgxaWR6aThpZmFtOGUyNml6anJpYjE3b2VtbHJ1cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fD8gg1XymoTEhXhfCW/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExc3Nub24xMW1jenN6NGdmY3o5enBlNGxjOWo4bDg2dG1mcWM2ejN2ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/alhEEvfcoCM92/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXd6ZWNhcnlqczJhNHVrNXc4bHNsZGJqcGw3MTU5bTQ1MzA1OHFieiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xUNda1Qlal02nDXNNC/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbTNhZHl6NWtxYW1rMDlwZDRiam1oeDltMGU5ZzJ6M29rZ255ejU4aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/H6GWbbAYKhAJO/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExang1ejBlNDk5a3FveXh6emE5M2h1enJyajN0eGFncmF0aDVkMXpxayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/uQaQAVW3QkcLK/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWVwcDI3c3E3MTkxN3YzMTYxOGd5Nm5yeXJwOWozMWt4c3F4bG5tZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ge2ckPYYtHJX5mdgiY/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2VxZXpmcDhhMjNycG9hMjlhZWppYmZ5b3dsdmthb3RqOGs4dXpmYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aKjaEWISv9Ie4/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWlybmN2b2dyN3A4cjN5NmxocWk4YWs5OXQzbXF5MmQwY3Z2dTloYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/yr6mgdF0b9arC/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2NuZGpyZ3puNmVtODFrdDMyNTYxdXc3MGg1Nm93OG8yNmFlenh5YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/lXprrc5D8Mn16/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXJwZXY1cGZyY3dzOGQ3dG01YTR1MDFyNXN6M2lqbmRzd3Q1ZmM2ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o85xmXTiPM4OCilcQ/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJweGQ2dTR0bmJ0emk5azRzcG5nbHB3Zm9mMjJ5ZWh0MmJnOWIzbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/k3WQKGoeQQOqc/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExb3ppcTZkNm5pMGdqbmhhODIwYmhta2tyeW0yY3Aya2swZjQzcHZ1NyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vKJPocAdFfLXh3Hmhx/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTNleGR2bGtpMGJhY2VmcTA3b2FvY3IzenU5bzM2amM2MWM0Y3V6ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JVkGguQX86O1a/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3hsd2lxMGllM2FqNDFkcGpqcW1iYXhkZ3FtMWZ0am9vdHVhcHZkeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/rXIR4DkNeBSRW/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjJ6c2M0bXF6Z2FvN2xzYjJyc3o2cmNvbmlkc2pxNzR6azJqajE1ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/i1qClf0JQJTTq/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGprcHRsM2ViZnR5ZHY1bGM1a3F2em42d3R0N3d4ZHAycTJrdndpayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BtSoR4W9cqUjS/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDd3d3Q1bG13d2xzMWc3cDFzd2NjaTlydTNyOTVvaWx0YzJoYnloaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/eX3FgQuyFr6ravTeP7/giphy.gif",

    //ajouter au dessus les liens de gif
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tea')
        .setDescription('Sert un thé avec un GIF aléatoire !')
        .addUserOption(option =>
            option.setName('cible')
                .setDescription('La personne servie')
                .setRequired(true)),
    async execute(interaction) {
        const allowedChannelId = '1353348735660195911'; // Remplace par l'ID du salon autorisé

        // Vérifier si la commande est utilisée dans le bon salon
        if (interaction.channel.id !== allowedChannelId) {
            return interaction.reply({ 
                content: 'Désolé, cette commande ne peut être utilisée que dans un salon spécifique !', 
                ephemeral: true // Message visible uniquement par l'utilisateur
            });
        }

        const user = interaction.options.getUser('cible');
        const randomGif = teaGifs[Math.floor(Math.random() * teaGifs.length)];

        // Créer un embed avec le GIF uniquement
        const hugEmbed = new EmbedBuilder()
            .setImage(randomGif)
            .setColor('#ff99cc');

        // Répondre avec le ping de l'utilisateur qui exécute et de la cible
        await interaction.reply({ 
            content: `${interaction.user} sert un thé à ${user} !`, 
            embeds: [hugEmbed] 
        });
    },
};