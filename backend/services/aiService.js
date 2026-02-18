const Groq = require('groq-sdk');
const path = require('path');
const fs = require('fs');

const KNOWLEDGE_DIR = path.join(__dirname, '../knowledge');

function loadKnowledge(file) {
    try {
        const p = path.join(KNOWLEDGE_DIR, file);
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
        return {};
    } catch (e) {
        console.error(`[AI] Failed to load ${file}:`, e.message);
        return {};
    }
}

// Load knowledge base
const drivers = loadKnowledge('drivers.json');
const teams = loadKnowledge('teams.json');
const regulations = loadKnowledge('regulations2026.json');
const regComparison = loadKnowledge('regComparison.json');
const circuits = loadKnowledge('circuits.json');
const history = loadKnowledge('history.json');
const terminology = loadKnowledge('terminology.json');

const SYSTEM_PROMPT = `You are an expert F1 Twitter personality.
Style: Mixed analytical depth, genuine passion, and wit. 
Persona: Professional but human, never robotic.

Rules:
- STRICTLY under 280 characters.
- NEVER sound like a data feed.
- Add emotion or a take.
- Use 1-3 emojis naturally.
- Use #F1 #F12026.
- Write for experts and casuals alike.`;

// --- FIX 7: Default All Toggles to TRUE ---
let settings = {
    groqApiKey: process.env.GROQ_API_KEY || '',
    autoGenerate: {
        fastestLap: true,
        leaderChange: true,
        pitStop: true,
        flag: true,
        news: true,
        sessionSummary: true
    },
    minInterval: 120
};

let groqClient = null;
const lastGenerated = {};

function initGroq(apiKey) {
    const key = apiKey || settings.groqApiKey;
    if (key) {
        try {
            groqClient = new Groq({ apiKey: key });
            settings.groqApiKey = key;
        } catch (e) {
            console.error('[AI] Groq Init Error:', e.message);
        }
    }
}

function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    if (newSettings.groqApiKey) initGroq(newSettings.groqApiKey);
}

function getSettings() { return settings; }

function canGenerate(type) {
    const now = Date.now();
    const last = lastGenerated[type] || 0;
    return now - last >= settings.minInterval * 1000;
}

function markGenerated(type) {
    lastGenerated[type] = Date.now();
}

function buildDriverContext(driverCode) {
    if (!driverCode) return '';
    const d = drivers[driverCode];
    if (!d) return '';
    return `Driver: ${d.fullName} | Style: ${d.twitterAngle}`;
}

function buildTeamContext(teamName) {
    if (!teamName) return '';
    const t = teams[teamName] || Object.values(teams).find(v => teamName.includes(v.fullName));
    if (!t) return '';
    return `Team: ${t.fullName} | Narrative: ${t['2026narrative'] || ''}`;
}

async function generateTweet(type, context = {}, recentTweets = [], retryCount = 0) {
    if (!groqClient) {
        initGroq();
        if (!groqClient) {
            console.warn('[AI] No Groq API Key set. Generation skipped.');
            return null;
        }
    }

    try {
        const recentStr = recentTweets.length > 0
            ? `Recent styles (avoid repeating):\n${recentTweets.join('\n')}`
            : '';

        let userPrompt = `Event Type: ${type}\n`;
        userPrompt += `Context: ${JSON.stringify(context)}\n`;
        userPrompt += `Driver Info: ${buildDriverContext(context.driverCode || context.driverNum)}\n`;
        userPrompt += `Team Info: ${buildTeamContext(context.team || context.newTeam)}\n`;
        userPrompt += `${recentStr}\n`;
        userPrompt += `Write ONE authentic F1 tweet. Must be under 280 chars.`;

        if (retryCount > 0) {
            userPrompt += `\nSTRICT: Previous draft was >280 chars. USE FEWER WORDS.`;
        }

        const completion = await groqClient.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 150,
            temperature: 0.8
        });

        let text = completion.choices[0]?.message?.content?.trim() || '';
        text = text.replace(/^["']|["']$/g, '').trim();

        if (text.length > 280) {
            if (retryCount < 1) {
                return await generateTweet(type, context, recentTweets, retryCount + 1);
            } else {
                return text.substring(0, 276) + '...';
            }
        }

        return text || null;
    } catch (e) {
        console.error(`[AI] Generation Error (${type}):`, e.message);
        throw e; // Throw so server can catch it and report to UI
    }
}

// Initial init
initGroq();

module.exports = { generateTweet, initGroq, updateSettings, getSettings, canGenerate, markGenerated };
