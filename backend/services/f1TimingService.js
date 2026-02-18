const axios = require('axios');
const { WebSocket } = require('ws');

// ─── STATE ─────────────────────────────────────────────────────────────────
let timingData = {};
let sessionInfo = {};
let sessionFastest = { time: null, driver: null, team: null, driverNum: null, shortName: null };
let raceControlMessages = [];
let trackStatus = { status: 'UNKNOWN', message: '' };
let weather = {};
let sessionActive = false; // Represents SignalR connection state
let f1Socket = null;
let reconnectTimer = null;
let negotiateTimer = null;
let reconnectDelay = 5000;

// Callbacks
let broadcastFn = null;
let onEventFn = null;

const F1_SIGNALR = 'wss://livetiming.formula1.com/signalr';
const F1_HUB = 'Streaming';
const TOPICS = [
    'TimingData', 'TimingAppData', 'TrackStatus', 'RaceControlMessages',
    'SessionInfo', 'DriverList', 'WeatherData', 'LapCount', 'TimingStats'
];

let previousLeader = null;

function init(broadcast, onEvent) {
    broadcastFn = broadcast;
    onEventFn = onEvent;
}

function getState() {
    return {
        timing: getSortedTiming(),
        session: sessionInfo,
        fastest: sessionFastest,
        raceControl: raceControlMessages,
        trackStatus,
        weather,
        connected: sessionActive
    };
}

function getSortedTiming() {
    return Object.values(timingData)
        .filter(d => d.name)
        .sort((a, b) => (parseInt(a.position) || 99) - (parseInt(b.position) || 99));
}

async function negotiate() {
    try {
        const url = `https://livetiming.formula1.com/signalr/negotiate` +
            `?connectionData=${encodeURIComponent(JSON.stringify([{ name: F1_HUB }]))}` +
            `&clientProtocol=1.5&_=${Date.now()}`;

        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'Host': 'livetiming.formula1.com',
                'Origin': 'https://www.formula1.com',
                'Referer': 'https://www.formula1.com/'
            },
            timeout: 10000
        });

        return res.data.ConnectionToken;
    } catch (e) {
        log(`Negotiate failed: ${e.message}`, 'error');
        return null;
    }
}

async function connect() {
    cleanup();
    log('Connecting to F1 Live Timing stream...', 'info');
    const token = await negotiate();

    if (!token) {
        log('Failed to negotiate connection — retrying in 30s', 'warn');
        negotiateTimer = setTimeout(connect, 30000);
        return;
    }

    const wsUrl = `${F1_SIGNALR}/connect?transport=webSockets` +
        `&connectionToken=${encodeURIComponent(token)}` +
        `&connectionData=${encodeURIComponent(JSON.stringify([{ name: F1_HUB }]))}` +
        `&clientProtocol=1.5`;

    try {
        f1Socket = new WebSocket(wsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            handshakeTimeout: 15000
        });

        f1Socket.on('open', () => {
            log('Connected to F1 Live Timing', 'success');
            sessionActive = true;
            reconnectDelay = 5000;
            if (broadcastFn) broadcastFn('connection_status', { connected: true });
            f1Socket.send(JSON.stringify({ H: F1_HUB, M: 'Subscribe', A: [TOPICS], I: 1 }));

            reconnectTimer = setTimeout(() => {
                log('Connection session expired (85m) — reconnecting...', 'info');
                connect();
            }, 85 * 60 * 1000);
        });

        f1Socket.on('message', (raw) => {
            try { handleMessage(JSON.parse(raw.toString())); } catch (e) { }
        });

        f1Socket.on('close', () => {
            if (sessionActive) {
                log(`Disconnected from F1 — reconnecting in ${reconnectDelay / 1000}s`, 'warn');
                sessionActive = false;
                if (broadcastFn) broadcastFn('connection_status', { connected: false });
                reconnectTimer = setTimeout(connect, reconnectDelay);
                reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            }
        });

        f1Socket.on('error', (err) => {
            log(`F1 Connection error: ${err.message}`, 'error');
        });

    } catch (e) {
        log(`Failed to initiate connection: ${e.message}`, 'error');
        reconnectTimer = setTimeout(connect, 5000);
    }
}

