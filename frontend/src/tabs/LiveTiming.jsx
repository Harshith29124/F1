import React, { memo, useState } from 'react';
import { CloudRain, Timer, Activity, History, Loader2 } from 'lucide-react';
import config from '../config';

/**
 * PRODUCTION TIMING MATRIX - F1 2026
 */

const getTeamColor = (name) => {
    const teams = {
        'Ferrari': 'var(--color-ferrari)',
        'McLaren': 'var(--color-mclaren)',
        'Mercedes': 'var(--color-mercedes)',
        'Red Bull Racing': 'var(--color-redbull)',
        'Red Bull': 'var(--color-redbull)',
        'Alpine': 'var(--color-alpine)',
        'Williams': 'var(--color-williams)',
        'Aston Martin': 'var(--color-astonmartin)',
        'Haas': 'var(--color-haas)',
        'Visa CashApp RB': 'var(--color-rb)',
        'Racing Bulls': 'var(--color-rb)',
        'Audi': 'var(--color-audi)',
        'Cadillac': 'var(--color-cadillac)'
    };
    return teams[name] || 'var(--color-default)';
};

const getTyreColor = (compound) => {
    if (!compound) return 'var(--tyre-unknown)';
    const c = compound.toString().toUpperCase();
    if (c.includes('SOFT')) return 'var(--tyre-soft)';
    if (c.includes('MEDIUM')) return 'var(--tyre-medium)';
    if (c.includes('HARD')) return 'var(--tyre-hard)';
    if (c.includes('INTER')) return 'var(--tyre-inter)';
    if (c.includes('WET')) return 'var(--tyre-wet)';
    return 'var(--tyre-unknown)';
};

const getTyreShort = (compound) => {
    if (!compound) return '?';
    const c = compound.toString().toUpperCase();
    if (c.includes('SOFT')) return 'S';
    if (c.includes('MEDIUM')) return 'M';
    if (c.includes('HARD')) return 'H';
    if (c.includes('INTER')) return 'I';
    if (c.includes('WET')) return 'W';
    return '?';
};



const normalizeTeamName = (rawInfo) => {
    if (!rawInfo) return 'Unknown';
    const name = rawInfo.toString().toLowerCase().trim();

    if (name.includes('ferrari')) return 'Ferrari';
    if (name.includes('mclaren')) return 'McLaren';
    if (name.includes('mercedes')) return 'Mercedes';
    if (name.includes('red bull') || name.includes('rbr')) return 'Red Bull Racing';
    if (name.includes('alpine')) return 'Alpine';
    if (name.includes('williams')) return 'Williams';
    if (name.includes('aston') || name.includes('amf')) return 'Aston Martin';
    if (name.includes('haas')) return 'Haas';
    if (name.includes('rb') || name.includes('bulls') || name.includes('alpha') || name.includes('toro')) return 'Visa CashApp RB';
    if (name.includes('audi') || name.includes('sauber') || name.includes('kick')) return 'Audi';
    if (name.includes('cadillac') || name.includes('andretti')) return 'Cadillac';

    return rawInfo; // Fallback to raw if no match
};

