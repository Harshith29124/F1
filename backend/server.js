const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const cron = require('node-cron');
const { WebSocket } = require('ws');
const http = require('http');
const { Server } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new Server({ server });

// ─── STATE ─────────────────────────────────────────────────────────────────
let twitterConfig = {};
let timingData = {};         // driver_number -> { position, lapTime, gap, tyre, pits, lastSector }
let sessionInfo = {};        // session name, track, type
let raceControlMessages = [];
let sessionActive = false;
let f1SignalRSocket = null;
let connectedClients = new Set();
let tweetLog = [];
let schedules = {};
let autoTweetEnabled = false;
let autoTweetSettings = {
  fastestLap: true,
  leaderChange: true,
  pitStop: true,
  flag: true,
  sessionSummary: true,
  minIntervalSeconds: 120
};
let lastTweetTime = 0;
let previousLeader = null;
let sessionFastestLap = { time: null, driver: null };

// ─── BROADCAST TO FRONTEND CLIENTS ─────────────────────────────────────────
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  connectedClients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function addLog(msg, level = 'info') {
  const entry = { msg, level, time: new Date().toISOString() };
  tweetLog.unshift(entry);
  if (tweetLog.length > 200) tweetLog.pop();
  broadcast('log', entry);
  console.log(`[${level.toUpperCase()}] ${msg}`);
}

// ─── TWITTER ───────────────────────────────────────────────────────────────
async function postTweet(text) {
  if (!twitterConfig.apiKey) {
    addLog('Twitter not configured — skipping tweet', 'warn');
    return null;
  }
  const now = Date.now();
  if (now - lastTweetTime < autoTweetSettings.minIntervalSeconds * 1000) {
    addLog(`Rate limited — wait ${autoTweetSettings.minIntervalSeconds}s between tweets`, 'warn');
    return null;
  }
  try {
    const client = new TwitterApi({
      appKey: twitterConfig.apiKey,
      appSecret: twitterConfig.apiSecret,
      accessToken: twitterConfig.accessToken,
      accessSecret: twitterConfig.accessSecret,
    });
    const tweet = await client.v2.tweet(text);
    lastTweetTime = now;
    addLog(`✅ Tweeted: ${text.substring(0, 60)}...`, 'success');
    broadcast('tweet_posted', { text, tweetId: tweet.data.id });
    return tweet.data.id;
  } catch (e) {
    addLog(`❌ Tweet failed: ${e.message}`, 'error');
    return null;
  }
}

// ─── TWEET TEMPLATES ───────────────────────────────────────────────────────
const TEAM_EMOJIS = {
  'Ferrari': '🔴', 'McLaren': '🟠', 'Mercedes': '⬛', 'Red Bull': '🔵',
  'Alpine': '💙', 'Williams': '💙', 'Aston Martin': '💚', 'Haas': '⬜',
  'Racing Bulls': '🔵', 'Audi': '⚪', 'Cadillac': '🇺🇸', 'Kick Sauber': '🟢'
};

function getTeamEmoji(team) {
  return TEAM_EMOJIS[team] || '🏎️';
}

function formatFastestLapTweet(driver, team, lapTime, position, sessionName) {
  const emoji = getTeamEmoji(team);
  const isP1 = position === 1;
  return `${isP1 ? '🚨 NEW FASTEST LAP!' : `⚡ P${position} goes fastest!`}\n\n` +
    `${emoji} ${driver} — ${lapTime}\n` +
    `🏎️ ${team}\n` +
    `📍 ${sessionName || 'Bahrain Testing'}\n\n` +
    `#F1 #F12026 #BahrainTest #${team.replace(/\s/g, '')}`;
}

function formatLeaderChangeTweet(newLeader, newLeaderTeam, oldLeader, gap, sessionName) {
  const emoji = getTeamEmoji(newLeaderTeam);
  return `📊 LEADER CHANGE!\n\n` +
    `${emoji} ${newLeader} takes P1!\n` +
    `Gap to ${oldLeader}: +${gap}\n` +
    `📍 ${sessionName || 'Bahrain Testing'}\n\n` +
    `#F1 #F12026 #BahrainTest`;
}

