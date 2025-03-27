const fs = require('fs').promises;
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'gifCache.json');
let cache = {}; // Cache en mémoire

// Charger le cache depuis le fichier au démarrage
async function loadCache() {
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf8');
        cache = JSON.parse(data);
    } catch (error) {
        cache = {}; // Si le fichier n’existe pas, on commence avec un cache vide
    }
    return cache;
}

// Sauvegarder le cache dans le fichier
async function saveCache() {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// Mettre à jour le cache (en mémoire et fichier)
async function updateGifList(action, gifs) {
    if (action) {
        cache[action] = gifs; // Met à jour une action spécifique
    } else {
        Object.assign(cache, gifs); // Met à jour tout le cache
    }
    await saveCache(); // Sauvegarde sur disque
}

// Récupérer depuis le cache en mémoire
function getGifList(action) {
    return cache[action] || [];
}

module.exports = { updateGifList, getGifList, loadCache };