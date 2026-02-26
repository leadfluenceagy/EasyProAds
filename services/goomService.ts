import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export type GoomProduct = 'creatina' | 'probioticos' | 'hair_skin_nails' | 'para_dormir' | 'vinagre_manzana' | 'ashwagandha';

export const GOOM_PRODUCTS: { value: GoomProduct; label: string }[] = [
    { value: 'creatina', label: 'Creatina' },
    { value: 'probioticos', label: 'Probióticos' },
    { value: 'hair_skin_nails', label: 'Hair Skin Nails' },
    { value: 'para_dormir', label: 'Para Dormir' },
    { value: 'vinagre_manzana', label: 'Vinagre de Manzana' },
    { value: 'ashwagandha', label: 'Ashwagandha' },
];

export interface GoomBrandConfig {
    id: string;
    logoUrl: string | null;
    logoStoragePath: string | null;
    logoBase64: string | null;
    styleGuide: string;
}

export interface GoomProductImage {
    id: string;
    productName: GoomProduct;
    imageUrl: string;
    storagePath: string;
    base64?: string;
}

export interface GoomReferenceCreative {
    id: string;
    imageUrl: string;
    storagePath: string;
    category: string | null;
    base64?: string;
}

// ============================================
// HELPERS
// ============================================

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

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// BRAND CONFIG (LOGO + STYLE GUIDE)
// ============================================

export async function fetchBrandConfig(userId: string): Promise<GoomBrandConfig | null> {
    const { data, error } = await supabase
        .from('goom_brand_config')
        .select('id, logo_url, logo_storage_path, style_guide')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        if (error?.code !== 'PGRST116') { // Not "no rows" error
            console.error('❌ [goomService] fetchBrandConfig error:', error);
        }
        return null;
    }

    let logoBase64: string | null = null;
    if (data.logo_url) {
        try {
            logoBase64 = await urlToBase64(data.logo_url);
        } catch (e) {
            console.warn('⚠️ [goomService] Could not convert logo to base64:', e);
        }
    }

    return {
        id: data.id,
        logoUrl: data.logo_url,
        logoStoragePath: data.logo_storage_path,
        logoBase64,
        styleGuide: data.style_guide || '',
    };
}