function formatPitStopTweet(driver, team, lap, tyre, sessionName) {
  const emoji = getTeamEmoji(team);
  const tyreEmoji = { 'SOFT': '🔴', 'MEDIUM': '🟡', 'HARD': '⚪', 'INTER': '🟢', 'WET': '🔵' }[tyre] || '🛞';
  return `🛞 PIT STOP — ${driver}\n\n` +
    `${emoji} ${team}\n` +
    `${tyreEmoji} Fitting ${tyre} tyres\n` +
    `📍 ${sessionName || 'Bahrain Testing'}\n\n` +
    `#F1 #F12026 #BahrainTest`;
}

function formatFlagTweet(flag, message, sessionName) {
  const flagEmojis = {
    'RED': '🔴 RED FLAG!', 'YELLOW': '🟡 YELLOW FLAG', 'SAFETY CAR': '🟡 SAFETY CAR DEPLOYED',
    'VIRTUAL SAFETY CAR': '🟡 VIRTUAL SAFETY CAR', 'CLEAR': '🟢 ALL CLEAR — Green Flag'
  };
  const flagText = flagEmojis[flag] || `🏁 ${flag}`;
  return `${flagText}\n\n` +
    `📢 ${message}\n` +
    `📍 ${sessionName || 'Bahrain Testing'}\n\n` +
    `#F1 #F12026 #BahrainTest`;
}

function formatSessionSummaryTweet(results, sessionName) {
  if (!results || results.length === 0) return null;
  const top3 = results.slice(0, 3);
  return `🏁 SESSION SUMMARY — ${sessionName || 'Bahrain Test'}\n\n` +
    `🥇 ${top3[0]?.driver} (${top3[0]?.team}) — ${top3[0]?.lapTime}\n` +
    `🥈 ${top3[1]?.driver} (${top3[1]?.team}) — ${top3[1]?.lapTime || 'N/A'}\n` +
    `🥉 ${top3[2]?.driver} (${top3[2]?.team}) — ${top3[2]?.lapTime || 'N/A'}\n\n` +
    `#F1 #F12026 #BahrainTest`;
}

// ─── F1 LIVE TIMING (SignalR via WebSocket) ─────────────────────────────────
const F1_SIGNALR_URL = 'wss://livetiming.formula1.com/signalr';
const F1_HUB = 'Streaming';
const SUBSCRIBE_TOPICS = [
  'TimingData', 'TimingAppData', 'TrackStatus', 'RaceControlMessages',
  'SessionInfo', 'DriverList', 'LapCount', 'WeatherData', 'TimingStats'
];

let reconnectTimer = null;
let connectionId = null;
let negotiated = false;

async function negotiateSignalR() {
  try {
    const url = `https://livetiming.formula1.com/signalr/negotiate?connectionData=${encodeURIComponent(JSON.stringify([{ name: F1_HUB }]))}&clientProtocol=1.5`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'BestHTTP',
        'Accept-Encoding': 'gzip, identity',
        'Connection': 'keep-alive'
      }
    });
    return res.data.ConnectionToken;
  } catch (e) {
    addLog(`SignalR negotiate failed: ${e.message}`, 'error');
    return null;
  }
}

