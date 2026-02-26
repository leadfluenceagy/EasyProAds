import React, { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import {
    ChevronDown,
    ChevronUp,
    Download,
    Image as ImageIcon,
    Loader2,
    Package,
    Palette,
    Plus,
    RefreshCw,
    Settings2,
    Sparkles,
    Trash2,
    Upload,
    X,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import {
    GoomProduct,
    GOOM_PRODUCTS,
    GoomBrandConfig,
    GoomProductImage,
    GoomReferenceCreative,
    fetchBrandConfig,
    saveBrandConfig,
    fetchProductImages,
    uploadProductImage,
    deleteProductImage,
    fetchReferenceCreatives,
    uploadReferenceCreative,
    deleteReferenceCreative,
} from '../services/goomService';
import { generateGoomCreativesBatch } from '../services/geminiService';
import { trackImageGeneration } from '../services/adminService';

interface GoomViewProps {
    session: Session;
}

type BarStatus = 'idle' | 'processing' | 'done' | 'error';

interface GoomBar {
    id: number;
    product: GoomProduct | '';
    adType: string;
    prompt: string;
    status: BarStatus;
    result: string | null;
}

const createEmptyBars = (): GoomBar[] =>
    Array.from({ length: 10 }, (_, i) => ({
        id: i,
        product: '',
        adType: '',
        prompt: '',
        status: 'idle' as BarStatus,
        result: null,
    }));

const GoomView: React.FC<GoomViewProps> = ({ session }) => {
    // Config state
    const [brandConfig, setBrandConfig] = useState<GoomBrandConfig | null>(null);
    const [productImages, setProductImages] = useState<GoomProductImage[]>([]);
    const [referenceCreatives, setReferenceCreatives] = useState<GoomReferenceCreative[]>([]);
    const [configOpen, setConfigOpen] = useState(false);
    const [configLoading, setConfigLoading] = useState(true);
    const [styleGuide, setStyleGuide] = useState('');

    // Config upload states
    const [selectedConfigProduct, setSelectedConfigProduct] = useState<GoomProduct>('creatina');
    const [savingConfig, setSavingConfig] = useState(false);

    // Generation state
    const [bars, setBars] = useState<GoomBar[]>(createEmptyBars);
    const [globalPrompt, setGlobalPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [globalAspectRatio, setGlobalAspectRatio] = useState<'9:16' | '1:1'>('9:16');

    // Refs
    const logoInputRef = useRef<HTMLInputElement>(null);
    const productImageInputRef = useRef<HTMLInputElement>(null);
    const referenceInputRef = useRef<HTMLInputElement>(null);

    // Load data on mount
    useEffect(() => {
        if (!session?.user?.id) return;
        loadConfig();
    }, [session?.user?.id]);

    const loadConfig = async () => {
        setConfigLoading(true);
        try {
            const [config, images, refs] = await Promise.all([
                fetchBrandConfig(session.user.id),
                fetchProductImages(session.user.id),
                fetchReferenceCreatives(session.user.id),
            ]);
            setBrandConfig(config);
            setStyleGuide(config?.styleGuide || '');
            setProductImages(images);
            setReferenceCreatives(refs);
        } catch (e) {
            console.error('Failed to load GOOM config:', e);
        } finally {
            setConfigLoading(false);
        }
    };

    // --- CONFIG HANDLERS ---

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSavingConfig(true);
        const result = await saveBrandConfig(session.user.id, file, styleGuide, brandConfig);
        if (result) setBrandConfig(result);
        setSavingConfig(false);
        e.target.value = '';
    };

    const handleSaveStyleGuide = async () => {
        setSavingConfig(true);
        const result = await saveBrandConfig(session.user.id, null, styleGuide, brandConfig);
        if (result) setBrandConfig(result);
        setSavingConfig(false);
    };

    const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files) as File[];
        for (const file of files) {
            const img = await uploadProductImage(session.user.id, selectedConfigProduct, file);
            if (img) setProductImages(prev => [...prev, img]);
        }
        e.target.value = '';
    };

    const handleDeleteProductImage = async (img: GoomProductImage) => {
        await deleteProductImage(img.id, img.storagePath);
        setProductImages(prev => prev.filter(p => p.id !== img.id));
    };

    const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files) as File[];
        for (const file of files) {
            const ref = await uploadReferenceCreative(session.user.id, file);
            if (ref) setReferenceCreatives(prev => [...prev, ref]);
        }
        e.target.value = '';
    };

    const handleDeleteReference = async (ref: GoomReferenceCreative) => {
        await deleteReferenceCreative(ref.id, ref.storagePath);
        setReferenceCreatives(prev => prev.filter(r => r.id !== ref.id));
    };

    // --- BAR HANDLERS ---

    const updateBar = (index: number, updates: Partial<GoomBar>) => {
        setBars(prev => prev.map((bar, i) => (i === index ? { ...bar, ...updates } : bar)));
    };

    // --- GENERATION ---

    const handleGenerate = async () => {
        // Find bars with a product selected
        const activeBars = bars
            .map((bar, index) => ({ bar, index }))
            .filter(({ bar }) => bar.product !== '');

        if (activeBars.length === 0) return;

        setIsGenerating(true);

        // Reset statuses
        activeBars.forEach(({ index }) => {
            updateBar(index, { status: 'processing', result: null });
        });

        // Build items for batch generation
        const items = activeBars.map(({ bar }) => {
            // Get product images for this bar's product
            const prodImgs = productImages
                .filter(p => p.productName === bar.product)
                .map(p => p.base64 || p.imageUrl)
                .filter(Boolean);

            // Combine global prompt + individual prompt
            const combinedPrompt = [globalPrompt, bar.prompt].filter(Boolean).join('. ');

            return {
                prompt: combinedPrompt || `Create a stunning ad creative for ${bar.product}`,
                productImages: prodImgs,
                aspectRatio: globalAspectRatio as '9:16' | '1:1',
            };
        });

        // Get reference creatives base64
        const refImages = referenceCreatives
            .map(r => r.base64 || r.imageUrl)
            .filter(Boolean);

        try {
            await generateGoomCreativesBatch(
                items,
                brandConfig?.logoBase64 || null,
                refImages,
                styleGuide,
                3, // concurrency
                (batchIndex, status, result) => {
                    const { index } = activeBars[batchIndex];
                    if (status === 'start') {
                        updateBar(index, { status: 'processing' });
                    } else if (status === 'done' && result) {
                        updateBar(index, { status: 'done', result });
                        trackImageGeneration(session.user.id, 'goom');
                    } else if (status === 'error') {
                        updateBar(index, { status: 'error' });
                    }
                }
            );
        } catch (error) {
            console.error('Batch generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (imageUrl: string, index: number) => {
        if (!imageUrl.startsWith('data:')) return;
        const [header, base64Data] = imageUrl.split(',');
        const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/png';
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `goom-creative-${index + 1}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    };

    const handleClearAll = () => {
        setBars(createEmptyBars());
        setGlobalPrompt('');
    };

    // Count active (with product selected) bars
    const activeCount = bars.filter(b => b.product !== '').length;
    const doneCount = bars.filter(b => b.status === 'done').length;

    return (
        <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
            {/* Hidden file inputs */}
            <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
            <input type="file" ref={productImageInputRef} onChange={handleProductImageUpload} className="hidden" accept="image/*" multiple />
            <input type="file" ref={referenceInputRef} onChange={handleReferenceUpload} className="hidden" accept="image/*" multiple />

            {/* HEADER */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-wider text-white">GOOM</h1>
                        <p className="text-[9px] text-gray-500 uppercase tracking-widest">Generación masiva de creativos</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setConfigOpen(!configOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${configOpen
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <Settings2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Config</span>
                        {configOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={handleClearAll}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Limpiar</span>
                    </button>
                </div>
            </div>

            {/* CONFIG PANEL (collapsible) */}
            {configOpen && (
                <div className="shrink-0 bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 max-h-[40vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                    {configLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* LOGO */}
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5" /> Logo de marca
                                </h3>
                                <div
                                    className="relative border-2 border-dashed border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors h-[100px] flex items-center justify-center cursor-pointer group"
                                    onClick={() => logoInputRef.current?.click()}
                                >
                                    {brandConfig?.logoBase64 ? (
                                        <img
                                            src={brandConfig.logoBase64}
                                            className="max-h-[80px] max-w-full object-contain"
                                            alt="Logo"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-gray-600">
                                            <Upload className="w-5 h-5" />
                                            <span className="text-[8px] font-bold uppercase">Subir logo</span>
                                        </div>
                                    )}
                                    {savingConfig && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* PRODUCT IMAGES */}
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <ImageIcon className="w-3.5 h-3.5" /> Fotos de producto
                                    <span className="normal-case tracking-normal font-normal text-gray-600">
                                        — {GOOM_PRODUCTS.find(p => p.value === selectedConfigProduct)?.label}
                                        ({productImages.filter(p => p.productName === selectedConfigProduct).length})
                                    </span>
                                </h3>
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={selectedConfigProduct}
                                        onChange={e => setSelectedConfigProduct(e.target.value as GoomProduct)}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white font-bold appearance-none cursor-pointer"
                                    >
                                        {GOOM_PRODUCTS.map(p => (
                                            <option key={p.value} value={p.value} className="bg-[#111]">
                                                {p.label} ({productImages.filter(i => i.productName === p.value).length})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => productImageInputRef.current?.click()}
                                        className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all"
                                        title={`Añadir foto para ${GOOM_PRODUCTS.find(p => p.value === selectedConfigProduct)?.label}`}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div key={selectedConfigProduct} className="grid grid-cols-4 gap-1.5 min-h-[40px] max-h-[100px] overflow-y-auto">
                                    {productImages.filter(p => p.productName === selectedConfigProduct).length === 0 ? (
                                        <div className="col-span-4 flex items-center justify-center h-[40px] border border-dashed border-white/5 rounded-lg">
                                            <span className="text-[8px] text-gray-600 uppercase">Sin fotos aún</span>
                                        </div>
                                    ) : (
                                        productImages
                                            .filter(p => p.productName === selectedConfigProduct)
                                            .map(img => (
                                                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                                                    <img src={img.base64 || img.imageUrl} className="w-full h-full object-cover" alt="" />
                                                    <button
                                                        onClick={() => handleDeleteProductImage(img)}
                                                        className="absolute top-0.5 right-0.5 bg-red-500 p-0.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-2 h-2" />
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* REFERENCE CREATIVES */}
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                    <Palette className="w-3.5 h-3.5" /> Creativos de referencia
                                    <span className="text-[8px] text-gray-600 normal-case tracking-normal">
                                        ({referenceCreatives.length})
                                    </span>
                                </h3>
                                <div
                                    className="border-2 border-dashed border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors h-[60px] flex items-center justify-center cursor-pointer"
                                    onClick={() => referenceInputRef.current?.click()}
                                >
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Plus className="w-4 h-4" />
                                        <span className="text-[8px] font-bold uppercase">Añadir referencias</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-5 gap-1.5 max-h-[80px] overflow-y-auto">
                                    {referenceCreatives.map(ref => (
                                        <div key={ref.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                                            <img src={ref.base64 || ref.imageUrl} className="w-full h-full object-cover" alt="" />
                                            <button
                                                onClick={() => handleDeleteReference(ref)}
                                                className="absolute top-0.5 right-0.5 bg-red-500 p-0.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-2 h-2" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STYLE GUIDE */}
                    {!configLoading && (
                        <div className="space-y-2 border-t border-white/5 pt-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Style Guide (texto)</h3>
                            <div className="flex gap-2">
                                <textarea
                                    value={styleGuide}
                                    onChange={e => setStyleGuide(e.target.value)}
                                    placeholder="Describe el estilo visual de la marca: colores, tipografía, mood..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white placeholder-gray-600 resize-none h-[60px] focus:outline-none focus:border-emerald-500/50"
                                />
                                <button
                                    onClick={handleSaveStyleGuide}
                                    disabled={savingConfig}
                                    className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/30 transition-all disabled:opacity-50 self-end"
                                >
                                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* GLOBAL CONTROLS */}
            <div className="shrink-0 flex items-center gap-3">
                {/* Global prompt */}
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={globalPrompt}
                        onChange={e => setGlobalPrompt(e.target.value)}
                        placeholder="Prompt global (se aplica a todas las barras)..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 pr-24"
                        disabled={isGenerating}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {/* Aspect ratio toggle */}
                        <button
                            onClick={() => setGlobalAspectRatio(prev => prev === '9:16' ? '1:1' : '9:16')}
                            className="px-2 py-1 bg-white/5 text-gray-500 rounded-lg text-[9px] font-bold hover:bg-white/10 transition-all"
                            disabled={isGenerating}
                        >
                            {globalAspectRatio}
                        </button>
                    </div>
                </div>

                {/* Generate button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || activeCount === 0}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${isGenerating || activeCount === 0
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20'
                        }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {doneCount}/{activeCount}
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Generar {activeCount > 0 ? `(${activeCount})` : ''}
                        </>
                    )}
                </button>
            </div>

            {/* 10 BARS */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {bars.map((bar, index) => (
                    <div
                        key={bar.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${bar.status === 'processing'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : bar.status === 'done'
                                ? 'bg-emerald-500/5 border-emerald-500/10'
                                : bar.status === 'error'
                                    ? 'bg-red-500/5 border-red-500/20'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                            }`}
                    >
                        {/* Number */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black ${bar.status === 'done'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : bar.status === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : bar.status === 'processing'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-white/5 text-gray-500'
                            }`}>
                            {bar.status === 'processing' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : bar.status === 'done' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : bar.status === 'error' ? (
                                <AlertCircle className="w-3.5 h-3.5" />
                            ) : (
                                index + 1
                            )}
                        </div>

                        {/* Product dropdown */}
                        <select
                            value={bar.product}
                            onChange={e => updateBar(index, { product: e.target.value as GoomProduct | '' })}
                            disabled={isGenerating}
                            className="w-[160px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-bold appearance-none cursor-pointer shrink-0 focus:outline-none focus:border-emerald-500/50"
                        >
                            <option value="" className="bg-[#111]">Seleccionar producto...</option>
                            {GOOM_PRODUCTS.map(p => (
                                <option key={p.value} value={p.value} className="bg-[#111]">
                                    {p.label}
                                </option>
                            ))}
                        </select>

                        {/* Ad type dropdown */}
                        <select
                            value={bar.adType}
                            onChange={e => updateBar(index, { adType: e.target.value })}
                            disabled={isGenerating}
                            className="w-[140px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-bold appearance-none cursor-pointer shrink-0 focus:outline-none focus:border-emerald-500/50"
                        >
                            <option value="" className="bg-[#111]">Tipo de anuncio...</option>
                        </select>

                        {/* Individual prompt */}
                        <input
                            type="text"
                            value={bar.prompt}
                            onChange={e => updateBar(index, { prompt: e.target.value })}
                            placeholder="Instrucciones específicas (opcional)..."
                            disabled={isGenerating}
                            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                        />

                        {/* Result preview */}
                        <div className="w-[50px] h-[50px] rounded-lg overflow-hidden shrink-0 border border-white/10 bg-white/[0.02]">
                            {bar.result ? (
                                <img
                                    src={bar.result}
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                    alt={`Creative ${index + 1}`}
                                    onClick={() => {
                                        // Open in new tab for full preview
                                        const win = window.open();
                                        if (win) {
                                            win.document.write(`<img src="${bar.result}" style="max-width:100%;max-height:100vh;margin:auto;display:block;background:#000;" />`);
                                        }
                                    }}
                                />
                            ) : bar.status === 'processing' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                </div>
                            ) : bar.status === 'error' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-3 h-3 text-gray-700" />
                                </div>
                            )}
                        </div>

                        {/* Download button */}
                        {bar.result && (
                            <button
                                onClick={() => handleDownload(bar.result!, index)}
                                className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-all shrink-0"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GoomView;
