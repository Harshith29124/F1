import React, { useState, useEffect } from 'react';
import { ToggleRight, ToggleLeft, Save, Zap, ShieldCheck, Settings2 } from 'lucide-react';
import config from '../config';

function AutoGenerate() {
    const [settings, setSettings] = useState({
        autoGenerate: { fastestLap: false, leaderChange: false, pitStop: false, flag: false, news: false },
        minInterval: 120
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${config.backendUrl}/api/settings`)
            .then(res => res.json())
            .then(data => {
                if (data.autoGenerate) {
                    setSettings(data);
                }
                setLoading(false);
            })
            .catch(e => console.error(e));
    }, []);

    const save = async () => {
        try {
            await fetch(`${config.backendUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            alert('Automation profile updated successfully.');
        } catch (err) {
            alert('Failed to save settings.');
        }
    };

    const toggle = (key) => {
        setSettings(prev => ({
            ...prev,
            autoGenerate: { ...prev.autoGenerate, [key]: !prev.autoGenerate[key] }
        }));
    };

    const TRIGGERS = [
        { id: 'fastestLap', label: 'Fastest Lap', desc: 'Triggers when a driver sets a new purple lap' },
        { id: 'leaderChange', label: 'Leader Change', desc: 'Triggers when P1 position changes' },
        { id: 'pitStop', label: 'Pit Entry', desc: 'Triggers when a driver enters the pits' },
        { id: 'flag', label: 'Race Control Flags', desc: 'Triggers on Safety Car, VSC, or Red Flags' },
        { id: 'news', label: 'News Alerts', desc: 'Triggers when new F1 articles are scraped' },
    ];

    if (loading) return (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Zap className="spin" size={32} color="var(--accent)" />
        </div>
    );

    return (
        <div className="tab-fade-in">
            <div className="heading">
                <Zap size={14} /> Automation Control
            </div>

            <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)', fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', marginBottom: '8px' }}>
                        <ShieldCheck size={16} /> Human-In-The-Loop
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Automation generates drafts in your <strong>Queue</strong>. Nothing is ever posted to Twitter without your final approval.
                    </p>
                </div>

                {TRIGGERS.map(t => (
                    <div
                        key={t.id}
                        onClick={() => toggle(t.id)}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '24px',
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'background 0.2s ease'
                        }}
                        className="trigger-row"
                    >
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px', color: settings.autoGenerate[t.id] ? 'var(--text)' : 'var(--text-muted)' }}>
                                {t.label}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>
                                {t.desc}
                            </div>
                        </div>
                        <div style={{ color: settings.autoGenerate[t.id] ? 'var(--green)' : 'var(--text-dim)' }}>
                            {settings.autoGenerate[t.id] ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                        </div>
                    </div>
                ))}
            </div>

            <div className="heading">
                <Settings2 size={14} /> Throttle Configuration
            </div>
            <div className="card" style={{ padding: '30px' }}>
                <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '12px' }}>
                    MINIMUM INTERVAL (SECONDS)
                </label>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <input
                        type="range"
                        min="30"
                        max="600"
                        step="30"
                        value={settings.minInterval}
                        onChange={e => setSettings({ ...settings, minInterval: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: 'var(--accent)' }}
                    />
                    <div style={{
                        width: '80px',
                        textAlign: 'center',
                        padding: '8px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '6px',
                        fontWeight: 900,
                        fontSize: '14px',
                        fontFamily: 'monospace'
                    }}>
                        {settings.minInterval}s
                    </div>
                </div>
            </div>

            <button className="btn" onClick={save} style={{ marginTop: '10px' }}>
                <Save size={16} /> SAVE AUTOMATION PROFILE
            </button>
        </div>
    );
}

export default AutoGenerate;
