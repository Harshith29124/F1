const axios = require('axios');
const fs = require('fs');
const path = require('path');

const logos = {
    ferrari: 'https://media.formula1.com/content/dam/fom-website/teams/2025/ferrari-logo.png',
    mclaren: 'https://media.formula1.com/content/dam/fom-website/teams/2025/mclaren-logo.png',
    mercedes: 'https://media.formula1.com/content/dam/fom-website/teams/2025/mercedes-logo.png',
    redbull: 'https://media.formula1.com/content/dam/fom-website/teams/2025/red-bull-racing-logo.png',
    alpine: 'https://media.formula1.com/content/dam/fom-website/teams/2025/alpine-logo.png',
    williams: 'https://media.formula1.com/content/dam/fom-website/teams/2025/williams-logo.png',
    astonmartin: 'https://media.formula1.com/content/dam/fom-website/teams/2025/aston-martin-logo.png',
    haas: 'https://media.formula1.com/content/dam/fom-website/teams/2025/haas-logo.png',
    rb: 'https://media.formula1.com/content/dam/fom-website/teams/2025/racing-bulls-logo.png',
    audi: 'https://media.formula1.com/content/dam/fom-website/teams/2025/kick-sauber-logo.png',
};

const cadillacUrls = [
    'https://logo.clearbit.com/cadillac.com',
    'https://raw.githubusercontent.com/klunn91/team-logos/master/logos/cadillac.png',
    'https://www.car-logos.org/wp-content/uploads/2011/09/cadillac.png'
];

const outputDir = path.join(__dirname, '../frontend/public/logos');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function download() {
    // Download standard logos
    for (const [name, url] of Object.entries(logos)) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            fs.writeFileSync(path.join(outputDir, `${name}.png`), res.data);
            console.log(`Downloaded: ${name}`);
        } catch (e) {
            console.error(`Failed: ${name} - ${e.message}`);
        }
    }

    // Attempt Cadillac specially
    let cadillacDownloaded = false;
    for (const url of cadillacUrls) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            fs.writeFileSync(path.join(outputDir, 'cadillac.png'), res.data);
            console.log(`Downloaded: cadillac from ${url}`);
            cadillacDownloaded = true;
            break;
        } catch (e) {
            console.error(`Failed Cadillac from ${url}: ${e.message}`);
        }
    }
}

download();