async function connectF1LiveTiming() {
  if (f1SignalRSocket) {
    try { f1SignalRSocket.close(); } catch (e) {}
  }

  addLog('Connecting to F1 Live Timing...', 'info');

  const token = await negotiateSignalR();
  if (!token) {
    addLog('Failed to get SignalR token — retrying in 30s', 'warn');
    reconnectTimer = setTimeout(connectF1LiveTiming, 30000);
    return;
  }

  const wsUrl = `${F1_SIGNALR_URL}/connect?` +
    `transport=webSockets&` +
    `connectionToken=${encodeURIComponent(token)}&` +
    `connectionData=${encodeURIComponent(JSON.stringify([{ name: F1_HUB }]))}&` +
    `clientProtocol=1.5`;

  f1SignalRSocket = new WebSocket(wsUrl, {
    headers: {
      'User-Agent': 'BestHTTP',
      'Accept-Encoding': 'gzip, identity',
      'Connection': 'Upgrade'
    }
  });

  f1SignalRSocket.on('open', () => {
    addLog('✅ Connected to F1 Live Timing!', 'success');
    sessionActive = true;
    broadcast('connection_status', { connected: true });

    // Subscribe to topics
    const subscribeMsg = {
      H: F1_HUB,
      M: 'Subscribe',
      A: [SUBSCRIBE_TOPICS],
      I: 1
    };
    f1SignalRSocket.send(JSON.stringify(subscribeMsg));
  });

  f1SignalRSocket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleF1Message(msg);
    } catch (e) {}
  });

  f1SignalRSocket.on('close', () => {
    addLog('F1 Live Timing disconnected — reconnecting in 10s', 'warn');
    sessionActive = false;
    broadcast('connection_status', { connected: false });
    reconnectTimer = setTimeout(connectF1LiveTiming, 10000);
  });

  f1SignalRSocket.on('error', (err) => {
    addLog(`F1 WebSocket error: ${err.message}`, 'error');
  });

  // Reconnect every 90 min (SignalR timeout prevention)
  setTimeout(() => {
    addLog('Refreshing SignalR connection...', 'info');
    connectF1LiveTiming();
  }, 90 * 60 * 1000);
}

function handleF1Message(msg) {
  // Heartbeat
  if (msg.C) return;

  const messages = msg.M || [];
  messages.forEach(m => {
    if (!m.A) return;
    const [topic, data] = m.A;

    switch (topic) {
      case 'SessionInfo':
        handleSessionInfo(data);
        break;
      case 'DriverList':
        handleDriverList(data);
        break;
      case 'TimingData':
        handleTimingData(data);
        break;
      case 'TimingAppData':
        handleTimingAppData(data);
        break;
      case 'TrackStatus':
        handleTrackStatus(data);
        break;
      case 'RaceControlMessages':
        handleRaceControl(data);
        break;
      case 'WeatherData':
        broadcast('weather', data);
        break;
    }
  });

  // Initial snapshot (R field)
  if (msg.R) {
    const snap = msg.R;
    if (snap.SessionInfo) handleSessionInfo(snap.SessionInfo);
    if (snap.DriverList) handleDriverList(snap.DriverList);
    if (snap.TimingData) handleTimingData(snap.TimingData);
    if (snap.TimingAppData) handleTimingAppData(snap.TimingAppData);
    if (snap.TrackStatus) handleTrackStatus(snap.TrackStatus);
    if (snap.RaceControlMessages) {
      const msgs = snap.RaceControlMessages.Messages || {};
      Object.values(msgs).forEach(m => handleRaceControl({ Messages: { [m.Utc]: m } }));
    }
    if (snap.WeatherData) broadcast('weather', snap.WeatherData);
  }
}

function handleSessionInfo(data) {
  sessionInfo = {
    name: data.Name || sessionInfo.name,
    type: data.Type || sessionInfo.type,
    track: data.Meeting?.Circuit?.ShortName || sessionInfo.track,
    country: data.Meeting?.Country?.Name || sessionInfo.country,
    startDate: data.StartDate || sessionInfo.startDate,
  };
  broadcast('session_info', sessionInfo);
  addLog(`Session: ${sessionInfo.name} at ${sessionInfo.track}`, 'info');
}

