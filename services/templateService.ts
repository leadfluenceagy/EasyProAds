import { supabase } from './supabase';

export interface RefCopyTemplate {
    id: string;
    url: string;
    storagePath: string;
    base64?: string; // base64 data URI — populated when available so Gemini never gets a raw URL
}

/**
 * Downloads an image URL and returns it as a base64 data‑URI.
 */
async function urlToBase64(url: string): Promise<string> {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Converts a File to a base64 data‑URI.
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Fetch all templates for the current user from Supabase.
 * Each template's `base64` field is populated so callers never need to handle raw Supabase URLs.
 */
export async function fetchTemplates(userId: string): Promise<RefCopyTemplate[]> {
    const { data, error } = await supabase
        .from('refcopy_templates')
        .select('id, image_url, storage_path')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ [templateService] fetchTemplates error:', error);
        return [];
    }

    const rows = data || [];

    // Convert all template URLs to base64 in parallel
    const templates = await Promise.all(
        rows.map(async (row) => {
            let base64: string | undefined;
            try {
                base64 = await urlToBase64(row.image_url);
            } catch (e) {
                console.warn('⚠️ [templateService] Could not convert template to base64:', row.id, e);
            }
            return {
                id: row.id,
                url: row.image_url,
                storagePath: row.storage_path,
                base64,
            };
        })
    );

    return templates;
}

/**
 * Upload a template image to Supabase Storage and save the record in the DB.
 * Returns the new template object (with base64 pre-populated), or null on failure.
 */
export async function uploadTemplate(
    userId: string,
    file: File
): Promise<RefCopyTemplate | null> {
    const ext = file.name.split('.').pop() || 'png';
    const storagePath = `${userId}/${Date.now()}.${ext}`;

    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
        .from('refcopy-templates')
        .upload(storagePath, file, { upsert: false });

    if (uploadError) {
        console.error('❌ [templateService] uploadTemplate storage error:', uploadError);
        return null;
    }

    // 2. Get a signed URL (valid for 10 years ~ long enough)
    const { data: signedData, error: signError } = await supabase.storage
        .from('refcopy-templates')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (signError || !signedData?.signedUrl) {
        console.error('❌ [templateService] createSignedUrl error:', signError);
        await supabase.storage.from('refcopy-templates').remove([storagePath]);
        return null;
    }

    const imageUrl = signedData.signedUrl;

    // 3. Convert the local file directly to base64 (faster than re-downloading)
    let base64: string | undefined;
    try {
        base64 = await fileToBase64(file);
    } catch (e) {
        console.warn('⚠️ [templateService] Could not convert uploaded file to base64:', e);
    }

    // 4. Insert record in DB
    const { data: insertData, error: insertError } = await supabase
        .from('refcopy_templates')
        .insert({ user_id: userId, image_url: imageUrl, storage_path: storagePath })
        .select('id')
        .single();

    if (insertError || !insertData) {
        console.error('❌ [templateService] insert error:', insertError);
        await supabase.storage.from('refcopy-templates').remove([storagePath]);
        return null;
    }

    return { id: insertData.id, url: imageUrl, storagePath, base64 };
}

/**
 * Delete a template — removes from Storage and DB.
 */
export async function deleteTemplate(
    templateId: string,
    storagePath: string
): Promise<void> {
    const { error: dbError } = await supabase
        .from('refcopy_templates')
        .delete()
        .eq('id', templateId);

    if (dbError) {
        console.error('❌ [templateService] deleteTemplate DB error:', dbError);
        return;
    }

    const { error: storageError } = await supabase.storage
        .from('refcopy-templates')
        .remove([storagePath]);

    if (storageError) {
        console.error('❌ [templateService] deleteTemplate Storage error:', storageError);
    }
}
