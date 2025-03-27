const { google } = require('googleapis');

// Fonction pour lister les GIFs d’un dossier, en utilisant un client OAuth2 passé en paramètre
async function listGifs(folderId, authClient) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents`, // Recherche dans le dossier spécifié
      fields: 'files(id, name, webViewLink)', // Champs à récupérer
      mimeType: 'image/gif', // Filtrer pour les GIFs uniquement
    });
    return res.data.files; // Liste des fichiers (GIFs)
  } catch (error) {
    console.error('Erreur lors de la récupération des GIFs :', error);
    return [];
  }
}

module.exports = { listGifs };