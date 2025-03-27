const fs = require('fs').promises;
const path = require('path');

const GIF_LIST_FILE = path.join(__dirname, 'commands', 'hugGifs.json');
let gifList = {};

// Charger la liste depuis le fichier au démarrage
async function loadGifList() {
    try {
        const data = await fs.readFile(GIF_LIST_FILE, 'utf8');
        gifList = JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors du chargement de hugGifs.json :', error);
        gifList = { hug: [] }; // Liste vide par défaut
    }
    return gifList;
}

// Récupérer la liste en mémoire
function getGifList(action) {
    return gifList[action] || [];
}

module.exports = { getGifList, loadGifList };