const TeamLogo = ({ team, noFilter }) => {
    const [imgError, setImgError] = useState(false);
    const normalizedTeam = normalizeTeamName(team);

    const teamConfig = {
        'Ferrari': { file: 'ferrari.png', bg: '#DC0000', padding: '2px' },
        'McLaren': { file: 'mclaren.png', bg: '#FF8000', padding: '2px' },
        'Mercedes': { file: 'mercedes.png', bg: '#00D2BE', padding: '2px' },
        'Red Bull Racing': { file: 'redbull.png', bg: '#3671C6', padding: '2px' },
        'Alpine': { file: 'alpine.png', bg: '#0090FF', padding: '2px' },
        'Williams': { file: 'williams.png', bg: '#64C4FF', padding: '2px' },
        'Aston Martin': { file: 'astonmartin.png', bg: '#358C75', padding: '2px' },
        'Haas': { file: 'haas.png', bg: '#B6BABD', padding: '2px' },
        'Visa CashApp RB': { file: 'rb.png', bg: '#6692FF', padding: '2px' },
        'Audi': { file: 'audi.png', bg: '#222222', padding: '2px' },
        'Cadillac': { file: 'cadillac.png', bg: '#C8102E', padding: '2px' },
    };

    const config = teamConfig[normalizedTeam];

    if (!config) return (
        <div style={{
            width: 36, height: 22,
            background: '#1a1a2e',
            borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, color: '#555',
        }}>?</div>
    );

    if (!imgError) {
        return (
            <div style={{
                width: 36,
                height: 22,
                background: config.bg,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: config.padding,
                flexShrink: 0,
                overflow: 'hidden',
            }}>
                <img
                    src={`/logos/${config.file}`}
                    alt={normalizedTeam}
                    onError={() => setImgError(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        filter: noFilter ? 'none' : 'brightness(0) invert(1)',
                    }}
                />
            </div>
        );
    }

    // Text fallback
    const fallbackText = {
        'Ferrari': 'SF', 'McLaren': 'MCL', 'Mercedes': 'AMG',
        'Red Bull Racing': 'RBR', 'Alpine': 'ALP', 'Williams': 'WIL',
        'Aston Martin': 'AMF', 'Haas': 'HAS', 'Visa CashApp RB': 'RB',
        'Audi': 'ADI', 'Cadillac': 'CAD',
    };

    return (
        <div style={{
            width: 36, height: 22,
            background: config.bg,
            borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, color: 'white',
            letterSpacing: 0.5,
            fontFamily: 'Titillium Web, sans-serif',
            flexShrink: 0,
        }}>
            {fallbackText[normalizedTeam] || '?'}
        </div>
    );
};

const TimingRow = memo(({ driver, isFastest }) => {
    const p = parseInt(driver.position);
    const posClass = p === 1 ? 'pos-gold' : p === 2 ? 'pos-silver' : p === 3 ? 'pos-bronze' : 'pos-muted';

    // --- FIX 8: Display "—" if no best lap ---
    const displayBestLap = (driver.bestLap && driver.bestLap !== "" && driver.bestLap !== "0:00.000") ? driver.bestLap : "—";

    // --- FIX 3: Gap Highlight ---
    const gapColor = driver.gap === 'LEADER' ? 'var(--green)' : driver.gap?.includes('LAP') ? 'rgba(232, 0, 45, 0.6)' : '#8888aa';

    return (
        <tr className={`row-driver ${isFastest ? 'fastest-pulse' : ''}`} style={{ borderLeft: `3px solid ${getTeamColor(driver.team)}` }}>
            <td className={`cell-pos ${posClass}`}>{p || '--'}</td>
            <td style={{ width: '40px' }} className="text-small">#{driver.driverNumber}</td>
            <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TeamLogo team={driver.team} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-tla">{driver.shortName}</span>
                        <span className="text-small" style={{ fontSize: '9px', opacity: 0.6, whiteSpace: 'nowrap' }}>{driver.name || driver.team}</span>
                    </div>
                </div>
            </td>
            <td className="text-mono" style={{ color: isFastest ? 'var(--pos-3)' : displayBestLap === "—" ? '#444466' : 'inherit' }}>
                {displayBestLap}
            </td>
            <td className="text-mono" style={{ fontSize: '11px', color: gapColor }}>
                {driver.gap || '—'}
            </td>
            <td style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    {/* --- FIX 4: Tyre Dot & Short Letter --- */}
                    <div className="tyre-dot" style={{ backgroundColor: getTyreColor(driver.tyre) }} />
                    <span className="text-small">{getTyreShort(driver.tyre)}</span>
                </div>
            </td>
            <td className="text-mono text-small" style={{ textAlign: 'center' }}>{driver.laps || 0}</td>
        </tr>
    );
});

