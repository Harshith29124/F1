const axios = require('axios');

const BASE = 'https://api.jolpi.ca/ergast/f1';
const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function cached(key, fn) {
    const now = Date.now();
    if (cache[key] && now - cache[key].ts < CACHE_TTL) return cache[key].data;
    try {
        const data = await fn();
        cache[key] = { data, ts: now };
        return data;
    } catch (err) {
        console.error(`[Jolpica] Error fetching ${key}:`, err.message);
        return cache[key] ? cache[key].data : null; // Fallback to stale or null
    }
}

async function getDriverStandings() {
    return cached('driverStandings', async () => {
        // Try current, fallback to 2025 if it's early season
        try {
            const res = await axios.get(`${BASE}/current/driverStandings.json`, { timeout: 10000 });
            return res.data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
        } catch (e) {
            const res = await axios.get(`${BASE}/2025/driverStandings.json`, { timeout: 10000 });
            return res.data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
        }
    });
}

async function getConstructorStandings() {
    return cached('constructorStandings', async () => {
        try {
            const res = await axios.get(`${BASE}/current/constructorStandings.json`, { timeout: 10000 });
            return res.data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
        } catch (e) {
            const res = await axios.get(`${BASE}/2025/constructorStandings.json`, { timeout: 10000 });
            return res.data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
        }
    });
}

async function getLastRaceResults() {
    return cached('lastRace', async () => {
        try {
            const res = await axios.get(`${BASE}/current/last/results.json`, { timeout: 10000 });
            return res.data.MRData.RaceTable.Races[0] || null;
        } catch (e) {
            // Fallback to last race of 2025
            const res = await axios.get(`${BASE}/2025/last/results.json`, { timeout: 10000 });
            return res.data.MRData.RaceTable.Races[0] || null;
        }
    });
}

async function getUpcomingRaces() {
    return cached('schedule', async () => {
        try {
            const res = await axios.get(`${BASE}/current.json`, { timeout: 10000 });
            const races = res.data.MRData.RaceTable.Races || [];
            const now = new Date();
            return races.filter(r => new Date(r.date) >= now);
        } catch (e) {
            return [];
        }
    });
}

async function getDriverInfo(driverId) {
    return cached(`driver_${driverId}`, async () => {
        const res = await axios.get(`${BASE}/drivers/${driverId}.json`, { timeout: 10000 });
        return res.data.MRData.DriverTable.Drivers[0] || null;
    });
}

module.exports = { getDriverStandings, getConstructorStandings, getLastRaceResults, getUpcomingRaces, getDriverInfo };
