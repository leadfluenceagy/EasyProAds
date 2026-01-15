import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { MessageSquare, Send, Loader2, User } from 'lucide-react';

interface FeedbackItem {
    id: string;
    title: string;
    description: string;
    created_at: string;
    user_id: string;
}

export const Feedback: React.FC = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const fetchFeedbacks = async () => {
        try {
            const { data, error } = await supabase
                .from('feedbacks')
                .select(`
                    *,
                    profiles (
                        username
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            // Handle the type cast for the joined profile data
            const formattedData = (data as any[]).map(item => ({
                ...item,
                username: item.profiles?.username || 'Anonymous'
            }));
            setFeedbacks(formattedData);
        } catch (err) {
            console.error('Error fetching feedbacks:', err);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('feedbacks')
                .insert([
                    { title, description, user_id: user.id }
                ]);

            if (error) throw error;

            setTitle('');
            setDescription('');
            await fetchFeedbacks();
        } catch (err: any) {
            alert('Error sending feedback: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 md:p-10 max-w-4xl mx-auto w-full gap-8 overflow-y-auto">
            <header className="space-y-2">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Community Feedback</h2>
                <p className="text-gray-500 text-sm font-medium">Ayúdanos a mejorar EasyProAds con tus ideas.</p>
            </header>

            {/* FORM */}
            <div className="glass-panel border border-white/5 bg-white/5 p-6 rounded-[2rem] shadow-xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Subject</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief title..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pl-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Details about your suggestion..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all min-h-[120px] resize-none"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-white text-black rounded-xl font-bold text-sm uppercase tracking-wider hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Feedback</>}
                    </button>
                </form>
            </div>

            {/* FEEDBACK LIST */}
            <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">Public Board</h3>

                {fetching ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-600">No feedback yet. Be the first!</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {feedbacks.map((f) => (
                            <div key={f.id} className="glass-panel border border-white/5 bg-white/5 p-6 rounded-2xl hover:border-white/10 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <h4 className="font-bold text-white text-lg">{f.title}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white/5 px-3 py-1 rounded-full uppercase font-black">
                                        <User className="w-3 h-3 text-purple-400" />
                                        {(f as any).username}
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{f.description}</p>
                                <div className="mt-4 text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                                    {new Date(f.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
