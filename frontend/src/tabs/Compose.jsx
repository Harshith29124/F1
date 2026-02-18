import React, { useState } from 'react';
import { Send, RefreshCw, ChevronDown, ChevronUp, Sparkles, Loader2, AlertCircle, PlusCircle } from 'lucide-react';
import config from '../config';

/**
 * COMPOSE - Fix 1 & Fix 6
 */

const TYPES = [
    { id: 'fastest_lap', label: 'Fastest Lap', icon: '⚡' },
    { id: 'leader_change', label: 'Leader Change', icon: '📊' },
    { id: 'pit_stop', label: 'Pit Stop', icon: '🛞' },
    { id: 'flag', label: 'Flag / SC', icon: '🚩' },
    { id: 'news', label: 'F1 News', icon: '📰' },
    { id: 'driver_stat', label: 'Driver Stat', icon: '👤' },
    { id: 'race_preview', label: 'Race Preview', icon: '🏁' },
    { id: 'history', label: 'History', icon: '📅' },
    { id: 'session_summary', label: 'Summary', icon: '🏆' },
];

function Compose() {
    const [type, setType] = useState('driver_stat');
    const [contextInput, setContextInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [draft, setDraft] = useState('');
    const [showContext, setShowContext] = useState(false);

    const generate = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        setDraft('');

        try {
            const res = await fetch(`${config.backendUrl}/api/tweet/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, context: { topic: contextInput, driver: contextInput } })
            });

            const data = await res.json();

            if (res.ok && data.tweet) {
                setDraft(data.tweet.text);
            } else {
                setError(data.error || 'Generation failed. Check your Groq API key.');
            }
        } catch (e) {
            console.error('[COMPOSE] Generation failed:', e.message);
            setError('Connection failure. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    const openTwitter = (text) => {
        const encoded = encodeURIComponent(text);
        window.location.href = `twitter://post?message=${encoded}`;
        setTimeout(() => {
            window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank', 'width=550,height=420');
        }, 600);
    };

    const addToQueue = async () => {
        // Since generation already creates it in backend, we just toast/confirm
        alert('Draft added to Tweet Queue');
    };

    const charCount = draft.length;
    const charColor = charCount > 280 ? 'var(--red)' : charCount > 240 ? 'var(--yellow)' : '#6b6b8b';

    return (
        <div className="tab-container animate-fade-in">
            <div style={{ marginBottom: '24px' }}>
                {/* --- FIX 1: Naming --- */}
                <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>Compose</h2>
                <p style={{ fontSize: '12px', color: '#6b6b8b', fontWeight: 700 }}>Generate AI tweets from live F1 data</p>
            </div>

            {/* ANGLE SELECTOR */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', marginBottom: '24px' }}>
                {TYPES.map(t => (
                    <button key={t.id} onClick={() => setType(t.id)}
                        style={{
                            background: type === t.id ? 'var(--red)' : 'var(--bg-card)',
                            border: `1px solid ${type === t.id ? 'var(--red)' : 'var(--border-subtle)'}`,
                            color: type === t.id ? 'white' : '#6b6b8b',
                            padding: '12px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* CONTEXT DRAWER */}
            <div className="card" style={{ background: 'var(--bg-input)', borderStyle: 'dotted' }}>
                <button onClick={() => setShowContext(!showContext)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b6b8b', cursor: 'pointer' }}
                >
                    {/* --- FIX 1: Injection Context -> Add Context (optional) --- */}
                    <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>Add Context (optional)</span>
                    {showContext ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showContext && (
                    <div style={{ padding: '0 16px 16px' }}>
                        <textarea className="input" placeholder="e.g. Focus on technical regs, specific driver rivalry, or session drama..."
                            value={contextInput} onChange={e => setContextInput(e.target.value)}
                            style={{ minHeight: '80px', fontSize: '13px', background: 'transparent' }}
                        />
                    </div>
                )}
            </div>

            {/* ACTION */}
            <button className="btn btn-primary" onClick={generate} disabled={loading}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', margin: '16px 0', fontWeight: 900 }}
            >
                {/* --- FIX 1: Generate Tweet with AI --- */}
                {loading ? <Loader2 className="spin" size={20} /> : <><Sparkles size={18} /> GENERATE TWEET WITH AI</>}
            </button>

            {/* ERROR DISPLAY (FIX 6) */}
            {error && (
                <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-glow)', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#ff6b6b', fontSize: '13px', fontWeight: 700 }}>
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {/* DRAFT OUTPUT (FIX 6) */}
            {draft && !loading && (
                <div className="card animate-slide-up" style={{ borderColor: 'var(--red-dim)' }}>
                    <div style={{ padding: '16px' }}>
                        <textarea className="input" value={draft} onChange={e => setDraft(e.target.value)}
                            style={{ minHeight: '140px', fontSize: '16px', lineHeight: '1.6', background: 'transparent', border: 'none', padding: 0 }}
                        />

                        <div style={{ margin: '16px 0 20px' }}>
                            <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${Math.min(charCount / 280 * 100, 100)}%`,
                                    background: charCount > 280 ? 'var(--red)' : charCount > 240 ? 'var(--yellow)' : 'var(--green)',
                                    transition: '0.3s'
                                }} />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '10px', fontWeight: 900, color: charColor }}>
                                {charCount} / 280
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={() => openTwitter(draft)}>
                                <Send size={16} /> POST TO TWITTER
                            </button>
                            <button className="btn btn-ghost" onClick={addToQueue}>
                                <PlusCircle size={14} /> ADD TO QUEUE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Compose;
