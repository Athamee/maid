const axios = require('axios');

async function getFileLink() {
    const email = 'athamee.f@gmail.com';
    const password = 'PCloudUmsn2sBV';
    try {
        const response = await axios.get('https://eapi.pcloud.com/getfilelink', {
            params: {
                username: email,
                password: password,
                fileid: 63209133838 // hug_001.gif
            }
        });
        const link = `https://${response.data.hosts[0]}${response.data.path}`;
        console.log('Lien du fichier hug_001.gif :', link);
    } catch (error) {
        console.error('Erreur :', error.response ? error.response.data : error.message);
    }
}

getFileLink();