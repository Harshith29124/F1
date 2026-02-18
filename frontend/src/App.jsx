import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = "ws://localhost:3001";
const API = "http://localhost:3001/api";

const TEAM_COLORS = {
  'Ferrari': '#e8002d', 'McLaren': '#ff8000', 'Mercedes': '#00d2be',
  'Red Bull': '#3671c6', 'Alpine': '#0090ff', 'Williams': '#64c4ff',
  'Aston Martin': '#358c75', 'Haas': '#b6babd', 'Racing Bulls': '#6692ff',
  'Audi': '#ffffff', 'Cadillac': '#c8102e', 'Kick Sauber': '#52e252'
};

const TYRE_COLORS = { 'SOFT': '#e8002d', 'MEDIUM': '#ffd700', 'HARD': '#ffffff', 'INTER': '#39b54a', 'WET': '#0067ff' };

const TABS = [
  { id: 'live', label: '🔴 Live', pulse: true },
  { id: 'compose', label: '✍️ Compose' },
  { id: 'autotweet', label: '🤖 Auto-Tweet' },
  { id: 'schedule', label: '⏰ Schedule' },
  { id: 'standings', label: '🏆 Standings' },
  { id: 'settings', label: '⚙️ Settings' },
  { id: 'logs', label: '📋 Logs' },
];

