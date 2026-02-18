require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Unhandled Rejection:', reason);
  fs.appendFileSync('crash.log', `[${new Date().toISOString()}] Unhandled Rejection: ${reason.stack || reason}\n`);
});
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err);
  fs.appendFileSync('crash.log', `[${new Date().toISOString()}] Uncaught Exception: ${err.stack}\n\n`);
  process.exit(1);
});

const f1TimingService = require('./services/f1TimingService');
const aiService = require('./services/aiService');
const scraperService = require('./services/scraperService');
const tweetQueueService = require('./services/tweetQueueService');
const jolpicaService = require('./services/jolpicaService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'DELETE']
}));
app.use(express.json());

// ─── WEBSOCKET BROADCAST ───
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ─── EVENT HANDLERS ───
f1TimingService.init(broadcast, async (eventType, context) => {
  const setts = aiService.getSettings();
  const triggerMap = {
    'fastest_lap': 'fastestLap',
    'leader_change': 'leaderChange',
    'pit_stop': 'pitStop',
    'flag': 'flag'
  };

  const settingsKey = triggerMap[eventType] || eventType;

  if (setts.autoGenerate?.[settingsKey] && aiService.canGenerate(eventType)) {
    try {
      const recentTexts = tweetQueueService.getRecentTexts(5);
      const text = await aiService.generateTweet(eventType, context, recentTexts);
      if (text) {
        const tweet = tweetQueueService.add(text, eventType, context);
        broadcast('tweet_generated', tweet);
        aiService.markGenerated(eventType);
      }
    } catch (e) {
      console.error(`[SERVER] Auto-gen failed for ${eventType}:`, e.message);
    }
  }
});

scraperService.init(broadcast, async (article) => {
  const setts = aiService.getSettings();
  if (setts.autoGenerate?.news && aiService.canGenerate('news')) {
    try {
      const recentTexts = tweetQueueService.getRecentTexts(5);
      const text = await aiService.generateTweet('news', article, recentTexts);
      if (text) {
        const tweet = tweetQueueService.add(text, 'news', article);
        broadcast('tweet_generated', tweet);
        aiService.markGenerated('news');
        scraperService.markTweetGenerated(article.url);
      }
    } catch (e) {
      console.error(`[SERVER] News auto-gen failed:`, e.message);
    }
  }
});

// ─── API ENDPOINTS ───

app.get('/health', (req, res) => {
  const state = f1TimingService.getState();
  res.json({
    status: "ok",
    f1Connected: state.connected,
    sessionName: state.session?.name || null,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/live/timing', (req, res) => res.json(f1TimingService.getSortedTiming()));
app.get('/api/live/state', (req, res) => res.json(f1TimingService.getState()));

app.post('/api/live/connect', (req, res) => {
  f1TimingService.connect();
  res.json({ success: true });
});

app.post('/api/live/disconnect', (req, res) => {
  f1TimingService.disconnect();
  res.json({ success: true });
});

app.get('/api/f1/standings', async (req, res) => {
  try {
    const [drivers, constructors] = await Promise.all([
      jolpicaService.getDriverStandings(),
      jolpicaService.getConstructorStandings()
    ]);
    res.json({ drivers, constructors });
  } catch (e) {
    res.status(502).json({ error: 'Data source unavailable' });
  }
});

app.get('/api/f1/schedule', async (req, res) => {
  try {
    const races = await jolpicaService.getUpcomingRaces();
    res.json(races);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/tweet/generate', async (req, res) => {
  try {
    const { type, context } = req.body;
    console.log(`[SERVER] Received manual generation request for type: ${type}`);
    const recentTexts = tweetQueueService.getRecentTexts(5);
    const text = await aiService.generateTweet(type, context || {}, recentTexts);
    if (text) {
      const tweet = tweetQueueService.add(text, type, context);
      broadcast('tweet_generated', tweet);
      return res.json({ success: true, tweet });
    }
    res.status(400).json({ error: 'AI Orchestrator returned no text. Check your API key.' });
  } catch (e) {
    console.error(`[SERVER] Manual generation failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tweet/queue', (req, res) => res.json(tweetQueueService.getAll()));
app.delete('/api/tweet/queue/:id', (req, res) => {
  const success = tweetQueueService.remove(req.params.id);
  res.json({ success });
});

app.get('/api/settings', (req, res) => res.json(aiService.getSettings()));
app.post('/api/settings', (req, res) => {
  aiService.updateSettings(req.body);
  res.json({ success: true, settings: aiService.getSettings() });
});

app.get('/api/news', (req, res) => res.json(scraperService.getArticles()));

// --- FIX 10: News Refresh Endpoint ---
app.post('/api/news/refresh', async (req, res) => {
  try {
    const results = await scraperService.scrapeAll();
    res.json({ success: true, count: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WEBSOCKET SERVER ───
wss.on('connection', (ws) => {
  const state = {
    ...f1TimingService.getState(),
    tweets: tweetQueueService.getAll(),
    news: scraperService.getArticles()
  };
  ws.send(JSON.stringify({ type: 'init', data: state }));
});

// ─── STARTUP ───
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Hub active on port ${PORT}`);
  f1TimingService.connect();
  scraperService.scrapeAll();
  cron.schedule('0 */6 * * *', () => {
    scraperService.scrapeAll();
  });
});

process.on('SIGTERM', () => {
  f1TimingService.disconnect();
  server.close(() => process.exit(0));
});