function handleDriverList(data) {
  Object.entries(data).forEach(([num, driver]) => {
    if (typeof driver !== 'object') return;
    if (!timingData[num]) timingData[num] = {};
    timingData[num] = {
      ...timingData[num],
      driverNumber: num,
      name: driver.FullName || driver.BroadcastName || timingData[num]?.name,
      shortName: driver.Tla || timingData[num]?.shortName,
      team: driver.TeamName || timingData[num]?.team,
      teamColour: driver.TeamColour || timingData[num]?.teamColour,
    };
  });
  broadcast('timing', getSortedTiming());
}

function handleTimingData(data) {
  const lines = data.Lines || {};
  Object.entries(lines).forEach(([num, d]) => {
    if (!timingData[num]) timingData[num] = { driverNumber: num };
    const prev = { ...timingData[num] };

    if (d.Position !== undefined) timingData[num].position = parseInt(d.Position);
    if (d.GapToLeader !== undefined) timingData[num].gap = d.GapToLeader;
    if (d.IntervalToPositionAhead?.Value !== undefined) timingData[num].interval = d.IntervalToPositionAhead.Value;
    if (d.LastLapTime?.Value) timingData[num].lastLap = d.LastLapTime.Value;
    if (d.BestLapTime?.Value) timingData[num].bestLap = d.BestLapTime.Value;
    if (d.NumberOfLaps !== undefined) timingData[num].laps = d.NumberOfLaps;
    if (d.InPit !== undefined) timingData[num].inPit = d.InPit;
    if (d.PitOut !== undefined) timingData[num].pitOut = d.PitOut;
    if (d.Sectors) {
      timingData[num].sectors = d.Sectors;
    }

    // Detect pit stop
    if (autoTweetEnabled && autoTweetSettings.pitStop && d.InPit === true && prev.inPit !== true) {
      const drv = timingData[num];
      if (drv.name) {
        const tweet = formatPitStopTweet(drv.name, drv.team || 'Unknown', drv.laps || '?', drv.tyre || 'Unknown', sessionInfo.name);
        postTweet(tweet);
      }
    }

    // Detect fastest lap
    if (autoTweetEnabled && autoTweetSettings.fastestLap && d.BestLapTime?.Value) {
      checkFastestLap(num, d.BestLapTime.Value);
    }

    // Detect leader change
    if (autoTweetEnabled && autoTweetSettings.leaderChange && d.Position === 1) {
      checkLeaderChange(num);
    }
  });

  broadcast('timing', getSortedTiming());
}

function handleTimingAppData(data) {
  const lines = data.Lines || {};
  Object.entries(lines).forEach(([num, d]) => {
    if (!timingData[num]) timingData[num] = { driverNumber: num };
    if (d.Stints?.length > 0) {
      const lastStint = d.Stints[d.Stints.length - 1];
      timingData[num].tyre = lastStint.Compound || timingData[num].tyre;
      timingData[num].tyreAge = lastStint.TotalLaps || timingData[num].tyreAge;
      timingData[num].stints = d.Stints.length;
    }
  });
  broadcast('timing', getSortedTiming());
}

function handleTrackStatus(data) {
  const statusMap = {
    '1': 'ALL CLEAR', '2': 'YELLOW', '3': 'FLAG', '4': 'SAFETY CAR',
    '5': 'RED', '6': 'VIRTUAL SAFETY CAR', '7': 'VSC ENDING'
  };
  const status = statusMap[data.Status] || data.Status;
  const message = data.Message || status;
  broadcast('track_status', { status, message });
  addLog(`Track: ${status} — ${message}`, 'info');

  if (autoTweetEnabled && autoTweetSettings.flag && ['RED', 'SAFETY CAR', 'VIRTUAL SAFETY CAR'].includes(status)) {
    const tweet = formatFlagTweet(status, message, sessionInfo.name);
    postTweet(tweet);
  }
}

