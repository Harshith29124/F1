import React, { useState } from 'react';
import { Send, RefreshCw, X, Clock, Share2, Layers, AlertCircle } from 'lucide-react';
import config from '../config';

/**
 * TWEET QUEUE - Fix 1 Naming
 */

function TweetQueue({ tweets, setTweets }) {
    const [filter, setFilter] = useState('UNPOSTED');

    const openTwitter = (text) => {
        const encoded = encodeURIComponent(text);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encoded}`;
        window.location.href = `twitter://post?message=${encoded}`;
        setTimeout(() => {
            window.open(twitterUrl, '_blank', 'width=550,height=420');
        }, 600);
    };

    const markPosted = async (id, text) => {
        setTweets(prev => prev.map(t => t.id === id ? { ...t, posted: true } : t));
        openTwitter(text);
    };

    const deleteTweet = async (id) => {
        try {
            await fetch(`${config.backendUrl}/api/tweet/queue/${id}`, { method: 'DELETE' });
            setTweets(prev => prev.filter(t => t.id !== id));
        } catch (e) {
            console.error('[QUEUE] Delete failed:', e.message);
        }
    };

    const regenerate = async (t) => {
        try {
            const res = await fetch(`${config.backendUrl}/api/tweet/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: t.type, context: t.context })
            });
            if (res.ok) deleteTweet(t.id);
        } catch (e) {
            console.error('[QUEUE] Regeneration failed:', e.message);
        }
    };

    const filteredTweets = tweets.filter(t => {
        if (filter === 'ALL') return true;
        if (filter === 'UNPOSTED') return !t.posted;
        if (filter === 'POSTED') return t.posted;
        return true;
    });

    // --- FIX 1: Naming counts ---
    const readyCount = tweets.filter(t => !t.posted).length;

    return (
        <div className="tab-container animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    {/* --- FIX 1: Broadcast Queue -> Tweet Queue --- */}
                    <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>Tweet Queue</h2>
                    <p style={{ fontSize: '12px', color: '#6b6b8b', fontWeight: 700 }}>{readyCount} tweets ready</p>
                </div>

                <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    {['UNPOSTED', 'POSTED', 'ALL'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={filter === f ? 'active-filter' : 'inactive-filter'}
                            style={{
                                background: filter === f ? 'var(--bg-card)' : 'transparent',
                                color: filter === f ? 'white' : '#6b6b8b',
                                border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {filteredTweets.length === 0 && (
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center', background: 'transparent', borderStyle: 'dashed' }}>
                    <Layers size={32} style={{ margin: '0 auto 16px', color: '#444466' }} />
                    {/* --- FIX 1: Naming --- */}
                    <p style={{ fontSize: '13px', color: '#8888aa' }}>No tweets yet. Connect to live timing or generate manually.</p>
                </div>
            )}

            {filteredTweets.map(t => (
                <div key={t.id} className="card" style={{ opacity: t.posted ? 0.5 : 1, transition: '0.3s' }}>
                    <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                            <div className="badge" style={{ background: 'var(--bg-elevated)', color: '#8888aa' }}>{t.type?.replace(/_/g, ' ').toUpperCase()}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b6b8b', fontWeight: 700 }}>
                                <Clock size={12} /> {new Date(t.generatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>

                        <p style={{ fontSize: '16px', lineHeight: '1.5', fontWeight: 600, color: '#f0f0f8', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
                            {t.text}
                        </p>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min((t.text?.length || 0) / 280 * 100, 100)}%`,
                                    background: (t.text?.length || 0) > 280 ? 'var(--red)' : (t.text?.length || 0) > 240 ? 'var(--yellow)' : 'var(--green)',
                                    transition: '0.3s'
                                }} />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '10px', fontWeight: 900, color: (t.text?.length || 0) > 280 ? 'var(--red)' : '#444466' }}>
                                {t.text?.length || 0} / 280
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            {!t.posted ? (
                                <>
                                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => markPosted(t.id, t.text)}>
                                        <Share2 size={16} /> Post to Twitter
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => regenerate(t)} title="Regenerate">
                                        <RefreshCw size={16} />
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => deleteTweet(t.id)} style={{ color: 'var(--red)' }}>
                                        <X size={16} />
                                    </button>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--green-dim)', color: 'var(--green)', padding: '10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800 }}>
                                    VERIFIED BROADCAST ✓
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default TweetQueue;
