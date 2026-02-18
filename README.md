# 🏎️ F1 Bot v2 — Live Timing + Auto Twitter

Auto-tweets real F1 data the same way **RacingNews365**, **Racing_Statistics on Twitch**, and **MultiViewer** do — using F1's own live timing stream. **100% free.**

## 🎯 What It Does

- 🔴 **Connects to `livetiming.formula1.com`** — the same stream every Twitch streamer uses
- ⚡ **Auto-tweets** on: fastest laps, leader changes, pit stops, safety cars, red flags
- ✍️ **Manual compose** with live data pre-fill
- ⏰ **Scheduled tweets** — standings, summaries, race previews
- 📊 **Live timing tower** — positions, gaps, tyres, sector times
- 📢 **Race control messages** — flags, penalties, incidents
- 🌤️ **Weather data** — air temp, track temp, rain

---

## 🚀 Quick Start

### 1. Backend
```bash
cd backend
npm install
npm start
# → http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
npm install
npm start
# → http://localhost:3000
```

### 3. Connect to Live Timing
Click **▶ CONNECT** in the top right of the dashboard.

### 4. Add Twitter Credentials
Go to ⚙️ **Settings** → paste your 4 Twitter API keys → Save.

### 5. Enable Auto-Tweets
Go to 🤖 **Auto-Tweet** → toggle ON → choose what events to tweet.

---

## 🐦 Getting Twitter API Keys

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Create a project + app (Free tier)
3. Enable **OAuth 1.0a** with **Read + Write** permissions
4. Generate **Access Token + Secret** (make sure it has write access)
5. You need all 4: API Key, API Secret, Access Token, Access Token Secret

---

## 📡 Data Sources (All Free)

| Source | What | Cost |
|--------|------|------|
| `livetiming.formula1.com` | Live lap times, positions, tyres, flags | **Free** |
| Jolpica API | Standings, race results, calendar | **Free** |

> Same source as: RacingNews365, Autosport, FastF1, MultiViewer, Racing_Statistics Twitch

---

## 🤖 Auto-Tweet Events

| Trigger | Example Tweet |
|---------|---------------|
| Fastest Lap | `🚨 NEW FASTEST LAP! Leclerc — 1:33.739 🔴 Ferrari #F12026` |
| Leader Change | `📊 LEADER CHANGE! Norris takes P1! #F1` |
| Pit Stop | `🛞 PIT STOP — Verstappen fitting Medium tyres` |
| Red Flag | `🔴 RED FLAG! Session stopped #BahrainTest` |
| Safety Car | `🟡 SAFETY CAR DEPLOYED #F12026` |
| Session Summary | `🏁 SESSION SUMMARY — Top 3 results` |

---

## ⏰ Rate Limiting
Minimum 2 minutes between auto-tweets (configurable 1-5 min) to avoid spamming.

---

## 📁 Structure
```
f1-bot-v2/
├── backend/
│   ├── server.js       # Express + SignalR + Twitter
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx     # Full dashboard UI
    │   └── index.js
    └── package.json
```
