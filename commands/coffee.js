const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const coffeeGifs = [
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZW4xZDRiNjNwZ2VqMGw0MTAzbWptMWN4bmNjejdmZWQwNGo2ZGN4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/M4ecx9P2jI4tq/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExY242bGR4b2FlZ3c2OTczODlkOGYzdDl3bGh0eGpna3FxZzVjbWo5byZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7qV3yswT0K8hi/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjRrMWE0MHNqb2VrbTBycXdtdjlibm8yMWN6Nng0d2UzZDQ1bXd2ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Mpgt8pozJ6J2g/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHhhMHR3bmEzOXRlY2swcTdjMnQ3aXVpNjhxNGVtM3B6YXBsdDdwNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/103xBGbLhYFuwM/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTZnZm9lMzA1NzQ5ZHdmbm80ZjJxYjBueDNrdGd1YWJzdjVkdTdoZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3jVT4U5bilspG/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXEwcnU0NHVqZTRmMWZsaTRhY2N3a3FlcTNxeWV6cDE0bW95Mmd1MiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/CqtG4f5UF9G5q/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHIxemg3MWN0MzZhNzk0a3h4M3BiZnV0OWprM3dzbXlsbjNuazRmNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/X8OQGmNtNXTyg/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbm84bXdtZGpncDczd3VvZ21jMmQ0ZWEybzc2dW50amJ6OGx4a3V4cSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/HVhofxmUXMyGs/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3Z2OGY5M3VvOWwxcHU0NmNmZnNjOTlzdWFzNmt0Y2RwYmZnenp3ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/321wKleotdr4puJIvk/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGJyNTU4ajkzYWkwZHNnMGtscno5NHRtbXZubjhwaHNrdWk2NmlhYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12OZlHgyEZZHRm/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbm40djY0cXJreXVmOGFnbDZta3Mwb2lxYWR3YjdudWMxbGN4cXFraCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6NlmBQLhWy2QM/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNTRjbzJoOXBsYWtlNjk2dG5zMDE2Njl5MDA0MHQzam01OXk3NWlhayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/rsQu1BC0BF8wo/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExb3hlemgyZGNtaGdic2QxcTd6emwwYjIzMDdjNTJ4NjQ1dXV1d2RseSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WvN7uCpZaNNXW/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2U1ZDU1ODZtZjY1ZThkMTR3OGkwd2NvNDAwOWo4dTNmanYyemN5ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Hyq5QFq4t9qDu/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3Mzbms2emo1MnIxOWhhYTN5OTMwYTg3bGgzZWYzZHpxNTh0eTFvaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XlOLpoZyYZ1pm/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2hmeDB4ZnQxY2Y4NmN4NjNidjc2Mmc1OG1reXY2c2JzMnpnMXJxMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/I1cEnXR3z7RbG/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXU5Y3prOTUyYzRjNW00OXAxbnh0NXR4ZHgyemdpNGF5Z3ZuYzJhcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2jd7CRuYayGpW/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGFoaHA1MjJjaWFjcTd2NnlqNXFvanU5NWsxOXpoN2IweWptOGx0cSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6Zt7efI3ruag4zEA/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDV0OTJ1OHl1cWpkM2d0N2RnMmxqZW1iNThpZGhrZHdtMnVnaW52OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/nN7Chphf1ICwo/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjdudHdvNnFlMnlqdXN5YmwwaWt1OHMyc2xjd2Y0aWhmZ3FoNXMyYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/iG4ky2zidnxTJE9zgP/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNG5pcWE5NHF0eGhzemVrOXV0bWN6cDJueTMxMTQxdHc0ZWNjYXc5MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5Ztn33chuvutW/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDRibHVvaXZwbzdjampycjk4NDY3dXVhNjUzM25vdGxzdzZ6NnhjaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3dpTOXVkXmPdcpvoRc/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNW9pbWNnZHlpcGRwNHVkbHowaWFxaXIzcnFtOHc0cGp0c2VpMmpoYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Y4i5VX3WsSRtm/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHdoend6azNuc2kxaHd3dmZ6eGVzcHp2aHl2Mmhna2RwenBqbHRlbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/oZEBLugoTthxS/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG03dTJoZ3o4OTd6MmRzazU1bWlmYnNmbjlzYnJzNXN6cnVleW83biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6Zt5l94AqEdUrWp2/giphy.gif",
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGJmZ3M4c3ppMTVkcTNzMjZoZXYzdmw1djUzM2xvd3Bwd2prazZscyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/w9d15TEDKpEVf0FSFA/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWhud3ZramUxMHh6emt2NmM3bGF4dzlidDc0bHA5OGt2eXJvYnRyMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/sAY2wh0zK1z68/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzBhZGZ3anFncTR1dTEyYTFxMjNmamNmbjA2N3VvYjBjd3l6b2l0dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KY2dtJNlGPH08w41FN/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHVucGZ4YzYzYm9oZHpxMnJrbml4NTN1ejBsYXhzczcxdDg2dnpqZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/azqIclO2IYLqBbGJAT/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzAyMWQzdWN1dHg3YTRxbzRuZnBuZ2RkbGI0amk2dmx5Zzc5eW1sdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aFJL4qOgTbkgqsBrab/giphy.gif",
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGd6Y2l4c3JyaGN2ejJramtrbXhvbHc1MmU1N2Nhd2R3dHA0dG5nNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XqZ9yNKuo3T2/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHJsN3UwcjJubzJ2b3Vqdnh3d2QyOHJ6ZXR0emZ6ank4ODJpa2Q5ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3nbxypT20Ulmo/giphy.gif",

    //ajouter au dessus les liens de gif
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coffee')
        .setDescription('Sert un café avec un GIF aléatoire !')
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
        const randomGif = coffeeGifs[Math.floor(Math.random() * coffeeGifs.length)];

        // Créer un embed avec le GIF uniquement
        const hugEmbed = new EmbedBuilder()
            .setImage(randomGif)
            .setColor('#ff99cc');

        // Répondre avec le ping de l'utilisateur qui exécute et de la cible
        await interaction.reply({ 
            content: `${interaction.user} sert un café à ${user} !`, 
            embeds: [hugEmbed] 
        });
    },
};