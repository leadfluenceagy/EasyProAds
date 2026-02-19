import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { fetchAdminStats, UserStat } from '../services/adminService';

interface AdminViewProps {
    onUnauthorized: () => void;
}

const SECTIONS: (keyof Omit<UserStat, 'userId' | 'email' | 'total' | 'lastActivity'>)[] = [
    'generator', 'editor', 'formats', 'refcopy', 'banners', 'fashion'
];

const SECTION_LABELS: Record<string, string> = {
    generator: 'Generator',
    editor: 'Editor',
    formats: 'Formats',
    refcopy: 'Ref Copy',
    banners: 'Banners',
    fashion: 'Fashion',
};

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const AdminView: React.FC<AdminViewProps> = ({ onUnauthorized }) => {
    const [stats, setStats] = useState<UserStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const loadStats = async () => {
        setLoading(true);
        const data = await fetchAdminStats();
        if (data.length === 0 && stats.length === 0) {
            // Might be unauthorized
        }
        setStats(data);
        setLastRefreshed(new Date());
        setLoading(false);
    };

    useEffect(() => {
        loadStats();
    }, []);

    const totalImages = stats.reduce((s, u) => s + u.total, 0);
    const totalUsers = stats.length;

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">Admin Dashboard</h1>
                        {lastRefreshed && (
                            <p className="text-[9px] text-gray-600 uppercase tracking-widest">
                                Actualizado {formatDate(lastRefreshed.toISOString())}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={loadStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-all"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Usuarios</p>
                    <p className="text-3xl font-black text-white">{totalUsers}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Imágenes Generadas</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-white">{totalImages}</p>
                        <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Media por Usuario</p>
                    <p className="text-3xl font-black text-white">
                        {totalUsers > 0 ? (totalImages / totalUsers).toFixed(1) : '0'}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-[#0a0a0a]">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando stats...
                    </div>
                ) : stats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                        Sin datos aún. Las generaciones se trackearán a partir de ahora.
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5 sticky top-0">
                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">Usuario</th>
                                {SECTIONS.map(s => (
                                    <th key={s} className="px-3 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-500 text-center">
                                        {SECTION_LABELS[s]}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-500 text-center">Total</th>
                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">Última actividad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((user, idx) => (
                                <tr
                                    key={user.userId}
                                    className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${idx % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                                >
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="text-[11px] font-bold text-white truncate max-w-[200px]">{user.email}</p>
                                            <p className="text-[8px] text-gray-600 font-mono truncate max-w-[200px]">{user.userId.slice(0, 8)}…</p>
                                        </div>
                                    </td>
                                    {SECTIONS.map(s => (
                                        <td key={s} className="px-3 py-3 text-center">
                                            <span className={`text-[11px] font-bold tabular-nums ${(user as any)[s] > 0 ? 'text-white' : 'text-gray-700'}`}>
                                                {(user as any)[s]}
                                            </span>
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-white/10 text-[11px] font-black text-white tabular-nums">
                                            {user.total}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[10px] text-gray-500 font-medium">{formatDate(user.lastActivity)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AdminView;