function handleRaceControl(data) {
  const msgs = data.Messages || {};
  Object.values(msgs).forEach(m => {
    const entry = { time: m.Utc, category: m.Category, message: m.Message, flag: m.Flag };
    raceControlMessages.unshift(entry);
    if (raceControlMessages.length > 100) raceControlMessages.pop();
    broadcast('race_control', entry);
    addLog(`RC: ${m.Message}`, 'info');
  });
}

function checkFastestLap(driverNum, lapTime) {
  const drv = timingData[driverNum];
  if (!drv || !lapTime) return;

  const toSeconds = (t) => {
    const parts = t.replace(/\+/, '').split(':');
    if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    return parseFloat(parts[0]);
  };

  const secs = toSeconds(lapTime);
  const prevSecs = sessionFastestLap.time ? toSeconds(sessionFastestLap.time) : Infinity;

  if (secs < prevSecs) {
    sessionFastestLap = { time: lapTime, driver: drv.name, team: drv.team, driverNum };
    broadcast('fastest_lap', sessionFastestLap);
    addLog(`🏆 New fastest: ${drv.name} — ${lapTime}`, 'success');
    if (autoTweetEnabled) {
      const tweet = formatFastestLapTweet(drv.name, drv.team || '', lapTime, drv.position || 1, sessionInfo.name);
      postTweet(tweet);
    }
  }
}

function checkLeaderChange(driverNum) {
  const drv = timingData[driverNum];
  if (!drv || !drv.name) return;
  if (previousLeader && previousLeader !== driverNum) {
    const oldDrv = timingData[previousLeader];
    const tweet = formatLeaderChangeTweet(drv.name, drv.team || '', oldDrv?.name || 'Previous', drv.gap || '0.000', sessionInfo.name);
    postTweet(tweet);
    broadcast('leader_change', { new: drv.name, old: oldDrv?.name });
  }
  previousLeader = driverNum;
}

function getSortedTiming() {
  return Object.values(timingData)
    .filter(d => d.name)
    .sort((a, b) => (a.position || 99) - (b.position || 99));
}

// ─── JOLPICA API (Ergast successor) ────────────────────────────────────────
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';

async function getDriverStandings() {
  const res = await axios.get(`${JOLPICA}/current/driverStandings.json`);
  return res.data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
}

async function getLastRaceResults() {
  const res = await axios.get(`${JOLPICA}/current/last/results.json`);
  return res.data.MRData.RaceTable.Races[0];
}

async function getUpcomingRaces() {
  const res = await axios.get(`${JOLPICA}/2026/schedule.json`);
  const races = res.data.MRData.RaceTable.Races;
  const now = new Date();
  return races.filter(r => new Date(r.date) >= now).slice(0, 5);
}

// ─── API ROUTES ────────────────────────────────────────────────────────────

