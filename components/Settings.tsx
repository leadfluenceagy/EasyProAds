import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { User, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

interface SettingsProps {
    session: Session | null;
}

export const Settings: React.FC<SettingsProps> = ({ session }) => {
    const [newUsername, setNewUsername] = useState(session?.user?.user_metadata?.username || '');
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errText, setErrText] = useState('');

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername.trim()) return;
        setUpdateStatus('loading');
        setErrText('');

        try {
            // 1. Update auth metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { username: newUsername.trim() }
            });
            if (authError) throw authError;

            // 2. Upsert into profiles table manually (to handle old accounts)
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: session?.user?.id,
                    username: newUsername.trim(),
                    email: session?.user?.email
                }, { onConflict: 'id' });

            if (profileError) throw profileError;

            setUpdateStatus('success');
            setTimeout(() => setUpdateStatus('idle'), 3000);
        } catch (err: any) {
            setUpdateStatus('error');
            setErrText(err.message);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 md:p-10 max-w-2xl mx-auto w-full gap-8 overflow-y-auto">
            <header className="space-y-2">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Settings</h2>
                <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Account & Profile Configuration</p>
            </header>

            <div className="glass-panel border border-white/5 bg-white/5 p-8 rounded-[2rem] shadow-xl space-y-8">
                <section className="space-y-6">
                    <div className="flex items-center gap-4 text-purple-400">
                        <SettingsIcon className="w-5 h-5" />
                        <h3 className="text-sm font-black uppercase tracking-widest">Profile Identity</h3>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-white transition-colors">
                                    <User className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Set your username..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                />
                            </div>
                            <p className="text-[9px] text-gray-600 font-medium px-2 italic">
                                This is how others will see you in the community board.
                            </p>
                        </div>

                        {updateStatus === 'success' && (
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold text-center">
                                Profile updated successfully!
                            </div>
                        )}
                        {updateStatus === 'error' && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                                {errText}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={updateStatus === 'loading'}
                            className="w-full py-4 bg-white text-black rounded-xl font-bold text-sm uppercase tracking-wider hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                        >
                            {updateStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                        </button>
                    </form>
                </section>

                <div className="pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-gray-600 font-bold uppercase tracking-widest px-2">
                        <span>Email</span>
                        <span className="text-gray-400">{session?.user?.email}</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto text-center py-10 opacity-20 group hover:opacity-100 transition-opacity">
                <p className="text-[8px] font-black uppercase tracking-[0.5em] text-gray-500">EasyProAds Control v1.0.4</p>
            </div>
        </div>
    );
};