export default function App() {
  const [tab, setTab] = useState('live');
  const [f1Connected, setF1Connected] = useState(false);
  const [timing, setTiming] = useState([]);
  const [session, setSession] = useState({});
  const [fastest, setFastest] = useState({});
  const [raceControl, setRaceControl] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tweetFeed, setTweetFeed] = useState([]);
  const [weather, setWeather] = useState({});
  const [trackStatus, setTrackStatus] = useState({ status: 'UNKNOWN', message: '' });

  // Twitter / compose
  const [twitterCreds, setTwitterCreds] = useState({ apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' });
  const [twitterSaved, setTwitterSaved] = useState(false);
  const [tweetText, setTweetText] = useState('');
  const [tweetStatus, setTweetStatus] = useState(null);

  // Auto-tweet
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoSettings, setAutoSettings] = useState({
    fastestLap: true, leaderChange: true, pitStop: true, flag: true, sessionSummary: true, minIntervalSeconds: 120
  });

  // Standings
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // Schedules
  const [schedules, setSchedules] = useState([]);
  const [newSched, setNewSched] = useState({ tweetType: 'summary', cronPreset: '0 */6 * * *', customCron: '' });

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // ── WebSocket ──────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => { wsRef.current = socket; };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'init':
          setTiming(msg.data.timing || []);
          setSession(msg.data.session || {});
          setFastest(msg.data.fastest || {});
          setF1Connected(msg.data.connected);
          setRaceControl(msg.data.raceControl || []);
          setLogs(msg.data.logs || []);
          break;
        case 'timing': setTiming(msg.data); break;
        case 'session_info': setSession(msg.data); break;
        case 'fastest_lap': setFastest(msg.data); break;
        case 'race_control': setRaceControl(p => [msg.data, ...p].slice(0, 50)); break;
        case 'track_status': setTrackStatus(msg.data); break;
        case 'weather': setWeather(msg.data); break;
        case 'connection_status': setF1Connected(msg.data.connected); break;
        case 'tweet_posted': setTweetFeed(p => [{ text: msg.data.text, id: msg.data.tweetId, time: msg.timestamp }, ...p].slice(0, 30)); break;
        case 'log': setLogs(p => [msg.data, ...p].slice(0, 200)); break;
        default: break;
      }
    };

    socket.onclose = () => {
      wsRef.current = null;
      reconnectRef.current = setTimeout(connectWS, 3000);
    };
  }, []);

  useEffect(() => {
    connectWS();
    return () => { if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close(); };
  }, [connectWS]);

  // ── Actions ────────────────────────────────────────────────────────────
  const connectF1 = () => fetch(`${API}/live/connect`, { method: 'POST' });
  const disconnectF1 = () => fetch(`${API}/live/disconnect`, { method: 'POST' });

  const saveCreds = async () => {
    const res = await fetch(`${API}/twitter/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(twitterCreds)
    });
    const d = await res.json();
    if (d.success) setTwitterSaved(true);
  };

  const postTweet = async () => {
    if (!tweetText.trim()) return;
    setTweetStatus('posting');
    const res = await fetch(`${API}/tweet/post`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tweetText })
    });
    const d = await res.json();
    setTweetStatus(d.success ? 'success' : 'error');
    setTimeout(() => setTweetStatus(null), 3000);
  };

  const generateTweet = async (type) => {
    const res = await fetch(`${API}/tweet/generate/${type}`);
    const d = await res.json();
    if (d.tweet) setTweetText(d.tweet);
    setTab('compose');
  };

  const saveAutoSettings = async (newEnabled = autoEnabled, newSettings = autoSettings) => {
    await fetch(`${API}/autotweet/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabled, settings: newSettings })
    });
  };

  const fetchStandings = async () => {
    setLoadingStandings(true);
    const res = await fetch(`${API}/f1/standings`);
    const d = await res.json();
    if (d.success) setStandings(d.data);
    setLoadingStandings(false);
  };

  useEffect(() => { if (tab === 'standings') fetchStandings(); }, [tab]);

  const addSchedule = async () => {
    const cronExpr = newSched.cronPreset === 'custom' ? newSched.customCron : newSched.cronPreset;
    const id = `sched_${Date.now()}`;
    await fetch(`${API}/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cronExpr, tweetType: newSched.tweetType, enabled: true })
    });
    setSchedules(p => [...p, { id, cronExpr, tweetType: newSched.tweetType }]);
  };

  const removeSchedule = async (id) => {
    await fetch(`${API}/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: false })
    });
    setSchedules(p => p.filter(s => s.id !== id));
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const charCount = tweetText.length;
  const charColor = charCount > 280 ? '#e8002d' : charCount > 240 ? '#ffd700' : '#39b54a';
  const statusColor = { 'ALL CLEAR': '#39b54a', 'YELLOW': '#ffd700', 'RED': '#e8002d', 'SAFETY CAR': '#ffd700', 'VIRTUAL SAFETY CAR': '#ffd700' };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#08080f', color: '#e8e8e8', fontFamily: "'Titillium Web', 'Arial Narrow', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: #0d0d1a; } ::-webkit-scrollbar-thumb { background: #e8002d; }
        .pulse { animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .slide-in { animation: slideIn 0.3s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .input { background: #0d0d1a; border: 1px solid #1e1e3a; border-radius: 4px; padding: 9px 12px; color: #e8e8e8; font-family: inherit; font-size: 13px; width: 100%; }
        .input:focus { outline: none; border-color: #e8002d; }
        select.input { cursor: pointer; }
        .btn { border: none; border-radius: 4px; padding: 9px 18px; font-family: inherit; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; cursor: pointer; transition: all 0.15s; }
        .btn-red { background: #e8002d; color: #fff; } .btn-red:hover { background: #ff1a3d; transform: translateY(-1px); }
        .btn-ghost { background: transparent; border: 1px solid #2a2a4a; color: #888; } .btn-ghost:hover { border-color: #e8002d; color: #fff; }
        .btn-green { background: #1a3a1a; border: 1px solid #39b54a; color: #39b54a; } .btn-green:hover { background: #39b54a; color: #fff; }
        .card { background: #0d0d1a; border: 1px solid #1a1a2e; border-radius: 6px; }
        .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #111122; }
        .row:last-child { border-bottom: none; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media(max-width:700px) { .grid2 { grid-template-columns: 1fr; } }
        textarea.input { resize: vertical; min-height: 110px; line-height: 1.5; }
        .toggle { position: relative; width: 44px; height: 24px; cursor: pointer; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; inset: 0; background: #1e1e3a; border-radius: 24px; transition: 0.3s; }
        .toggle-slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #555; border-radius: 50%; transition: 0.3s; }
        .toggle input:checked + .toggle-slider { background: #1a3a1a; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); background: #39b54a; }
        .tyre-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .sector { font-family: monospace; font-size: 11px; padding: 1px 4px; border-radius: 2px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: '#0a0a14', borderBottom: '1px solid #1a1a2e' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 26 }}>🏎️</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 4, textTransform: 'uppercase', color: '#fff' }}>
                  F1 <span style={{ color: '#e8002d' }}>BOT</span> <span style={{ color: '#444', fontSize: 12 }}>v2.0</span>
                </div>
                <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>Live Timing + Auto Twitter</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Track status */}
              <div style={{ padding: '4px 10px', background: '#0d0d1a', border: `1px solid ${statusColor[trackStatus.status] || '#333'}`, borderRadius: 4, fontSize: 11, color: statusColor[trackStatus.status] || '#555', fontWeight: 700 }}>
                ● {trackStatus.status}
              </div>
              {/* F1 connection */}
              <button className={`btn ${f1Connected ? 'btn-ghost' : 'btn-red'}`} onClick={f1Connected ? disconnectF1 : connectF1} style={{ fontSize: 11, padding: '6px 12px' }}>
                {f1Connected ? <span><span className="pulse" style={{ color: '#39b54a' }}>●</span> LIVE</span> : '▶ CONNECT'}
              </button>
              {/* Twitter status */}
              <div className="tag" style={{ background: twitterSaved ? '#0a1a0a' : '#1a0a0a', color: twitterSaved ? '#39b54a' : '#666', border: `1px solid ${twitterSaved ? '#39b54a' : '#333'}` }}>
                {twitterSaved ? '🐦 Connected' : '🐦 Not set'}
              </div>
              {/* Auto-tweet */}
              {autoEnabled && <div className="tag pulse" style={{ background: '#1a0a00', color: '#e8002d', border: '1px solid #e8002d' }}>🤖 AUTO ON</div>}
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px',
                color: tab === t.id ? '#e8002d' : '#555', fontFamily: 'inherit', fontSize: 12,
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5,
                borderBottom: `2px solid ${tab === t.id ? '#e8002d' : 'transparent'}`,
                transition: 'all 0.15s'
              }}>
                {t.label}
                {t.pulse && f1Connected && <span className="pulse" style={{ marginLeft: 4, color: '#39b54a', fontSize: 8 }}>●</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px' }}>

        {/* ══ LIVE TAB ══ */}
        {tab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Session header */}
            {session.name && (
              <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 900, fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: 2 }}>{session.name}</span>
                  <span style={{ color: '#555', marginLeft: 12, fontSize: 12 }}>{session.track} · {session.country}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
                  {weather.AirTemp && <span>🌡️ {weather.AirTemp}°C</span>}
                  {weather.TrackTemp && <span>🛣️ {weather.TrackTemp}°C</span>}
                  {weather.WindSpeed && <span>💨 {weather.WindSpeed}m/s</span>}
                  {weather.Rainfall === 'true' && <span style={{ color: '#0067ff' }}>🌧️ Rain</span>}
                </div>
              </div>
            )}

            {/* Fastest lap banner */}
            {fastest.driver && (
              <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #1a0a0a, #0d0d1a)', border: '1px solid #e8002d', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>⚡</span>
                <span style={{ color: '#e8002d', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, fontSize: 12 }}>Fastest Lap</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{fastest.driver}</span>
                <span style={{ color: '#555', fontSize: 12 }}>{fastest.team}</span>
                <span style={{ fontFamily: 'monospace', color: '#e8002d', fontWeight: 900, fontSize: 15, marginLeft: 'auto' }}>{fastest.time}</span>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => generateTweet('fastest')}>Tweet</button>
              </div>
            )}

            <div className="grid2">
              {/* Timing Tower */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#555' }}>Timing Tower</div>
                  <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => generateTweet('summary')}>Tweet Summary</button>
                </div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '30px 28px 1fr 80px 80px 60px 30px', gap: 6, padding: '8px 14px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#444', borderBottom: '1px solid #111' }}>
                    <span>P</span><span>#</span><span>Driver</span><span>Best</span><span>Gap</span><span>Tyre</span><span>Lap</span>
                  </div>
                  {timing.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#333' }}>
                      {f1Connected ? <><span className="pulse">●</span> Waiting for data...</> : 'Click CONNECT to start live timing'}
                    </div>
                  ) : timing.map((d, i) => (
                    <div key={d.driverNumber} className="slide-in" style={{
                      display: 'grid', gridTemplateColumns: '30px 28px 1fr 80px 80px 60px 30px',
                      gap: 6, padding: '9px 14px', borderBottom: '1px solid #0d0d1a',
                      background: i === 0 ? 'rgba(232,0,45,0.04)' : 'transparent',
                      borderLeft: `2px solid ${TEAM_COLORS[d.team] || '#333'}`
                    }}>
                      <span style={{ fontWeight: 900, fontSize: 13, color: i < 3 ? ['#e8002d', '#aaa', '#cd7f32'][i] : '#555' }}>
                        {d.position || i + 1}
                      </span>
                      <span style={{ fontSize: 11, color: '#444', fontFamily: 'monospace' }}>{d.driverNumber}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{d.shortName || d.name?.split(' ').pop()}</div>
                        <div style={{ fontSize: 10, color: TEAM_COLORS[d.team] || '#555' }}>{d.team}</div>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: d.bestLap === fastest.time ? '#e8002d' : '#ccc' }}>
                        {d.bestLap || '—'}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#555' }}>{d.gap || (i === 0 ? 'LEADER' : '—')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {d.tyre && <span className="tyre-dot" style={{ background: TYRE_COLORS[d.tyre] || '#555' }} />}
                        <span style={{ fontSize: 10, color: TYRE_COLORS[d.tyre] || '#555' }}>{d.tyre?.charAt(0) || '?'}</span>
                        {d.inPit && <span style={{ fontSize: 9, color: '#ffd700' }}>PIT</span>}
                      </div>
                      <span style={{ fontSize: 11, color: '#444', fontFamily: 'monospace' }}>{d.laps || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: Race Control + Tweet Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Race Control */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#555', marginBottom: 10 }}>Race Control</div>
                  <div className="card" style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {raceControl.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#333', fontSize: 12 }}>No messages</div>
                    ) : raceControl.map((m, i) => (
                      <div key={i} className="row" style={{ padding: '8px 12px', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#444', fontFamily: 'monospace', flexShrink: 0 }}>
                          {new Date(m.time).toLocaleTimeString()}
                        </span>
                        {m.flag && <span className="tag" style={{ background: '#1a0a0a', color: m.flag === 'RED' ? '#e8002d' : m.flag === 'YELLOW' ? '#ffd700' : '#39b54a', border: `1px solid currentColor` }}>{m.flag}</span>}
                        <span style={{ fontSize: 12, color: '#ccc', flex: 1 }}>{m.message}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto-tweeted feed */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#555', marginBottom: 10 }}>🐦 Tweeted</div>
                  <div className="card" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {tweetFeed.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#333', fontSize: 12 }}>No tweets yet</div>
                    ) : tweetFeed.map((t, i) => (
                      <div key={i} className="row" style={{ padding: '8px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        <div style={{ fontSize: 10, color: '#444' }}>{new Date(t.time).toLocaleTimeString()}</div>
                        <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.4 }}>{t.text.substring(0, 120)}...</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ COMPOSE TAB ══ */}
        {tab === 'compose' && (
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3, color: '#fff' }}>
              Compose <span style={{ color: '#e8002d' }}>Tweet</span>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#555', marginBottom: 12 }}>Quick Generate</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { type: 'summary', label: '🏁 Session Summary' },
                  { type: 'fastest', label: '⚡ Fastest Lap' },
                  { type: 'standings', label: '🏆 Standings' },
                  { type: 'schedule', label: '📅 Next Race' },
                ].map(t => (
                  <button key={t.type} className="btn btn-ghost" onClick={() => generateTweet(t.type)}>{t.label}</button>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#555' }}>Tweet</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: charColor }}>{charCount}/280</div>
              </div>
              <textarea className="input" value={tweetText} onChange={e => setTweetText(e.target.value)} placeholder="Generate or write your F1 tweet..." />
              <div style={{ marginTop: 6, height: 2, background: '#1a1a2e', borderRadius: 1 }}>
                <div style={{ height: '100%', width: `${Math.min((charCount / 280) * 100, 100)}%`, background: charColor, borderRadius: 1, transition: 'all 0.2s' }} />
              </div>
            </div>

            <button className="btn btn-red" style={{ width: '100%', padding: 14, fontSize: 14, borderRadius: 6 }}
              onClick={postTweet} disabled={!tweetText.trim() || charCount > 280 || tweetStatus === 'posting'}>
              {tweetStatus === 'posting' ? '🔄 Posting...' : tweetStatus === 'success' ? '✅ Posted!' : tweetStatus === 'error' ? '❌ Failed' : '🐦 Post Tweet Now'}
            </button>

            {!twitterSaved && (
              <div style={{ padding: 10, background: '#1a0a00', border: '1px solid #e8002d', borderRadius: 4, fontSize: 12, color: '#e8002d' }}>
                ⚠️ Twitter not configured — go to Settings
              </div>
            )}
          </div>
        )}

        {/* ══ AUTO-TWEET TAB ══ */}
        {tab === 'autotweet' && (
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3, color: '#fff' }}>
              Auto <span style={{ color: '#e8002d' }}>Tweet</span>
            </div>

            {/* Master toggle */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Auto-Tweeting</div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Automatically tweet on F1 events</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={autoEnabled} onChange={e => { setAutoEnabled(e.target.checked); saveAutoSettings(e.target.checked); }} />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Event toggles */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#555', borderBottom: '1px solid #111' }}>
                Tweet on these events
              </div>
              {[
                { key: 'fastestLap', label: '⚡ New Fastest Lap', desc: 'When any driver sets a new session best' },
                { key: 'leaderChange', label: '📊 Leader Change', desc: 'When position 1 changes hands' },
                { key: 'pitStop', label: '🛞 Pit Stop', desc: 'When a driver pits' },
                { key: 'flag', label: '🚩 Flags & Safety Cars', desc: 'Red flag, SC, VSC, incidents' },
                { key: 'sessionSummary', label: '🏁 Session End Summary', desc: 'Full top 5 at end of session' },
              ].map(item => (
                <div key={item.key} className="row" style={{ padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={autoSettings[item.key]}
                      onChange={e => {
                        const ns = { ...autoSettings, [item.key]: e.target.checked };
                        setAutoSettings(ns); saveAutoSettings(autoEnabled, ns);
                      }} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>

            {/* Rate limit */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>⏱️ Min. Interval Between Tweets</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[60, 120, 180, 300].map(s => (
                  <button key={s} className={`btn ${autoSettings.minIntervalSeconds === s ? 'btn-red' : 'btn-ghost'}`}
                    onClick={() => { const ns = { ...autoSettings, minIntervalSeconds: s }; setAutoSettings(ns); saveAutoSettings(autoEnabled, ns); }}>
                    {s < 60 ? `${s}s` : `${s / 60}min`}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#555' }}>
                Current: {autoSettings.minIntervalSeconds}s — prevents spam
              </div>
            </div>

            {autoEnabled && !twitterSaved && (
              <div style={{ padding: 10, background: '#1a0a00', border: '1px solid #e8002d', borderRadius: 4, fontSize: 12, color: '#e8002d' }}>
                ⚠️ Auto-tweet is ON but Twitter not configured — go to Settings!
              </div>
            )}
          </div>
        )}

        {/* ══ SCHEDULE TAB ══ */}
        {tab === 'schedule' && (
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3, color: '#fff' }}>
              Scheduled <span style={{ color: '#e8002d' }}>Tweets</span>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#555', marginBottom: 12 }}>New Schedule</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Type</label>
                  <select className="input" value={newSched.tweetType} onChange={e => setNewSched(p => ({ ...p, tweetType: e.target.value }))}>
                    <option value="summary">🏁 Session Summary</option>
                    <option value="standings">🏆 Driver Standings</option>
                    <option value="schedule">📅 Next Race</option>
                    <option value="fastest">⚡ Session Fastest Lap</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>Frequency</label>
                  <select className="input" value={newSched.cronPreset} onChange={e => setNewSched(p => ({ ...p, cronPreset: e.target.value }))}>
                    <option value="0 * * * *">Every hour</option>
                    <option value="0 */6 * * *">Every 6 hours</option>
                    <option value="0 9 * * *">Daily at 9am</option>
                    <option value="0 17 * * 0">Sundays at 5pm</option>
                    <option value="0 9 * * 1">Mondays at 9am</option>
                    <option value="custom">Custom cron</option>
                  </select>
                </div>
                {newSched.cronPreset === 'custom' && (
                  <input className="input" placeholder="e.g. 0 14 * * 0" value={newSched.customCron} onChange={e => setNewSched(p => ({ ...p, customCron: e.target.value }))} />
                )}
                <button className="btn btn-red" onClick={addSchedule}>+ Add Schedule</button>
              </div>
            </div>

            {schedules.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#333', padding: 40 }}>No active schedules</div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                {schedules.map(s => (
                  <div key={s.id} className="row" style={{ padding: '12px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.tweetType}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#555', marginTop: 2 }}>{s.cronExpr}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="tag pulse" style={{ background: '#0a1a0a', color: '#39b54a', border: '1px solid #39b54a' }}>● ACTIVE</span>
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px', color: '#e8002d', borderColor: '#e8002d' }} onClick={() => removeSchedule(s.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STANDINGS TAB ══ */}
        {tab === 'standings' && (
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3, color: '#fff' }}>
                Driver <span style={{ color: '#e8002d' }}>Standings</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={fetchStandings}>↻ Refresh</button>
                <button className="btn btn-red" onClick={() => generateTweet('standings')}>Tweet Top 5</button>
              </div>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {loadingStandings ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#555' }} className="pulse">Loading...</div>
              ) : standings.map((s, i) => (
                <div key={i} className="row" style={{ padding: '12px 16px', borderLeft: `2px solid ${TEAM_COLORS[s.Constructors?.[0]?.name] || '#333'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: i < 3 ? ['#e8002d', '#aaa', '#cd7f32'][i] : '#444', width: 24, textAlign: 'center' }}>
                      {s.position}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{s.Driver.givenName} {s.Driver.familyName}</div>
                      <div style={{ fontSize: 11, color: TEAM_COLORS[s.Constructors?.[0]?.name] || '#555', marginTop: 2 }}>{s.Constructors?.[0]?.name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', fontFamily: 'monospace' }}>{s.points}</div>
                    <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ SETTINGS TAB ══ */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3, color: '#fff' }}>
              Twitter <span style={{ color: '#e8002d' }}>API</span>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
                Get credentials at <a href="https://developer.twitter.com" target="_blank" rel="noreferrer" style={{ color: '#1da1f2' }}>developer.twitter.com</a> — create a project, enable OAuth 1.0a with <strong style={{ color: '#fff' }}>Read + Write</strong>.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'apiKey', label: 'API Key' },
                  { key: 'apiSecret', label: 'API Secret' },
                  { key: 'accessToken', label: 'Access Token' },
                  { key: 'accessSecret', label: 'Access Token Secret' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input type="password" className="input" value={twitterCreds[f.key]} onChange={e => setTwitterCreds(p => ({ ...p, [f.key]: e.target.value }))} placeholder={`Enter ${f.label}`} />
                  </div>
                ))}
                <button className="btn btn-red" style={{ marginTop: 4, padding: 12 }} onClick={saveCreds}>Save Credentials</button>
              </div>
              {twitterSaved && (
                <div style={{ marginTop: 10, padding: 10, background: '#0a1a0a', border: '1px solid #39b54a', borderRadius: 4, fontSize: 12, color: '#39b54a' }}>
                  ✅ Connected & ready to tweet
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#555', marginBottom: 12 }}>Data Sources</div>
              {[
                { name: 'F1 Live Timing', desc: 'livetiming.formula1.com SignalR', status: f1Connected ? 'LIVE' : 'OFFLINE' },
                { name: 'Jolpica API', desc: 'Standings, results, schedule', status: 'FREE' },
              ].map((s, i) => (
                <div key={i} className="row" style={{ padding: '10px 0' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{s.desc}</div>
                  </div>
                  <span className="tag" style={{
                    background: s.status === 'LIVE' ? '#0a1a0a' : '#0a0a1a',
                    color: s.status === 'LIVE' ? '#39b54a' : s.status === 'FREE' ? '#00d2be' : '#555',
                    border: `1px solid ${s.status === 'LIVE' ? '#39b54a' : s.status === 'FREE' ? '#00d2be' : '#333'}`
                  }}>
                    {s.status === 'LIVE' && <span className="pulse">● </span>}{s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ LOGS TAB ══ */}
        {tab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3, color: '#fff' }}>
                Activity <span style={{ color: '#e8002d' }}>Logs</span>
              </div>
              <button className="btn btn-ghost" onClick={() => setLogs([])}>Clear</button>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {logs.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#333' }}>No logs yet</div>
              ) : logs.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 14px', borderBottom: '1px solid #0d0d1a', fontSize: 12 }}>
                  <span style={{ color: '#333', fontFamily: 'monospace', flexShrink: 0 }}>{new Date(l.time).toLocaleTimeString()}</span>
                  <span style={{ color: l.level === 'error' ? '#e8002d' : l.level === 'success' ? '#39b54a' : l.level === 'warn' ? '#ffd700' : '#777' }}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