// F1 data
app.get('/api/f1/standings', async (req, res) => {
  try { res.json({ success: true, data: await getDriverStandings() }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/f1/last-race', async (req, res) => {
  try { res.json({ success: true, data: await getLastRaceResults() }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/f1/schedule', async (req, res) => {
  try { res.json({ success: true, data: await getUpcomingRaces() }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Live timing state
app.get('/api/live/timing', (req, res) => {
  res.json({ success: true, data: getSortedTiming(), session: sessionInfo, fastest: sessionFastestLap });
});

app.get('/api/live/status', (req, res) => {
  res.json({ connected: sessionActive, session: sessionInfo, driverCount: Object.keys(timingData).length });
});

app.get('/api/live/race-control', (req, res) => {
  res.json({ success: true, data: raceControlMessages });
});

// Connect/disconnect live timing
app.post('/api/live/connect', (req, res) => {
  connectF1LiveTiming();
  res.json({ success: true, message: 'Connecting to F1 Live Timing...' });
});

app.post('/api/live/disconnect', (req, res) => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (f1SignalRSocket) f1SignalRSocket.close();
  sessionActive = false;
  res.json({ success: true, message: 'Disconnected' });
});

// Twitter config
app.post('/api/twitter/config', (req, res) => {
  const { apiKey, apiSecret, accessToken, accessSecret } = req.body;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret)
    return res.status(400).json({ success: false, error: 'All 4 credentials required' });
  twitterConfig = { apiKey, apiSecret, accessToken, accessSecret };
  res.json({ success: true });
});

app.get('/api/twitter/status', (req, res) => {
  res.json({ configured: !!twitterConfig.apiKey });
});

// Manual tweet
app.post('/api/tweet/post', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, error: 'text required' });
  const id = await postTweet(text);
  if (id) res.json({ success: true, tweetId: id });
  else res.status(500).json({ success: false, error: 'Tweet failed — check logs' });
});

// Generate tweet
app.get('/api/tweet/generate/:type', async (req, res) => {
  try {
    let tweet = '';
    const { type } = req.params;
    if (type === 'summary') {
      const sorted = getSortedTiming();
      const results = sorted.slice(0, 5).map(d => ({ driver: d.name, team: d.team, lapTime: d.bestLap }));
      tweet = formatSessionSummaryTweet(results, sessionInfo.name);
    } else if (type === 'fastest') {
      if (sessionFastestLap.driver) {
        tweet = formatFastestLapTweet(sessionFastestLap.driver, sessionFastestLap.team, sessionFastestLap.time, 1, sessionInfo.name);
      }
    } else if (type === 'standings') {
      const standings = await getDriverStandings();
      const top5 = standings.slice(0, 5);
      tweet = `🏆 F1 2026 Driver Standings\n\n` +
        top5.map((s, i) => `${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${s.Driver.familyName} — ${s.points} pts`).join('\n') +
        `\n\n#F1 #F12026`;
    } else if (type === 'schedule') {
      const races = await getUpcomingRaces();
      if (races[0]) {
        const r = races[0];
        tweet = `📅 Next Race: ${r.raceName}\n🗓️ ${r.date}\n🏟️ ${r.Circuit?.circuitName}\n\n#F1 #F12026`;
      }
    }
    res.json({ success: true, tweet: tweet || 'No data available yet' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Auto-tweet settings
app.get('/api/autotweet/settings', (req, res) => {
  res.json({ enabled: autoTweetEnabled, settings: autoTweetSettings });
});

app.post('/api/autotweet/settings', (req, res) => {
  const { enabled, settings } = req.body;
  if (enabled !== undefined) autoTweetEnabled = enabled;
  if (settings) autoTweetSettings = { ...autoTweetSettings, ...settings };
  addLog(`Auto-tweet ${autoTweetEnabled ? 'enabled' : 'disabled'}`, 'info');
  res.json({ success: true, enabled: autoTweetEnabled, settings: autoTweetSettings });
});

// Logs
app.get('/api/logs', (req, res) => {
  res.json({ success: true, data: tweetLog });
});

// Schedule
app.post('/api/schedule', async (req, res) => {
  const { id, cronExpr, tweetType, enabled } = req.body;
  if (schedules[id]) { schedules[id].stop(); delete schedules[id]; }
  if (!enabled) return res.json({ success: true });
  const task = cron.schedule(cronExpr, async () => {
    const r = await axios.get(`http://localhost:3001/api/tweet/generate/${tweetType}`);
    if (r.data.tweet) await postTweet(r.data.tweet);
  });
  schedules[id] = task;
  res.json({ success: true });
});

// ─── WEBSOCKET CLIENTS ─────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  connectedClients.add(ws);
  // Send current state on connect
  ws.send(JSON.stringify({ type: 'init', data: {
    timing: getSortedTiming(),
    session: sessionInfo,
    fastest: sessionFastestLap,
    connected: sessionActive,
    raceControl: raceControlMessages.slice(0, 20),
    logs: tweetLog.slice(0, 50)
  }}));
  ws.on('close', () => connectedClients.delete(ws));
});

server.listen(3001, () => {
  console.log('🏎️  F1 Bot v2 running on http://localhost:3001');
});