function LiveTiming({ timing, session, fastest, raceControl, weather, connected, wsOnline, trackStatus }) {

    const connectLink = async () => {
        try { await fetch(`${config.backendUrl}/api/live/connect`, { method: 'POST' }); } catch (e) { }
    };

    // --- FIX 2: Correct Banner Logic ---
    const showConnectingBanner = wsOnline && !connected && timing.length === 0;
    const showOfflineBanner = !wsOnline;
    const showTrackStatusBanner = connected && trackStatus?.status && trackStatus.status !== 'ALL CLEAR' && trackStatus.status !== 'UNKNOWN';

    return (
        <div className="tab-container animate-fade-in">

            {/* Reconnecting to Backend */}
            {showOfflineBanner && (
                <div className="banner-idle" style={{ background: '#1a1a2e', color: '#8888aa', marginBottom: '16px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}>
                    <Loader2 className="spin" size={14} /> Reconnecting to server...
                </div>
            )}

            {/* Connecting to F1 SignalR (FIX 2) */}
            {showConnectingBanner && (
                <div className="banner-idle" style={{ background: '#1a1a2e', color: '#8888aa', marginBottom: '16px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}>
                    <Loader2 className="spin" size={14} /> Connecting to F1 Live Timing...
                </div>
            )}

            {/* Track Status Banners (Flags - Red/Yellow only) */}
            {showTrackStatusBanner && (
                <div className={`banner-idle ${trackStatus.status.includes('RED') ? 'pulse-red' : 'pulse-yellow'}`}
                    style={{
                        marginBottom: '16px', borderRadius: '4px',
                        background: trackStatus.status.includes('RED') ? 'var(--red)' : 'var(--yellow-dim)',
                        color: trackStatus.status.includes('RED') ? 'white' : 'var(--yellow)',
                        padding: '10px', fontWeight: 900
                    }}>
                    {trackStatus.status} {trackStatus.message ? `— ${trackStatus.message}` : ''}
                </div>
            )}

            {/* SESSION HEADER */}
            {connected && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
                    <div className="badge" style={{ background: 'var(--bg-elevated)', color: '#8888aa' }}>{session.type || 'SESSION ACTIVE'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontWeight: 700, color: '#6b6b8b' }}>
                        <CloudRain size={12} /> {weather.AirTemp || '--'}° | <Timer size={12} /> {weather.TrackTemp || '--'}°
                    </div>
                </div>
            )}

            {/* FASTEST LAP BANNER */}
            {fastest.driver && (
                <div className="card" style={{
                    background: 'linear-gradient(90deg, rgba(138, 0, 26, 0.4), transparent)',
                    borderColor: 'var(--red-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', marginBottom: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Activity size={18} color="var(--red)" />
                        <TeamLogo team={fastest.team} noFilter />
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--red)', letterSpacing: '1px' }}>SESSION FASTEST</div>
                            <div style={{ fontSize: '15px', fontWeight: 700 }}>{fastest.driver}</div>
                        </div>
                    </div>
                    <div className="text-mono" style={{ fontSize: '20px', fontWeight: 900 }}>{fastest.time}</div>
                </div>
            )}

            {/* NO DATA LINK PROMPT (FIX 1) */}
            {timing.length === 0 && !connected && !showConnectingBanner && !showOfflineBanner && (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center', background: 'transparent', borderStyle: 'dashed' }}>
                    <Timer size={32} style={{ margin: '0 auto 16px', color: '#444466' }} />
                    <p style={{ fontSize: '13px', color: '#8888aa', marginBottom: '20px' }}>
                        No active link to live telemetry.
                    </p>
                    <button className="btn btn-primary" onClick={connectLink} style={{ margin: '0 auto' }}>
                        Connect to Live Timing
                    </button>
                </div>
            )}

            {/* TIMING TOWER */}
            {timing.length > 0 && (
                <div className="card" style={{ padding: 0 }}>
                    <table className="tt-table">
                        <thead className="tt-header">
                            <tr>
                                <th>P</th>
                                <th>#</th>
                                <th>DRIVER</th>
                                <th>BEST</th>
                                <th>GAP</th>
                                <th style={{ textAlign: 'center' }}>TYRE</th>
                                <th style={{ textAlign: 'center' }}>LAPS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timing.map((d) => (
                                <TimingRow key={d.driverNumber} driver={d} isFastest={d.driverNumber === fastest.driverNum} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* RACE CONTROL (FIX 1: Race Control Comms -> Race Control) */}
            {raceControl.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 4px' }}>
                        <History size={14} color="#6b6b8b" />
                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#6b6b8b', textTransform: 'uppercase' }}>Race Control</span>
                    </div>
                    <div className="card" style={{ background: 'transparent' }}>
                        {raceControl.slice(0, 10).map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: '12px', padding: '10px 12px',
                                borderBottom: i === 9 ? 'none' : '1px solid var(--border-subtle)',
                                fontSize: '12px', lineHeight: '1.4'
                            }}>
                                <span className="text-mono" style={{ color: '#444466', fontWeight: 700 }}>
                                    {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span style={{ color: '#f0f0f8' }}>{msg.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(LiveTiming);