function cleanup() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (negotiateTimer) clearTimeout(negotiateTimer);
    if (f1Socket) {
        f1Socket.removeAllListeners();
        try { f1Socket.terminate(); } catch (e) { }
        f1Socket = null;
    }
}

function disconnect() {
    cleanup();
    sessionActive = false;
    if (broadcastFn) broadcastFn('connection_status', { connected: false });
    log('F1 Stream disconnected manually', 'info');
}

function handleMessage(msg) {
    if (msg.C) return;
    if (msg.M && Array.isArray(msg.M)) {
        msg.M.forEach(m => {
            if (m.A && Array.isArray(m.A)) {
                processTopicData(m.A[0], m.A[1]);
            }
        });
    }
    if (msg.R) {
        const snap = msg.R;
        const keys = ['SessionInfo', 'DriverList', 'TimingData', 'TimingAppData', 'TrackStatus', 'WeatherData'];
        keys.forEach(k => { if (snap[k]) processTopicData(k, snap[k]); });
        if (snap.RaceControlMessages?.Messages) {
            Object.values(snap.RaceControlMessages.Messages).forEach(m => {
                processTopicData('RaceControlMessages', { Messages: { x: m } });
            });
        }
    }
}

function processTopicData(topic, data) {
    if (!data) return;
    try {
        switch (topic) {
            case 'SessionInfo': handleSessionInfo(data); break;
            case 'DriverList': handleDriverList(data); break;
            case 'TimingData': handleTimingData(data); break;
            case 'TimingAppData': handleTimingAppData(data); break;
            case 'TrackStatus': handleTrackStatus(data); break;
            case 'RaceControlMessages': handleRaceControl(data); break;
            case 'WeatherData':
                weather = { ...weather, ...data };
                if (broadcastFn) broadcastFn('weather', weather);
                break;
        }
    } catch (e) {
        log(`Error processing ${topic}: ${e.message}`, 'error');
    }
}

function handleSessionInfo(data) {
    sessionInfo = {
        name: data.Name || sessionInfo.name,
        type: data.Type || sessionInfo.type,
        track: data.Meeting?.Circuit?.ShortName || sessionInfo.track,
        country: data.Meeting?.Country?.Name || sessionInfo.country,
        status: data.Status || sessionInfo.status
    };
    if (broadcastFn) broadcastFn('session_info', sessionInfo);
}

function handleDriverList(data) {
    Object.entries(data).forEach(([num, d]) => {
        const key = String(num);
        if (!timingData[key]) timingData[key] = { driverNumber: key };
        timingData[key] = {
            ...timingData[key],
            name: d.FullName || d.BroadcastName || timingData[key].name,
            shortName: d.Tla || timingData[key].shortName,
            team: d.TeamName || timingData[key].team,
            teamColour: d.TeamColour || timingData[key].teamColour,
        };
    });
    if (broadcastFn) broadcastFn('timing', getSortedTiming());
}

function handleTimingData(data) {
    const lines = data.Lines || {};
    Object.entries(lines).forEach(([num, d]) => {
        const key = String(num);
        if (!timingData[key]) timingData[key] = { driverNumber: key };
        const prev = { ...timingData[key] };

        if (d.Position) timingData[key].position = parseInt(d.Position);

        // --- FIX 3: GAP PARSING ---
        if (d.GapToLeader !== undefined) {
            let gap = d.GapToLeader;
            if (timingData[key].position === 1) {
                gap = 'LEADER';
            } else if (!gap || gap === "") {
                gap = '—';
            }
            // Log for debugging as requested
            console.log(`[GAP] Driver ${key}: ${gap}`);
            timingData[key].gap = gap;
        }

        if (d.IntervalToPositionAhead?.Value !== undefined) {
            timingData[key].interval = d.IntervalToPositionAhead.Value;
        }

        if (d.LastLapTime?.Value) timingData[key].lastLap = d.LastLapTime.Value;
        if (d.BestLapTime?.Value) timingData[key].bestLap = d.BestLapTime.Value;
        if (d.NumberOfLaps !== undefined) timingData[key].laps = d.NumberOfLaps;
        if (d.InPit !== undefined) timingData[key].inPit = d.InPit;
        if (d.PitOut !== undefined) timingData[key].pitOut = d.PitOut;

        if (d.InPit === true && prev.inPit === false && timingData[key].name) {
            if (onEventFn) onEventFn('pit_stop', {
                driver: timingData[key].name, team: timingData[key].team,
                driverCode: timingData[key].shortName, lap: timingData[key].laps,
                session: sessionInfo.name
            });
        }

        if (d.Position === 1 && previousLeader && previousLeader !== key) {
            if (onEventFn) onEventFn('leader_change', {
                newDriver: timingData[key].name, newTeam: timingData[key].team,
                oldDriver: timingData[previousLeader]?.name, session: sessionInfo.name
            });
        }
        if (d.Position === 1) previousLeader = key;

        if (d.BestLapTime?.Value) checkFastestLap(key, d.BestLapTime.Value);
    });
    if (broadcastFn) broadcastFn('timing', getSortedTiming());
}

