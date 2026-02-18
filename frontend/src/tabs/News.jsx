import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Sparkles, RefreshCw, Clock, Loader2 } from 'lucide-react';
import config from '../config';

/**
 * F1 NEWS - RSS FEED AGGREGATOR
 */

function formatTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${diffDays}d ago`;
}

function News({ news }) {
    const [refreshing, setRefreshing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update "time ago" every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const generateTweet = async (article) => {
        try {
            await fetch(`${config.backendUrl}/api/tweet/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'news', context: article })
            });
            alert('Generating tweet from this news item...');
        } catch (e) {
            console.error('[NEWS] Generation failure:', e.message);
        }
    };

    const manualRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await fetch(`${config.backendUrl}/api/news/refresh`, { method: 'POST' });
        } catch (e) {
            console.error('[NEWS] Refresh failed:', e.message);
        } finally {
            setTimeout(() => setRefreshing(false), 2000);
        }
    };

    return (
        <div className="tab-container animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>F1 News</h2>
                    <p style={{ fontSize: '12px', color: '#6b6b8b', fontWeight: 700 }}>Latest F1 news — auto-scraped every 6 hours</p>
                </div>
                <button className="btn-ghost" onClick={manualRefresh} disabled={refreshing} style={{ padding: '8px', borderRadius: '8px' }}>
                    {refreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                </button>
            </div>

            {news.length === 0 && (
                <div className="card" style={{ padding: '60px', textAlign: 'center', background: 'transparent', borderStyle: 'dashed' }}>
                    <Clock size={32} style={{ margin: '0 auto 16px', color: '#444466' }} />
                    <p style={{ fontSize: '13px', color: '#8888aa' }}>No news yet. Click refresh to scrape latest F1 news.</p>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {news.map((item, i) => (
                    <div key={item.id || i} className="card" style={{
                        padding: 0,
                        borderLeft: `4px solid ${item.sourceColor || '#6b6b8b'}`,
                        transition: '0.2s'
                    }}>
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                <div className="badge" style={{ background: 'var(--bg-elevated)', color: item.sourceColor || '#8888aa' }}>
                                    {item.source}
                                </div>
                                <span style={{ fontSize: '11px', color: '#6b6b8b', fontWeight: 700 }}>
                                    {formatTimeAgo(item.publishedAt)}
                                </span>
                            </div>

                            <h3 style={{ fontSize: '15px', fontWeight: 800, lineHeight: '1.4', marginBottom: '8px', color: '#f0f0f8' }}>
                                {item.headline}
                            </h3>

                            <p style={{
                                fontSize: '13px', color: '#8888aa', lineHeight: '1.5', marginBottom: '16px',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                            }}>
                                {item.summary}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button className="btn btn-primary" onClick={() => generateTweet(item)}>
                                    <Sparkles size={14} /> Generate Tweet
                                </button>
                                <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                                    Read Full <ExternalLink size={14} style={{ marginLeft: '4px' }} />
                                </a>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default News;
