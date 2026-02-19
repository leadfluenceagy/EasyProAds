import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ShieldCheck, TrendingUp, Calendar, ChevronDown, X } from 'lucide-react';
import { fetchAdminStats, UserStat, DateRange } from '../services/adminService';

interface AdminViewProps {
    onUnauthorized: () => void;
}

const SECTIONS: (keyof Omit<UserStat, 'userId' | 'email' | 'total' | 'lastActivity'>)[] = [
    'generator', 'editor', 'formats', 'refcopy', 'banners', 'fashion'
];

const SECTION_LABELS: Record<string, string> = {
    generator: 'Generator', editor: 'Editor', formats: 'Formats',
    refcopy: 'Ref Copy', banners: 'Banners', fashion: 'Fashion',
};

// Returns today as YYYY-MM-DD for input[type=date]
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

// n days ago as YYYY-MM-DD
function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

// End of today ISO
function endOfDay(dateStr: string) {
    return `${dateStr}T23:59:59.999Z`;
}

function startOfDay(dateStr: string) {
    return `${dateStr}T00:00:00.000Z`;
}

const PRESETS = [
    { label: 'Hoy', from: () => daysAgo(0), to: () => todayStr() },
    { label: '7 días', from: () => daysAgo(7), to: () => todayStr() },
    { label: '30 días', from: () => daysAgo(30), to: () => todayStr() },
    { label: '3 meses', from: () => daysAgo(90), to: () => todayStr() },
    { label: 'Todo', from: () => '', to: () => '' },
];

function formatDisplayDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTableDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const AdminView: React.FC<AdminViewProps> = ({ onUnauthorized }) => {
    const [stats, setStats] = useState<UserStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    // Date range state (stored as YYYY-MM-DD strings or '' for all)
    const [fromDate, setFromDate] = useState<string>(daysAgo(30));
    const [toDate, setToDate] = useState<string>(todayStr());
    const [activePreset, setActivePreset] = useState<string>('30 días');

    // Picker dropdown
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const buildRange = useCallback((): DateRange => ({
        from: fromDate ? startOfDay(fromDate) : null,
        to: toDate ? endOfDay(toDate) : null,
    }), [fromDate, toDate]);

    const loadStats = useCallback(async () => {
        setLoading(true);
        const data = await fetchAdminStats(buildRange());
        setStats(data);
        setLastRefreshed(new Date());
        setLoading(false);
    }, [buildRange]);

    useEffect(() => { loadStats(); }, [fromDate, toDate]);

    const applyPreset = (preset: typeof PRESETS[0]) => {
        const f = preset.from();
        const t = preset.to();
        setFromDate(f);
        setToDate(t);
        setActivePreset(preset.label);
        setPickerOpen(false);
    };

    const handleCustomDateApply = () => {
        setActivePreset('');
        setPickerOpen(false);
    };

    const totalImages = stats.reduce((s, u) => s + u.total, 0);
    const totalUsers = stats.length;
    const topSection = (() => {
        const sums: Record<string, number> = {};
        for (const u of stats) for (const s of SECTIONS) sums[s] = (sums[s] || 0) + (u as any)[s];
        const top = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
        return top ? SECTION_LABELS[top[0]] : '—';
    })();

    // Label for the picker button
    const rangeLabel = activePreset
        ? activePreset
        : fromDate || toDate
            ? `${fromDate ? formatDisplayDate(startOfDay(fromDate)) : '∞'} → ${toDate ? formatDisplayDate(endOfDay(toDate)) : '∞'}`
            : 'Todo';

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">Admin Dashboard</h1>
                        {lastRefreshed && (
                            <p className="text-[9px] text-gray-600 uppercase tracking-widest">
                                Actualizado {formatTableDate(lastRefreshed.toISOString())}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Date range picker */}
                    <div className="relative" ref={pickerRef}>
                        {/* Trigger button */}
                        <button
                            onClick={() => setPickerOpen(v => !v)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-white transition-all"
                        >
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>{rangeLabel}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown panel */}
                        {pickerOpen && (
                            <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-[#111] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Quick presets */}
                                <div className="p-4 border-b border-white/10">
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 mb-2">Periodos rápidos</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {PRESETS.map(preset => (
                                            <button
                                                key={preset.label}
                                                onClick={() => applyPreset(preset)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activePreset === preset.label
                                                        ? 'bg-white text-black'
                                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom date range */}
                                <div className="p-4">
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 mb-3">Rango personalizado</p>
                                    <div className="flex flex-col gap-3">
                                        <div>
                                            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Desde</label>
                                            <input
                                                type="date"
                                                value={fromDate}
                                                max={toDate || todayStr()}
                                                onChange={e => { setFromDate(e.target.value); setActivePreset(''); }}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-white focus:outline-none focus:border-white/30 transition-all [color-scheme:dark]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Hasta</label>
                                            <input
                                                type="date"
                                                value={toDate}
                                                min={fromDate}
                                                max={todayStr()}
                                                onChange={e => { setToDate(e.target.value); setActivePreset(''); }}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-white focus:outline-none focus:border-white/30 transition-all [color-scheme:dark]"
                                            />
                                        </div>
                                        <button
                                            onClick={handleCustomDateApply}
                                            className="w-full py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-gray-200 transition-all"
                                        >
                                            Aplicar rango
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-all"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Usuarios activos</p>
                    <p className="text-3xl font-black text-white">{totalUsers}</p>
                    <p className="text-[8px] text-gray-600 mt-1">en el periodo</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Imágenes generadas</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-white">{totalImages}</p>
                        <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />
                    </div>
                    <p className="text-[8px] text-gray-600 mt-1">en el periodo</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Media por usuario</p>
                    <p className="text-3xl font-black text-white">
                        {totalUsers > 0 ? (totalImages / totalUsers).toFixed(1) : '0'}
                    </p>
                    <p className="text-[8px] text-gray-600 mt-1">imágenes</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Sección top</p>
                    <p className="text-2xl font-black text-white leading-tight mt-1">{topSection}</p>
                    <p className="text-[8px] text-gray-600 mt-1">más usada</p>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-[#0a0a0a]">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando stats...
                    </div>
                ) : stats.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-600">
                        <TrendingUp className="w-8 h-8 opacity-30" />
                        <p className="text-sm">Sin generaciones en este periodo</p>
                        <p className="text-[10px] text-gray-700">Cambia el rango de fechas para ver más datos</p>
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
                                        <span className="text-[10px] text-gray-500 font-medium">{formatTableDate(user.lastActivity)}</span>
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
