import { supabase } from './supabase';

export interface UserStat {
    userId: string;
    email: string;
    generator: number;
    editor: number;
    formats: number;
    refcopy: number;
    banners: number;
    fashion: number;
    total: number;
    lastActivity: string | null;
}

export type GenerationSection = 'generator' | 'editor' | 'formats' | 'refcopy' | 'banners' | 'fashion';

export interface DateRange {
    from: string | null; // ISO string
    to: string | null;   // ISO string
}

/**
 * Track a single image generation event for the current user.
 */
export async function trackImageGeneration(
    userId: string,
    section: GenerationSection
): Promise<void> {
    const { error } = await supabase
        .from('image_usage')
        .insert({ user_id: userId, section });
    if (error) {
        console.warn('⚠️ [adminService] trackImageGeneration error:', error.message);
    }
}

/**
 * Check if the current user is admin.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
    if (error || !data) return false;
    return data.is_admin === true;
}

/**
 * Fetch usage stats for all users, optionally filtered by date range.
 */
export async function fetchAdminStats(range: DateRange = { from: null, to: null }): Promise<UserStat[]> {
    let query = supabase
        .from('image_usage')
        .select('user_id, section, created_at');

    if (range.from) query = query.gte('created_at', range.from);
    if (range.to) query = query.lte('created_at', range.to);

    const { data: usageRows, error: usageError } = await query;
    if (usageError) {
        console.error('❌ [adminService] fetchAdminStats usage error:', usageError);
        return [];
    }

    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email');
    if (profilesError) {
        console.error('❌ [adminService] fetchAdminStats profiles error:', profilesError);
        return [];
    }

    const emailMap: Record<string, string> = {};
    for (const p of profiles || []) emailMap[p.id] = p.email || p.id;

    const statsMap: Record<string, UserStat> = {};
    for (const row of usageRows || []) {
        if (!statsMap[row.user_id]) {
            statsMap[row.user_id] = {
                userId: row.user_id,
                email: emailMap[row.user_id] || row.user_id,
                generator: 0, editor: 0, formats: 0, refcopy: 0, banners: 0, fashion: 0,
                total: 0, lastActivity: null,
            };
        }
        const stat = statsMap[row.user_id];
        const section = row.section as GenerationSection;
        if (section in stat) (stat as any)[section]++;
        stat.total++;
        if (!stat.lastActivity || row.created_at > stat.lastActivity) {
            stat.lastActivity = row.created_at;
        }
    }

    return Object.values(statsMap).sort((a, b) => b.total - a.total);
}
