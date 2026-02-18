import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Timer } from 'lucide-react';
import config from '../config';

/**
 * SEASON CALENDAR - F1 2026 CALENDAR
 */

function Schedule() {
    const [races, setRaces] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${config.backendUrl}/api/f1/schedule`)
            .then(res => res.json())
            .then(d => { setRaces(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="card" style={{ padding: '60px', textAlign: 'center', background: 'transparent', borderStyle: 'dashed' }}>
            <Timer className="spin" size={32} style={{ color: '#444466' }} />
        </div>
    );

    return (
        <div className="tab-container animate-fade-in">
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>Racing Calendar</h2>
                <p style={{ fontSize: '12px', color: '#6b6b8b', fontWeight: 700 }}>Upcoming rounds and global logistics</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {races.map((race, i) => {
                    const isNext = i === 0;
                    return (
                        <div key={race.round} className="card" style={{
                            marginBottom: 0,
                            borderTop: isNext ? '4px solid var(--red)' : '1px solid var(--border-subtle)',
                            background: isNext ? 'linear-gradient(180deg, var(--red-glow), var(--bg-card))' : 'var(--bg-card)'
                        }}>
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: 900, color: isNext ? 'var(--red)' : '#6b6b8b', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                            ROUND {race.round} • {new Date(race.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 900, marginTop: '4px', letterSpacing: '-0.5px' }}>{race.raceName.toUpperCase()}</h3>
                                    </div>
                                    {isNext && <div className="badge" style={{ background: 'var(--red)', color: 'white' }}>NEXT GP</div>}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: '#8888aa', fontWeight: 600 }}>
                                        <MapPin size={14} color="var(--red)" /> {race.Circuit.circuitName}
                                    </div>
                                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: '#8888aa', fontWeight: 600 }}>
                                        <Clock size={14} color="var(--green)" /> {race.time ? race.time.slice(0, 5) : 'TBC'} UTC BROADCAST
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default Schedule;
