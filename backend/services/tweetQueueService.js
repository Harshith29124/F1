const { v4: uuidv4 } = require('uuid');

const queue = [];
const MAX_QUEUE = 50;

function add(text, type, context = {}) {
    const tweet = {
        id: uuidv4(),
        text,
        type,
        context,
        generatedAt: new Date().toISOString(),
        posted: false
    };
    queue.unshift(tweet);
    // Remove oldest posted tweets if over limit
    while (queue.length > MAX_QUEUE) {
        const oldestPostedIdx = queue.map((t, i) => ({ t, i })).reverse().find(({ t }) => t.posted);
        if (oldestPostedIdx) queue.splice(oldestPostedIdx.i, 1);
        else queue.pop();
    }
    return tweet;
}

function getAll() { return [...queue]; }
function getUnposted() { return queue.filter(t => !t.posted); }

function markPosted(id) {
    const t = queue.find(t => t.id === id);
    if (t) t.posted = true;
    return !!t;
}

function remove(id) {
    const idx = queue.findIndex(t => t.id === id);
    if (idx !== -1) { queue.splice(idx, 1); return true; }
    return false;
}

function getRecentTexts(n = 5) {
    return queue.slice(0, n).map(t => t.text);
}

module.exports = { add, getAll, getUnposted, markPosted, remove, getRecentTexts };