export async function saveBrandConfig(
    userId: string,
    logoFile: File | null,
    styleGuide: string,
    existingConfig: GoomBrandConfig | null
): Promise<GoomBrandConfig | null> {
    let logoUrl = existingConfig?.logoUrl || null;
    let logoStoragePath = existingConfig?.logoStoragePath || null;
    let logoBase64: string | null = existingConfig?.logoBase64 || null;

    // Upload new logo if provided
    if (logoFile) {
        // Remove old logo if exists
        if (logoStoragePath) {
            await supabase.storage.from('goom-product-images').remove([logoStoragePath]);
        }

        const ext = logoFile.name.split('.').pop() || 'png';
        logoStoragePath = `${userId}/logo.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('goom-product-images')
            .upload(logoStoragePath, logoFile, { upsert: true });

        if (uploadError) {
            console.error('❌ [goomService] logo upload error:', uploadError);
            return null;
        }

        const { data: signedData } = await supabase.storage
            .from('goom-product-images')
            .createSignedUrl(logoStoragePath, 60 * 60 * 24 * 365 * 10);

        logoUrl = signedData?.signedUrl || null;

        try {
            logoBase64 = await fileToBase64(logoFile);
        } catch (e) {
            console.warn('⚠️ [goomService] Could not convert logo to base64:', e);
        }
    }

    if (existingConfig) {
        // Update
        const { error } = await supabase
            .from('goom_brand_config')
            .update({
                logo_url: logoUrl,
                logo_storage_path: logoStoragePath,
                style_guide: styleGuide,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existingConfig.id);

        if (error) {
            console.error('❌ [goomService] update brand config error:', error);
            return null;
        }

        return { ...existingConfig, logoUrl, logoStoragePath, logoBase64, styleGuide };
    } else {
        // Insert
        const { data, error } = await supabase
            .from('goom_brand_config')
            .insert({
                user_id: userId,
                logo_url: logoUrl,
                logo_storage_path: logoStoragePath,
                style_guide: styleGuide,
            })
            .select('id')
            .single();

        if (error || !data) {
            console.error('❌ [goomService] insert brand config error:', error);
            return null;
        }

        return { id: data.id, logoUrl, logoStoragePath, logoBase64, styleGuide };
    }
}

// ============================================
// PRODUCT IMAGES
// ============================================

export async function fetchProductImages(userId: string, productName?: GoomProduct): Promise<GoomProductImage[]> {
    let query = supabase
        .from('goom_product_images')
        .select('id, product_name, image_url, storage_path')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (productName) {
        query = query.eq('product_name', productName);
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ [goomService] fetchProductImages error:', error);
        return [];
    }

    const images = await Promise.all(
        (data || []).map(async (row) => {
            let base64: string | undefined;
            try {
                base64 = await urlToBase64(row.image_url);
            } catch (e) {
                console.warn('⚠️ [goomService] Could not convert product image to base64:', row.id, e);
            }
            return {
                id: row.id,
                productName: row.product_name as GoomProduct,
                imageUrl: row.image_url,
                storagePath: row.storage_path,
                base64,
            };
        })
    );

    return images;
}

export async function uploadProductImage(
    userId: string,
    productName: GoomProduct,
    file: File
): Promise<GoomProductImage | null> {
    const ext = file.name.split('.').pop() || 'png';
    const storagePath = `${userId}/products/${productName}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('goom-product-images')
        .upload(storagePath, file, { upsert: false });

    if (uploadError) {
        console.error('❌ [goomService] uploadProductImage storage error:', uploadError);
        return null;
    }

    const { data: signedData } = await supabase.storage
        .from('goom-product-images')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (!signedData?.signedUrl) {
        await supabase.storage.from('goom-product-images').remove([storagePath]);
        return null;
    }

    let base64: string | undefined;
    try {
        base64 = await fileToBase64(file);
    } catch (e) {
        console.warn('⚠️ Could not convert to base64:', e);
    }

    const { data: insertData, error: insertError } = await supabase
        .from('goom_product_images')
        .insert({
            user_id: userId,
            product_name: productName,
            image_url: signedData.signedUrl,
            storage_path: storagePath,
        })
        .select('id')
        .single();

    if (insertError || !insertData) {
        console.error('❌ [goomService] insert product image error:', insertError);
        await supabase.storage.from('goom-product-images').remove([storagePath]);
        return null;
    }

    return {
        id: insertData.id,
        productName,
        imageUrl: signedData.signedUrl,
        storagePath,
        base64,
    };
}

export async function deleteProductImage(imageId: string, storagePath: string): Promise<void> {
    await supabase.from('goom_product_images').delete().eq('id', imageId);
    await supabase.storage.from('goom-product-images').remove([storagePath]);
}

// ============================================
// REFERENCE CREATIVES
// ============================================

export async function fetchReferenceCreatives(userId: string): Promise<GoomReferenceCreative[]> {
    const { data, error } = await supabase
        .from('goom_reference_creatives')
        .select('id, image_url, storage_path, category')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ [goomService] fetchReferenceCreatives error:', error);
        return [];
    }

    const creatives = await Promise.all(
        (data || []).map(async (row) => {
            let base64: string | undefined;
            try {
                base64 = await urlToBase64(row.image_url);
            } catch (e) {
                console.warn('⚠️ [goomService] Could not convert reference to base64:', row.id, e);
            }
            return {
                id: row.id,
                imageUrl: row.image_url,
                storagePath: row.storage_path,
                category: row.category,
                base64,
            };
        })
    );

    return creatives;
}

export async function uploadReferenceCreative(
    userId: string,
    file: File,
    category?: string
): Promise<GoomReferenceCreative | null> {
    const ext = file.name.split('.').pop() || 'png';
    const storagePath = `${userId}/references/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('goom-reference-creatives')
        .upload(storagePath, file, { upsert: false });

    if (uploadError) {
        console.error('❌ [goomService] uploadReferenceCreative storage error:', uploadError);
        return null;
    }

    const { data: signedData } = await supabase.storage
        .from('goom-reference-creatives')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (!signedData?.signedUrl) {
        await supabase.storage.from('goom-reference-creatives').remove([storagePath]);
        return null;
    }

    let base64: string | undefined;
    try {
        base64 = await fileToBase64(file);
    } catch (e) {
        console.warn('⚠️ Could not convert to base64:', e);
    }

    const { data: insertData, error: insertError } = await supabase
        .from('goom_reference_creatives')
        .insert({
            user_id: userId,
            image_url: signedData.signedUrl,
            storage_path: storagePath,
            category: category || null,
        })
        .select('id')
        .single();

    if (insertError || !insertData) {
        console.error('❌ [goomService] insert reference creative error:', insertError);
        await supabase.storage.from('goom-reference-creatives').remove([storagePath]);
        return null;
    }

    return {
        id: insertData.id,
        imageUrl: signedData.signedUrl,
        storagePath,
        category: category || null,
        base64,
    };
}

export async function deleteReferenceCreative(id: string, storagePath: string): Promise<void> {
    await supabase.from('goom_reference_creatives').delete().eq('id', id);
    await supabase.storage.from('goom-reference-creatives').remove([storagePath]);
}