function handleTimingAppData(data) {
    const lines = data.Lines || {};
    Object.entries(lines).forEach(([num, d]) => {
        const key = String(num);
        if (!timingData[key]) timingData[key] = { driverNumber: key };

        // --- FIX 4: TYRE PARSING ---
        const stints = d.Stints;
        let stintsArray = [];
        if (Array.isArray(stints)) {
            stintsArray = stints;
        } else if (stints && typeof stints === 'object') {
            stintsArray = Object.values(stints);
        }

        if (stintsArray.length > 0) {
            const currentStint = stintsArray[stintsArray.length - 1];
            const compound = currentStint.Compound || currentStint.compound;
            timingData[key].tyre = compound ? compound.toUpperCase() : 'UNKNOWN';
            timingData[key].tyreAge = currentStint.TotalLaps || 0;
        }
    });
    if (broadcastFn) broadcastFn('timing', getSortedTiming());
}

function handleTrackStatus(data) {
    const statusMap = {
        '1': 'ALL CLEAR', '2': 'YELLOW FLAG', '4': 'SAFETY CAR',
        '5': 'RED FLAG', '6': 'VIRTUAL SAFETY CAR', '7': 'VSC ENDING'
    };
    trackStatus = { status: statusMap[data.Status] || 'UNKNOWN', message: data.Message || '' };
    if (broadcastFn) broadcastFn('track_status', trackStatus);

    if (['RED FLAG', 'SAFETY CAR', 'VIRTUAL SAFETY CAR'].includes(trackStatus.status)) {
        if (onEventFn) onEventFn('flag', { flagType: trackStatus.status, message: trackStatus.message, session: sessionInfo.name });
    }
}

function handleRaceControl(data) {
    const msgs = data.Messages || {};
    Object.values(msgs).forEach(m => {
        const entry = { time: m.Utc || new Date().toISOString(), message: m.Message, flag: m.Flag };
        if (!raceControlMessages.some(rm => rm.message === entry.message && rm.time === entry.time)) {
            raceControlMessages.unshift(entry);
            if (raceControlMessages.length > 50) raceControlMessages.pop();
            if (broadcastFn) broadcastFn('race_control', entry);
        }
    });
}

function checkFastestLap(driverNum, lapTime) {
    const key = String(driverNum);
    const drv = timingData[key];
    if (!drv || !lapTime || lapTime === '0:00.000') return;

    const parseTime = t => {
        const p = t.replace(/\+/, '').split(':');
        return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(p[0]);
    };

    const currentSecs = parseTime(lapTime);
    const sessionBestSecs = sessionFastest.time ? parseTime(sessionFastest.time) : Infinity;

    if (currentSecs < sessionBestSecs && currentSecs > 10) {
        const prev = { ...sessionFastest };
        sessionFastest = { time: lapTime, driver: drv.name, team: drv.team, driverNum, shortName: drv.shortName };
        if (broadcastFn) broadcastFn('fastest_lap', sessionFastest);
        if (onEventFn) onEventFn('fastest_lap', {
            driver: drv.name, team: drv.team, driverCode: drv.shortName,
            lapTime, prevTime: prev.time, prevDriver: prev.driver, session: sessionInfo.name
        });
    }
}

function log(msg, level = 'info') {
    console.log(`[F1][${level.toUpperCase()}] ${msg}`);
    if (broadcastFn) broadcastFn('log', { msg, level, time: new Date().toISOString() });
}

module.exports = { init, connect, disconnect, getState, getSortedTiming };
