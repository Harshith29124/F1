import React, { useState, useEffect, useRef } from 'react';
import config from './config';
import LiveTiming from './tabs/LiveTiming';
import TweetQueue from './tabs/TweetQueue';
import Compose from './tabs/Compose';
import News from './tabs/News';
import Settings from './tabs/Settings';
import {
  Activity,
  Send,
  Edit3,
  Newspaper,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  LogOut,
  AlertTriangle
} from 'lucide-react';

/**
 * PRODUCTION-READY CORE - F1 AI BOT
 */

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#050508', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f0f0f8', textAlign: 'center', padding: '20px' }}>
          <AlertTriangle size={48} color="#e8002d" style={{ marginBottom: '20px' }} />
          <h2>Engine Failure</h2>
          <p style={{ color: '#8888aa', margin: '10px 0 20px' }}>An unexpected error occurred.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>RESTART SYSTEM</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- FIX 1: Naming ---
const TABS = [
  { id: 'live', label: 'Live', icon: Activity },
  { id: 'queue', label: 'Tweet Queue', icon: Send },
  { id: 'compose', label: 'Compose', icon: Edit3 },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [wsOnline, setWsOnline] = useState(false);
  const [f1Connected, setF1Connected] = useState(false);
  const [state, setState] = useState({
    timing: [], session: {}, fastest: {}, raceControl: [], weather: {}, trackStatus: { status: 'OFFLINE' }
  });
  const [tweets, setTweets] = useState([]);
  const [news, setNews] = useState([]);
  const [toasts, setToasts] = useState([]);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    connectHub();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const connectHub = () => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);

    try {
      const ws = new WebSocket(config.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { setWsOnline(true); };
      ws.onclose = () => {
        setWsOnline(false);
        reconnectRef.current = setTimeout(connectHub, 3000);
      };
      ws.onmessage = (e) => {
        const { type, data } = JSON.parse(e.data);
        handleHubData(type, data);
      };
      ws.onerror = () => { setWsOnline(false); };
    } catch (err) {
      reconnectRef.current = setTimeout(connectHub, 5000);
    }
  };

  const handleHubData = (type, data) => {
    switch (type) {
      case 'init':
        setState({
          timing: data.timing || [],
          session: data.session || {},
          fastest: data.fastest || {},
          raceControl: data.raceControl || [],
          weather: data.weather || {},
          trackStatus: data.trackStatus || { status: 'OFFLINE' }
        });
        setF1Connected(data.connected);
        setTweets(data.tweets || []);
        setNews(data.news || []);
        break;
      case 'timing': setState(prev => ({ ...prev, timing: data })); break;
      case 'session_info': setState(prev => ({ ...prev, session: data })); break;
      case 'track_status': setState(prev => ({ ...prev, trackStatus: data })); break;
      case 'fastest_lap':
        setState(prev => ({ ...prev, fastest: data }));
        addToast(`⚡ New fastest lap: ${data.driver}`);
        break;
      case 'tweet_generated':
        setTweets(prev => [data, ...prev]);
        addToast(`🤖 AI tweet ready in queue`);
        break;
      case 'connection_status': setF1Connected(data.connected); break;
      case 'race_control': setState(prev => ({ ...prev, raceControl: [data, ...prev.raceControl].slice(0, 50) })); break;
      case 'news': setNews(prev => [data, ...prev].slice(0, 25)); break;
      default: break;
    }
  };

  const addToast = (msg) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const triggerDisconnect = async () => {
    try { await fetch(`${config.backendUrl}/api/live/disconnect`, { method: 'POST' }); } catch (e) { }
  };

  const unpostedCount = tweets.filter(t => !t.posted).length;

  const renderContent = () => {
    const props = { ...state, wsOnline, f1Connected, tweets, setTweets, news };
    switch (activeTab) {
      case 'live': return <LiveTiming {...props} />;
      case 'queue': return <TweetQueue {...props} />;
      case 'compose': return <Compose {...props} />;
      case 'news': return <News {...props} />;
      case 'settings': return <Settings {...props} />;
      default: return <LiveTiming {...props} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <div className="toast-wrap">
          {toasts.map(t => <div key={t.id} className="toast-msg">{t.msg}</div>)}
        </div>

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">F1 <span>NEURAL</span></div>
          <nav className="sidebar-nav">
            {TABS.map(tab => (
              <div
                key={tab.id}
                className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {tab.id === 'queue' && unpostedCount > 0 && (
                  <div style={{ marginLeft: 'auto', background: 'var(--red)', borderRadius: '4px', padding: '0 6px', fontSize: '10px', color: 'white' }}>{unpostedCount}</div>
                )}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            {/* --- FIX 1: Naming --- */}
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: wsOnline ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              {wsOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {wsOnline ? 'F1 Connected' : 'Disconnected'}
            </div>
            {f1Connected && (
              <button onClick={triggerDisconnect} className="btn-ghost" style={{ width: '100%', padding: '8px', borderStyle: 'dashed', fontSize: '10px' }}>
                <LogOut size={12} /> Disconnect
              </button>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <div className="main-content">
          <header className="header">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="sidebar-logo" style={{ padding: 0, fontSize: '16px', marginRight: '16px' }}>F1 <span>NEURAL</span></div>
              {/* --- FIX 1 & 9: Subtitle & Version --- */}
              <div className="badge" style={{ backgroundColor: 'var(--bg-card)', color: '#6b6b8b' }}>Live Timing</div>
            </div>

            <div style={{ flex: 1, textAlign: 'center' }}>
              {state.session?.name && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--red)', letterSpacing: '1px' }}>{state.session.name}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f0f0f8' }}>{state.session.track}</span>
                </div>
              )}
            </div>

            {/* --- FIX 1: LINK -> LIVE/OFFLINE --- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className={`tyre-dot`} style={{ margin: 0, width: '6px', height: '6px', background: f1Connected ? 'var(--green)' : 'var(--red)' }} />
                <span style={{ fontSize: '10px', fontWeight: 900 }}>{f1Connected ? 'LIVE' : 'OFFLINE'}</span>
              </div>
            </div>
          </header>

          <main className="viewport">
            {renderContent()}
          </main>

          <nav className="bottom-nav">
            {TABS.map(tab => (
              <div
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={20} />
                <span style={{ marginTop: '4px' }}>{tab.id === 'queue' ? 'Queue' : tab.label}</span>
                {tab.id === 'queue' && unpostedCount > 0 && (
                  <div style={{ position: 'absolute', top: '10px', right: '15px', background: 'var(--red)', width: '6px', height: '6px', borderRadius: '50%' }} />
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
