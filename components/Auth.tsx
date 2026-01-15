import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Mail, Lock, Loader2, ArrowRight, User } from 'lucide-react';

export const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [identifier, setIdentifier] = useState(''); // Email or Username
    const [email, setEmail] = useState(''); // Real email for verification
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [otpToken, setOtpToken] = useState('');
    const [view, setView] = useState<'sign_in' | 'sign_up' | 'verify'>('sign_in');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (view === 'sign_up') {
                if (!username.trim()) throw new Error('Username is required');
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username.trim()
                        }
                    }
                });
                if (signUpError) throw signUpError;
                setMessage('Successfully signed up! Enter the 6-digit code sent to your email.');
                setView('verify');
            } else if (view === 'sign_in') {
                let targetEmail = identifier.trim();

                // Check if the identifier is a username (no @)
                if (!targetEmail.includes('@')) {
                    const { data, error: profileError } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('username', targetEmail)
                        .single();

                    if (profileError || !data) {
                        throw new Error('Username not found');
                    }
                    targetEmail = data.email;
                }

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: targetEmail,
                    password,
                });
                if (signInError) throw signInError;
            } else if (view === 'verify') {
                const { error: verifyError } = await supabase.auth.verifyOtp({
                    email,
                    token: otpToken,
                    type: 'signup'
                });
                if (verifyError) throw verifyError;
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#020202] text-white p-4 font-sans">
            <div className="w-full max-w-sm">

                {/* LOGO Header */}
                <div className="flex flex-col items-center mb-8 space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-3xl">
                        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain opacity-80" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase">EasyProAds</h1>
                    <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">
                        {view === 'sign_up' ? 'Create Account' : view === 'verify' ? 'Verify Email' : 'Welcome Back'}
                    </p>
                </div>

                {/* AUTH BOX */}
                <div className="glass-panel border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">

                    {/* DECORATIVE GRADIENT */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-900/20 blur-[60px] rounded-full pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-900/20 blur-[60px] rounded-full pointer-events-none" />


                    <form onSubmit={handleAuth} className="space-y-6 relative z-10">

                        {view !== 'verify' ? (
                            <>
                                {view === 'sign_in' ? (
                                    /* LOGIN IDENTIFIER (Email or Username) */
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Email or Username</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-white transition-colors">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <input
                                                id="identifier"
                                                name="identifier"
                                                type="text"
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                                required
                                                placeholder="email or username"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all placeholder:text-gray-700 hover:bg-white/10"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* SIGN UP FIELDS */
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Username</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-white transition-colors">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <input
                                                    id="username"
                                                    name="username"
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value)}
                                                    required
                                                    placeholder="cooluser123"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all placeholder:text-gray-700 hover:bg-white/10"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Email</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-white transition-colors">
                                                    <Mail className="w-4 h-4" />
                                                </div>
                                                <input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                    placeholder="name@example.com"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all placeholder:text-gray-700 hover:bg-white/10"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* PASSWORD INPUT */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-white transition-colors">
                                            <Lock className="w-4 h-4" />
                                        </div>
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete={view === 'sign_up' ? 'new-password' : 'current-password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all placeholder:text-gray-700 hover:bg-white/10"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2 text-center">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Verification Code</label>
                                <input
                                    type="text"
                                    value={otpToken}
                                    onChange={(e) => setOtpToken(e.target.value.trim())}
                                    required
                                    placeholder="Enter code"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-6 text-xl font-bold text-center tracking-widest focus:outline-none focus:border-white/30 transition-all font-mono"
                                />
                                <p className="text-[10px] text-gray-600 font-medium px-4">Paste the code you received in your email for {email}</p>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setLoading(true);
                                        setError(null);
                                        const { error } = await supabase.auth.resend({
                                            type: 'signup',
                                            email,
                                        });
                                        if (error) setError(error.message);
                                        else setMessage('New code sent to your email!');
                                        setLoading(false);
                                    }}
                                    disabled={loading}
                                    className="text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-[0.2em] mt-4"
                                >
                                    Resend code
                                </button>
                            </div>
                        )}

                        {/* ALERTS */}
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium text-center">
                                {message}
                            </div>
                        )}

                        {/* SUBMIT BUTTON */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-white text-black rounded-xl font-bold text-sm uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {view === 'sign_up' ? 'Sign Up' : view === 'verify' ? 'Verify Code' : 'Sign In'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* TOGGLE LINK */}
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                if (view === 'verify') {
                                    setView('sign_up');
                                } else {
                                    setView(view === 'sign_in' ? 'sign_up' : 'sign_in');
                                }
                                setError(null);
                                setMessage(null);
                            }}
                            className="text-gray-500 text-xs font-medium hover:text-white transition-colors uppercase tracking-wide"
                        >
                            {view === 'sign_up' ? 'Already have an account? Sign In' : view === 'verify' ? 'Back to Sign Up' : "Don't have an account? Sign Up"}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
