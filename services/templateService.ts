import { supabase } from './supabase';

export interface RefCopyTemplate {
    id: string;
    url: string;
    storagePath: string;
}

/**
 * Fetch all templates for the current user from Supabase.
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

    return (data || []).map(row => ({
        id: row.id,
        url: row.image_url,
        storagePath: row.storage_path,
    }));
}

/**
 * Upload a template image to Supabase Storage and save the record in the DB.
 * Returns the new template object, or null on failure.
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
        // Clean up orphaned file
        await supabase.storage.from('refcopy-templates').remove([storagePath]);
        return null;
    }

    const imageUrl = signedData.signedUrl;

    // 3. Insert record in DB
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

    return { id: insertData.id, url: imageUrl, storagePath };
}

/**
 * Delete a template — removes from Storage and DB.
 */
export async function deleteTemplate(
    templateId: string,
    storagePath: string
): Promise<void> {
    // Remove from DB first (RLS handles ownership check)
    const { error: dbError } = await supabase
        .from('refcopy_templates')
        .delete()
        .eq('id', templateId);

    if (dbError) {
        console.error('❌ [templateService] deleteTemplate DB error:', dbError);
        return;
    }

    // Remove from Storage
    const { error: storageError } = await supabase.storage
        .from('refcopy-templates')
        .remove([storagePath]);

    if (storageError) {
        console.error('❌ [templateService] deleteTemplate Storage error:', storageError);
    }
}
