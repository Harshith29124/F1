import React, { useState, useEffect } from 'react';
import {
    Shield, ToggleRight, ToggleLeft, Activity, Cpu, Server, Eye, EyeOff, Zap, MessageSquare, Newspaper, Flag, Save
} from 'lucide-react';
import config from '../config';

/**
 * SETTINGS - Fix 1 & Fix 7
 */

const AUTO_OPTS = [
    { id: 'fastestLap', label: 'Fastest Lap', icon: Zap, desc: 'When new fastest lap is set' },
    { id: 'leaderChange', label: 'Leader Change', icon: Activity, desc: 'When the leader changes' },
    { id: 'pitStop', label: 'Pit Stop', icon: Cpu, desc: 'When a driver pits' },
    { id: 'flag', label: 'Flags / SC', icon: Flag, desc: 'Flags, safety cars, red flags' },
    { id: 'news', label: 'F1 News', icon: Newspaper, desc: 'When new F1 news is found' },
    { id: 'sessionSummary', label: 'Session Summary', icon: MessageSquare, desc: 'Tweet when session ends' },
];

function Settings() {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        autoGenerate: { fastestLap: true, leaderChange: true, pitStop: true, flag: true, news: true, sessionSummary: true },
        minInterval: 120
    });

    useEffect(() => {
        fetch(`${config.backendUrl}/api/settings`)
            .then(res => res.json())
            .then(data => {
                if (data.groqApiKey) setApiKey(data.groqApiKey);
                if (data.autoGenerate) setSettings(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const save = async () => {
        try {
            const res = await fetch(`${config.backendUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...settings, groqApiKey: apiKey })
            });
            if (res.ok) alert('Settings saved.');
        } catch (e) {
            alert('Failed to save settings.');
        }
    };

    const toggle = (key) => {
        setSettings(prev => ({
            ...prev,
            autoGenerate: { ...prev.autoGenerate, [key]: !prev.autoGenerate[key] }
        }));
    };

    if (loading) return null;

    return (
        <div className="tab-container animate-fade-in">
            <div style={{ marginBottom: '24px' }}>
                {/* --- FIX 1: Naming --- */}
                <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>Settings</h2>
                <p style={{ fontSize: '12px', color: '#6b6b8b', fontWeight: 700 }}>Configure your AI and auto-tweet preferences</p>
            </div>

            {/* API KEY */}
            <div className="badge" style={{ marginBottom: '12px', background: 'var(--bg-elevated)', color: '#8888aa' }}>Groq API Key</div>
            <div className="card" style={{ padding: '16px' }}>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <input
                        className="input"
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter Groq API Key (gsk_...)"
                    />
                    <button onClick={() => setShowKey(!showKey)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#444466', cursor: 'pointer' }}
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            {/* AUTO LOGIC */}
            <div className="badge" style={{ margin: '32px 0 12px', background: 'var(--bg-elevated)', color: '#8888aa' }}>Auto-Generate Tweets</div>
            <div className="card" style={{ padding: 0 }}>
                {AUTO_OPTS.map((opt, i) => (
                    <div key={opt.id} onClick={() => toggle(opt.id)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px', borderBottom: i === AUTO_OPTS.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ color: settings.autoGenerate[opt.id] ? '#00d084' : '#444466' }}>
                                <opt.icon size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 800 }}>{opt.label}</div>
                                <div style={{ fontSize: '11px', color: '#6b6b8b', fontWeight: 700 }}>{opt.desc}</div>
                            </div>
                        </div>
                        {/* --- FIX 7: Toggle Colors --- */}
                        <div style={{ color: settings.autoGenerate[opt.id] ? '#00d084' : '#2a2a44' }}>
                            {settings.autoGenerate[opt.id] ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </div>
                    </div>
                ))}
            </div>

            {/* THROTTLE */}
            <div className="badge" style={{ margin: '32px 0 12px', background: 'var(--bg-elevated)', color: '#8888aa' }}>Minimum Interval Between Tweets</div>
            <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#6b6b8b' }}>Min Interval</span>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: 'white' }}>{settings.minInterval}s</span>
                </div>
                <input type="range" min="60" max="600" step="60"
                    value={settings.minInterval}
                    onChange={e => setSettings({ ...settings, minInterval: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--red)', cursor: 'pointer' }}
                />
            </div>

            {/* --- FIX 1: Save Settings --- */}
            <button className="btn btn-primary" onClick={save} style={{ width: '100%', padding: '16px', borderRadius: '12px', marginTop: '32px', marginBottom: '40px', fontWeight: 900 }}>
                <Save size={18} /> SAVE SETTINGS
            </button>
        </div>
    );
}

export default Settings;
