import React, { useState, useEffect } from 'react';
import { Users, BarChart3, Shield } from 'lucide-react';
import config from '../config';

/**
 * CHAMPIONSHIP STANDINGS - F1 2026 REULATED
 */

const getTeamColor = (name) => {
    const teams = {
        'Ferrari': 'var(--color-ferrari)',
        'McLaren': 'var(--color-mclaren)',
        'Mercedes': 'var(--color-mercedes)',
        'Red Bull Racing': 'var(--color-redbull)',
        'Aston Martin': 'var(--color-astonmartin)',
        'Alpine': 'var(--color-alpine)',
        'Williams': 'var(--color-williams)',
        'Haas F1 Team': 'var(--color-haas)',
        'RB': 'var(--color-rb)',
        'Audi': 'var(--color-audi)'
    };
    return teams[name] || 'var(--color-default)';
};

function Standings() {
    const [data, setData] = useState({ drivers: [], constructors: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${config.backendUrl}/api/f1/standings`)
            .then(res => res.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="card" style={{ padding: '60px', textAlign: 'center', background: 'transparent', borderStyle: 'dashed' }}>
            <BarChart3 className="spin" size={32} style={{ color: '#444466' }} />
        </div>
    );

    return (
        <div className="tab-container animate-fade-in">
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>Championship Matrix</h2>
                <p style={{ fontSize: '12px', color: '#6b6b8b', fontWeight: 700 }}>Season standings and manufacturer points</p>
            </div>

            <div className="badge" style={{ marginBottom: '12px', background: 'var(--bg-elevated)', color: '#8888aa' }}>Drivers' Classification</div>
            <div className="card" style={{ padding: 0 }}>
                <table className="tt-table">
                    <thead className="tt-header">
                        <tr>
                            <th>Pos</th>
                            <th>Driver</th>
                            <th style={{ textAlign: 'right' }}>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.drivers.map((d) => (
                            <tr key={d.position} className="row-driver" style={{ borderLeft: `3px solid ${getTeamColor(d.Constructors[0]?.name)}` }}>
                                <td className="cell-pos" style={{ fontStyle: 'normal', fontSize: '15px' }}>{d.position}</td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 800, fontSize: '15px' }}>{d.Driver.familyName.toUpperCase()}</span>
                                        <span style={{ fontSize: '10px', color: '#6b6b8b', fontWeight: 700 }}>{d.Constructors[0]?.name}</span>
                                    </div>
                                </td>
                                <td className="text-mono" style={{ textAlign: 'right', fontWeight: 900, fontSize: '16px', paddingRight: '16px' }}>{d.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="badge" style={{ margin: '32px 0 12px', background: 'var(--bg-elevated)', color: '#8888aa' }}>Constructors' Title</div>
            <div className="card" style={{ padding: 0 }}>
                <table className="tt-table">
                    <thead className="tt-header">
                        <tr>
                            <th>Pos</th>
                            <th>Team</th>
                            <th style={{ textAlign: 'right' }}>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.constructors.map((c) => (
                            <tr key={c.position} className="row-driver" style={{ borderLeft: `3px solid ${getTeamColor(c.Constructor.name)}` }}>
                                <td className="cell-pos" style={{ fontStyle: 'normal', fontSize: '15px' }}>{c.position}</td>
                                <td style={{ fontWeight: 800, fontSize: '15px' }}>{c.Constructor.name}</td>
                                <td className="text-mono" style={{ textAlign: 'right', fontWeight: 900, fontSize: '16px', paddingRight: '16px' }}>{c.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Standings;
