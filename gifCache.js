const fs = require('fs').promises;
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'gifCache.json');

// Charger le cache
async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {}; // Retourne un objet vide si le fichier n’existe pas
  }
}

// Sauvegarder le cache
async function saveCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// Mettre à jour une liste spécifique
async function updateGifList(action, gifs) {
  const cache = await loadCache();
  cache[action] = gifs; // Ex. cache['hug'] = [{ id, name, webViewLink }, ...]
  await saveCache(cache);
}

// Récupérer une liste depuis le cache
async function getGifList(action) {
  const cache = await loadCache();
  return cache[action] || [];
}

module.exports = { updateGifList, getGifList };