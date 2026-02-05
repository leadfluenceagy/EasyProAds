import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GeneratedImage, AspectRatio, ChatMode } from './types';
import { professionalizePrompt, generateImage, optimizeEditorPrompt, generateEditorImage, optimizeFormatPrompt, generateFormatImage } from './services/geminiService';
import { supabase } from './services/supabase';
import { Auth } from './components/Auth';
import { Feedback } from './components/Feedback';
import { Session } from '@supabase/supabase-js';
import {
  Send,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Download,
  RefreshCw,
  Plus,
  Key,
  ShieldCheck,
  Zap,
  Paperclip,
  X,
  LayoutGrid,
  Repeat,
  Layers,
  Settings,
  LogOut,
  MessageSquare,
  User,
  Paintbrush,
  Eraser,
  Minus,
  ArrowRight
} from 'lucide-react';

// Fix: Use explicit global declaration for aistudio to avoid type conflicts and resolve Blob error
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

type View = 'workspace' | 'gallery' | 'settings' | 'feedback' | 'banners' | 'editor';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth change event:', _event, session?.user?.email);

      // Si hay un error de token, limpiar la sesión
      if (_event === 'TOKEN_REFRESHED' && !session) {
        console.warn('Token refresh failed, signing out...');
        await supabase.auth.signOut();
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setLoading(false);
    });

    // Comprobar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(async (err) => {
      console.error('Session check error:', err);

      // Si el error es de refresh token, limpiar todo y forzar re-login
      if (err?.message?.includes('refresh') || err?.message?.includes('token')) {
        console.warn('Invalid refresh token detected, clearing session...');
        await supabase.auth.signOut();
        setSession(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Navigation State
  const [currentView, setCurrentView] = useState<View>('workspace');
  const [activeMode, setActiveMode] = useState<ChatMode>('generator');

  // Estados de mensajes totalmente independientes por modo
  const [messagesByMode, setMessagesByMode] = useState<Record<ChatMode, ChatMessage[]>>({
    generator: [],
    iteration: [],
    fashion: []
  });

  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de prompts optimizados independientes
  const [promptMapByMode, setPromptMapByMode] = useState<Record<ChatMode, Record<string, string>>>({
    generator: {},
    iteration: {},
    fashion: {}
  });

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Editor-specific state
  const [editorImage916, setEditorImage916] = useState<string | null>(null);
  const [editorImage11, setEditorImage11] = useState<string | null>(null);
  const [showBrushModal, setShowBrushModal] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [mask916Data, setMask916Data] = useState<string | null>(null);
  const [mask11Data, setMask11Data] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeEditImage, setActiveEditImage] = useState<'916' | '11'>('916');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorInput916Ref = useRef<HTMLInputElement>(null);
  const editorInput11Ref = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Editor prompt and results state
  const [editorPrompt, setEditorPrompt] = useState('');
  const [editorResult916, setEditorResult916] = useState<string | null>(null);
  const [editorResult11, setEditorResult11] = useState<string | null>(null);
  const [isEditorProcessing, setIsEditorProcessing] = useState(false);
  const [editorStatus, setEditorStatus] = useState('');

  // Format section state
  const [formatInput916, setFormatInput916] = useState<string | null>(null);
  const [formatInput11, setFormatInput11] = useState<string | null>(null);
  const [formatResult916, setFormatResult916] = useState<string | null>(null);
  const [formatResult11, setFormatResult11] = useState<string | null>(null);
  const [isFormatProcessing, setIsFormatProcessing] = useState(false);
  const [formatStatus, setFormatStatus] = useState('');
  const formatInput916Ref = useRef<HTMLInputElement>(null);
  const formatInput11Ref = useRef<HTMLInputElement>(null);

  // Banner section state
  const [bannerInputText, setBannerInputText] = useState('');
  const [bannerIsProcessing, setBannerIsProcessing] = useState(false);
  const [bannerHistory, setBannerHistory] = useState<GeneratedImage[]>([]);
  const [bannerLastPrompt, setBannerLastPrompt] = useState('');
  const [bannerSelectedImages, setBannerSelectedImages] = useState<string[]>([]);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const activeMessages = messagesByMode[activeMode];

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const has = await window.aistudio?.hasSelectedApiKey();
        setHasKey(typeof has === 'boolean' ? has : !!has);
      } catch (e) {
        setHasKey(false);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    if (currentView === 'workspace') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages, activeMode, currentView]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    console.log('📁 [handleFileChange] Files selected:', files.length);
    files.forEach(file => {
      console.log('📷 [handleFileChange] Processing file:', file.name, file.type, file.size);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('✅ [handleFileChange] File loaded, size:', result.length);
        setSelectedImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Editor image handlers
  const handleEditor916Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditorImage916(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditor11Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditorImage11(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Editor generate function
  const handleEditorGenerate = async () => {
    if (!editorPrompt.trim() || isEditorProcessing) return;
    if (!editorImage916 && !editorImage11) return;

    setIsEditorProcessing(true);
    setEditorStatus('Analizando imagen y prompt...');

    try {
      // Generate for 9:16 image if present
      if (editorImage916) {
        setEditorStatus('Optimizando prompt para 9:16...');
        const optimizedPrompt916 = await optimizeEditorPrompt(
          editorPrompt,
          editorImage916,
          mask916Data
        );
        console.log('📝 Optimized 9:16 prompt:', optimizedPrompt916);

        setEditorStatus('Generando imagen 9:16...');
        const result916 = await generateEditorImage(optimizedPrompt916, editorImage916, '9:16');
        setEditorResult916(result916);
      }

      // Generate for 1:1 image if present
      if (editorImage11) {
        setEditorStatus('Optimizando prompt para 1:1...');
        const optimizedPrompt11 = await optimizeEditorPrompt(
          editorPrompt,
          editorImage11,
          mask11Data
        );
        console.log('📝 Optimized 1:1 prompt:', optimizedPrompt11);

        setEditorStatus('Generando imagen 1:1...');
        const result11 = await generateEditorImage(optimizedPrompt11, editorImage11, '1:1');
        setEditorResult11(result11);
      }

      setEditorStatus('¡Completado!');
    } catch (error: any) {
      console.error('❌ Editor generation failed:', error);
      setEditorStatus(`Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsEditorProcessing(false);
    }
  };

  // Format section handlers
  const handleFormatInput916Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormatInput916(reader.result as string);
      setFormatResult11(null); // Reset result
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFormatInput11Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormatInput11(reader.result as string);
      setFormatResult916(null); // Reset result
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFormatGenerate = async () => {
    if (isFormatProcessing) return;
    if (!formatInput916 && !formatInput11) return;

    setIsFormatProcessing(true);
    setFormatStatus('Analizando imagen...');

    try {
      // Convert 9:16 to 1:1
      if (formatInput916) {
        setFormatStatus('Generando prompt para 9:16 → 1:1...');
        const optimizedPrompt = await optimizeFormatPrompt(formatInput916, '9:16');
        console.log('📐 Format prompt (9:16→1:1):', optimizedPrompt);

        setFormatStatus('Generando imagen 1:1...');
        const result = await generateFormatImage(optimizedPrompt, formatInput916, '1:1');
        setFormatResult11(result);
      }

      // Convert 1:1 to 9:16
      if (formatInput11) {
        setFormatStatus('Generando prompt para 1:1 → 9:16...');
        const optimizedPrompt = await optimizeFormatPrompt(formatInput11, '1:1');
        console.log('📐 Format prompt (1:1→9:16):', optimizedPrompt);

        setFormatStatus('Generando imagen 9:16...');
        const result = await generateFormatImage(optimizedPrompt, formatInput11, '9:16');
        setFormatResult916(result);
      }

      setFormatStatus('¡Completado!');
    } catch (error: any) {
      console.error('❌ Format generation failed:', error);
      setFormatStatus(`Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsFormatProcessing(false);
    }
  };

  // Banner section handlers
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerSelectedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleBannerSend = async () => {
    if (!bannerInputText.trim() || bannerIsProcessing) return;

    setBannerIsProcessing(true);

    try {
      // Banner-specific prompt optimization
      const bannerSystemPrompt = `Eres un experto en prompt engineering especializado en generación de imágenes comerciales para e-commerce. Tu trabajo es transformar instrucciones simples del usuario en prompts detallados y optimizados para Gemini Pro 3.

## Tu objetivo
Convertir cualquier solicitud de banner en un prompt que genere imágenes profesionales, limpias y comercialmente efectivas.

## Reglas de optimización

### 1. Estructura del prompt de salida
Siempre genera el prompt en este orden:
- Tipo de imagen y propósito comercial
- Composición y distribución del espacio
- Producto/elemento principal (si aplica)
- Paleta de colores y ambiente
- Estilo visual y técnica
- Iluminación
- Espacio negativo para texto (CRÍTICO)
- Detalles técnicos de calidad

### 2. Principios clave para banners e-commerce
- SIEMPRE reservar 40-60% del espacio como área limpia para texto/copy
- Fondos que no compitan con el mensaje comercial
- Colores que evoquen la emoción de compra deseada (urgencia, lujo, frescura, etc.)
- Composición asimétrica: producto a un lado, espacio para copy al otro
- Evitar elementos que distraigan del mensaje principal

### 3. Palabras clave de calidad a incluir siempre
- "professional product photography"
- "clean commercial aesthetic"
- "high-end advertising"
- "soft natural lighting" o "studio lighting"
- "negative space for text overlay"
- "8k, sharp focus, photorealistic"

### 4. Lo que NUNCA debe incluir el prompt
- Texto renderizado (las IAs lo hacen mal)
- Logos
- Múltiples productos compitiendo
- Fondos demasiado complejos
- Personas con caras visibles (a menos que se solicite específicamente)

## Formato de salida para 16:9 (desktop):
Professional e-commerce banner, horizontal composition. [descripción del contenido y producto]. Large negative space (40-60% of frame) for text overlay. Clean minimalist aesthetic, high-end advertising style. Soft studio lighting. 8k resolution, photorealistic, sharp focus, commercial photography.

Ahora, transforma la siguiente solicitud del usuario en un prompt optimizado SOLO para formato 16:9:
"${bannerInputText}"

Responde ÚNICAMENTE con el prompt optimizado en inglés. Sin explicaciones adicionales.`;

      // Use professionalizePrompt but with banner-specific system prompt
      const optimizedPrompt = await professionalizePrompt(bannerSystemPrompt, 'generator', bannerSelectedImages);
      console.log('🎨 BANNER OPTIMIZED PROMPT (16:9):', optimizedPrompt);

      setBannerLastPrompt(optimizedPrompt);

      // Generate 16:9 image
      const finalImageUrl = await generateImage(optimizedPrompt, '16:9', bannerSelectedImages);
      console.log('✅ Banner 16:9 generated');

      setBannerHistory(prev => [...prev, {
        id: Date.now().toString(),
        url: finalImageUrl,
        prompt: optimizedPrompt,
        timestamp: Date.now(),
        aspectRatio: '16:9'
      }]);

    } catch (error: any) {
      console.error('❌ Banner generation failed:', error);
    } finally {
      setBannerIsProcessing(false);
    }
  };

  const handleBannerGenerate916 = async () => {
    if (!bannerLastPrompt || bannerIsProcessing) return;

    setBannerIsProcessing(true);

    try {
      // Adapt prompt for 9:16
      const prompt916 = bannerLastPrompt
        .replace('horizontal composition', 'vertical composition')
        .replace('16:9', '9:16')
        .replace(/left|right/gi, match => match === 'left' ? 'top' : 'bottom');

      const finalImageUrl = await generateImage(prompt916, '9:16', bannerSelectedImages);
      console.log('✅ Banner 9:16 generated');

      setBannerHistory(prev => [{
        id: Date.now().toString() + '-916',
        url: finalImageUrl,
        prompt: prompt916,
        timestamp: Date.now(),
        aspectRatio: '9:16'
      }, ...prev]);

    } catch (error: any) {
      console.error('❌ Banner 9:16 generation failed:', error);
    } finally {
      setBannerIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {

    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const downloadImage = (url: string, id: string) => {
    // Convert base64 data URL to Blob for proper download
    if (url.startsWith('data:')) {
      // Extract base64 data
      const [header, base64Data] = url.split(',');
      const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/png';

      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `easyproadds-${id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
    } else {
      // Fallback for regular URLs
      const link = document.createElement('a');
      link.href = url;
      link.download = `easyproadds-${id}.png`;
      link.click();
    }
  };

  const handleSend = async (text?: string) => {
    const query = text || inputText;

    console.log('🎬 [handleSend] Button clicked!');
    console.log('📝 [handleSend] Query:', query);
    console.log('🖼️  [handleSend] Selected images:', selectedImages.length);
    console.log('🔄 [handleSend] Is processing:', isProcessing);
    console.log('🎭 [handleSend] Active mode:', activeMode);

    if ((!query.trim() && selectedImages.length === 0) || isProcessing) {
      console.log('⚠️ [handleSend] Early return - no query/images or already processing');
      return;
    }

    if (currentView !== 'workspace') setCurrentView('workspace');

    const currentMode = activeMode;
    const currentImgs = [...selectedImages];
    const userMsgId = Date.now().toString();
    const newMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query || "Visual synthesis request...",
      mode: currentMode,
      images: [...currentImgs]
    };
    const assistantMsgId = (Date.now() + 1).toString();

    const assistantStatusText = "Understanding request and analyzing inputs...";

    setMessagesByMode(prev => ({
      ...prev,
      [currentMode]: [...prev[currentMode],
        newMessage,
      { id: assistantMsgId, role: 'assistant', content: assistantStatusText, status: 'processing', mode: currentMode }
      ]
    }));

    setInputText('');
    setSelectedImages([]);
    setIsProcessing(true);

    try {
      console.log('Starting prompt optimization...', { query, mode: currentMode, imageCount: currentImgs.length });
      const optimizedPrompt = await professionalizePrompt(query, currentMode, currentImgs);
      console.log('Prompt optimized:', optimizedPrompt.substring(0, 100) + '...');

      // Save the last prompt for 1:1 generation
      setLastPrompt(optimizedPrompt);

      setPromptMapByMode(prev => ({
        ...prev,
        [currentMode]: { ...prev[currentMode], [assistantMsgId]: optimizedPrompt }
      }));

      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `Strategy Developed.\n\nRendering 8K Resolution...`, status: 'generating' }
            : m
        )
      }));

      console.log('Starting image generation...');
      const finalImageUrl = await generateImage(optimizedPrompt, '9:16', currentImgs);
      console.log('Image generated successfully');

      setHistory(prev => [...prev, {
        id: Date.now().toString(),
        url: finalImageUrl,
        prompt: optimizedPrompt,
        timestamp: Date.now(),
        aspectRatio: '9:16'
      }]);

      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m =>
          m.id === assistantMsgId
            ? { ...m, status: 'done', content: "Generation Complete.\nviewing result below." }
            : m
        )
      }));

    } catch (error: any) {
      console.error('Error in handleSend:', error);
      if (error?.message?.includes("Requested entity was not found")) setHasKey(false);
      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `Synthesis failed: ${error?.message || 'Unknown error'}`, status: 'error' }
            : m
        )
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate1to1 = async (msgId?: string) => {
    const currentMode = activeMode;
    // Use lastPrompt if no msgId provided (new design)
    const prompt = msgId ? promptMapByMode[currentMode][msgId] : lastPrompt;
    if (!prompt || isProcessing) return;

    const original916 = history.find(h => h.aspectRatio === '9:16');

    setIsProcessing(true);
    if (msgId) {
      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m => m.id === msgId ? { ...m, status: 'generating' } : m)
      }));
    }

    try {
      const imageUrl11 = await generateImage(prompt, '1:1', original916 ? [original916.url] : []);
      setHistory(prev => [{
        id: Date.now().toString() + '-11',
        url: imageUrl11,
        prompt: prompt,
        originalIdea: "Variation 1:1",
        aspectRatio: '1:1',
        timestamp: Date.now(),
      }, ...prev]);

      if (msgId) {
        setMessagesByMode(prev => ({
          ...prev,
          [currentMode]: prev[currentMode].map(m => m.id === msgId ? { ...m, status: 'done' } : m)
        }));
      }
    } catch (error: any) {
      if (error?.message?.includes("Requested entity was not found")) setHasKey(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020202] text-white">
        <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Checking Authorization</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen w-full bg-[#020202] text-gray-200 overflow-hidden font-sans p-2 gap-2">

      {/* IMAGE PREVIEW LIGHTBOX */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewImage;
                  link.download = `easyproadds-${Date.now()}.png`;
                  link.click();
                }}
                className="p-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all shadow-lg"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR navigation */}
      <aside className="w-20 lg:w-64 flex flex-col gap-4 h-full shrink-0">
        <div className="glass-panel border border-white/5 bg-[#050505] rounded-[2rem] flex flex-col h-full shadow-xl overflow-hidden">

          {/* LOGO AREA */}
          <div className="p-6 pb-2 flex justify-center lg:justify-start">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 lg:w-auto lg:h-16 object-contain" />
          </div>

          <div className="flex-1 flex flex-col justify-end p-4 gap-2">
            <button
              onClick={() => setCurrentView('banners')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'banners' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <Zap className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Banners</span>
            </button>

            <button
              onClick={() => setCurrentView('editor')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'editor' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <Paintbrush className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Editor</span>
            </button>

            <button
              onClick={() => setCurrentView('feedback')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'feedback' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <MessageSquare className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Feedback</span>
            </button>

            <button
              onClick={() => setCurrentView('workspace')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'workspace' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <LayoutGrid className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Create</span>
            </button>

            <button
              onClick={() => setCurrentView('gallery')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'gallery' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <ImageIcon className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Gallery</span>
            </button>

            <button
              onClick={() => setCurrentView('settings')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'settings' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <Settings className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Settings</span>
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group hover:bg-red-500/10 text-gray-400 hover:text-red-400 mt-2"
            >
              <LogOut className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative bg-[#1a1a1a] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">

        {/* TOP VIEW SWITCHER (Only active in Workspace) */}
        {currentView === 'workspace' && (
          <header className="h-16 flex items-center justify-center px-6 border-b border-white/5 bg-[#020202]/50 backdrop-blur-xl z-20">
            <div className="bg-black/40 p-1 rounded-xl flex gap-1 border border-white/5">
              {[
                { id: 'generator', label: 'Generator', icon: LayoutGrid },
                { id: 'iteration', label: 'Ref Copy', icon: Repeat },
                { id: 'fashion', label: 'Fashion', icon: Layers }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setActiveMode(mode.id as ChatMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeMode === mode.id
                    ? 'bg-white text-black shadow-lg'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                >
                  <mode.icon className="w-3 h-3" />
                  <span className="hidden md:inline">{mode.label}</span>
                </button>
              ))}
            </div>
          </header>
        )}

        {/* CONTENT VIEWS */}
        <div
          className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_50%_-20%,_#1a1025_0%,_#020202_70%)]"
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDrop={handleDrop}
        >

          {/* VIEW: WORKSPACE - Two Column Layout */}
          {currentView === 'workspace' && (
            <div className="h-full flex gap-4 p-4 overflow-hidden">

              {/* LEFT COLUMN: Images + Results */}
              <div className="w-[380px] flex flex-col gap-4 shrink-0 overflow-y-auto">

                {/* Add Images Section */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Añade las imágenes</h3>
                  <div
                    className="relative border-2 border-dashed border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors h-[200px] flex flex-col items-center justify-center cursor-pointer group"
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />

                    {selectedImages.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 text-gray-600">
                        <Paperclip className="w-10 h-10" />
                        <p className="text-[10px] font-bold uppercase tracking-widest px-4 text-center">Click o arrastra imágenes aquí</p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 p-3 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2">
                          {selectedImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/20 bg-black/20 group/img">
                              <img src={img} className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSelectedImage(idx);
                                }}
                                className="absolute top-1 right-1 bg-red-500 p-1 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Results Section - CLICK EN LAS IMÁGENES AQUÍ */}
                {(history.length > 0 || isProcessing) && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Resultados - Click en las imágenes aquí</h3>

                    <div className="grid grid-cols-2 gap-3">
                      {/* 9:16 Result */}
                      <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600 text-center">9:16</div>
                        {(() => {
                          const img916 = history.find(h => h.aspectRatio === '9:16');
                          if (img916) {
                            return (
                              <div
                                className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 group cursor-pointer"
                                onClick={() => setPreviewImage(img916.url)}
                              >
                                <img src={img916.url} className="w-full h-auto" alt="9:16 result" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadImage(img916.url, img916.id);
                                  }}
                                  className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-lg hover:bg-black transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          } else if (isProcessing) {
                            return (
                              <div className="aspect-[9/16] rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                                <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
                              </div>
                            );
                          }
                          return (
                            <div className="aspect-[9/16] rounded-lg border border-dashed border-white/5 bg-white/[0.02]"></div>
                          );
                        })()}
                      </div>

                      {/* 1:1 Result */}
                      <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600 text-center">1:1</div>
                        {(() => {
                          const img11 = history.find(h => h.aspectRatio === '1:1');
                          const img916 = history.find(h => h.aspectRatio === '9:16');

                          if (img11) {
                            return (
                              <div
                                className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 group cursor-pointer"
                                onClick={() => setPreviewImage(img11.url)}
                              >
                                <img src={img11.url} className="w-full h-auto" alt="1:1 result" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadImage(img11.url, img11.id);
                                  }}
                                  className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-lg hover:bg-black transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          } else if (img916 && !isProcessing) {
                            return (
                              <div className="aspect-square rounded-lg border border-dashed border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                                <button
                                  onClick={() => handleGenerate1to1()}
                                  className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-400 transition-colors"
                                >
                                  <Plus className="w-5 h-5" />
                                  <span className="text-[8px] font-bold uppercase tracking-widest">Generar</span>
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div className="aspect-square rounded-lg border border-dashed border-white/5 bg-white/[0.02]"></div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN: Prompt + Gallery */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">

                {/* Prompt Input Section */}
                <div className="space-y-3 shrink-0">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Introduce el Prompt</h3>
                  <div className="relative border border-white/10 rounded-xl bg-[#0a0a0a]/50 h-[200px] flex flex-col">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Aquí el usuario mete su prompt..."
                      className="flex-1 bg-transparent p-4 focus:outline-none text-sm font-medium placeholder:text-gray-700 resize-none"
                    />
                    <div className="p-3 border-t border-white/5 flex justify-end">
                      <button
                        onClick={() => handleSend()}
                        disabled={isProcessing || (!inputText.trim() && selectedImages.length === 0)}
                        className={`px-6 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${isProcessing ? 'bg-gray-800 text-gray-600' : 'bg-white text-black hover:bg-gray-200'
                          }`}
                      >
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Generando...</span>
                          </div>
                        ) : (
                          'Generar'
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gallery Section */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3 shrink-0">Galería de resultados</h3>
                  <div className="flex-1 border border-white/10 rounded-xl bg-white/[0.02] overflow-y-auto">
                    {history.length > 0 ? (
                      <div className="p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {history.map((img) => (
                          <div
                            key={img.id}
                            className="group relative aspect-square bg-white/5 rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                            onClick={() => setPreviewImage(img.url)}
                          >
                            <img src={img.url} className="w-full h-full object-cover" alt="Generated" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(img.url, img.id);
                                }}
                                className="p-2.5 bg-white text-black rounded-lg hover:scale-110 transition-transform"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[8px] text-gray-300 line-clamp-2">{img.aspectRatio}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-700">
                        <ImageIcon className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No hay resultados aún</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW: GALLERY */}
          {currentView === 'gallery' && (
            <div className="h-full overflow-y-auto p-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Your Creations</h2>
                <div className="text-sm text-gray-500 font-bold">{history.length} assets</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-[9/16] bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                    onClick={() => setPreviewImage(img.url)}
                  >
                    <img src={img.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 p-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(img.url, img.id);
                        }}
                        className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <p className="text-[10px] text-gray-300 line-clamp-3">{img.prompt}</p>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="col-span-full py-24 text-center text-gray-600">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-widest">No images generated yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {currentView === 'settings' && (() => {
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
                      <Settings className="w-5 h-5" />
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
          })()}
          {/* VIEW: BANNERS */}
          {currentView === 'banners' && (
            <div className="h-full flex gap-4 p-4 overflow-hidden">
              {/* Hidden file input */}
              <input type="file" ref={bannerFileInputRef} onChange={handleBannerFileChange} className="hidden" accept="image/*" multiple />

              {/* LEFT COLUMN: Input and Images */}
              <div className="w-[380px] flex flex-col gap-4 shrink-0 overflow-y-auto">
                {/* Add Images Section */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Imágenes de referencia (opcional)</h3>
                  <div
                    className="relative border-2 border-dashed border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors h-[120px] flex flex-col items-center justify-center cursor-pointer group"
                    onClick={() => bannerFileInputRef.current?.click()}
                  >
                    {bannerSelectedImages.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Paperclip className="w-6 h-6" />
                        <p className="text-[9px] font-bold uppercase tracking-widest px-4 text-center">Click para añadir producto</p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 p-2 overflow-y-auto">
                        <div className="grid grid-cols-3 gap-2">
                          {bannerSelectedImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/20 bg-black/20 group/img">
                              <img src={img} className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBannerSelectedImages(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="absolute top-1 right-1 bg-red-500 p-1 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                              >
                                <X className="w-2 h-2" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Results Section */}
                <div className="space-y-3 flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Resultados</h3>

                  <div className="space-y-4">
                    {/* 16:9 Result */}
                    <div className="space-y-2">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">16:9 (Desktop)</div>
                      {(() => {
                        const img169 = bannerHistory.find(h => h.aspectRatio === '16:9');
                        if (img169) {
                          return (
                            <div
                              className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 group cursor-pointer"
                              onClick={() => setPreviewImage(img169.url)}
                            >
                              <img src={img169.url} className="w-full h-auto" alt="16:9 result" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(img169.url, img169.id);
                                }}
                                className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-lg hover:bg-black transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        } else if (bannerIsProcessing) {
                          return (
                            <div className="aspect-video rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                              <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
                            </div>
                          );
                        }
                        return (
                          <div className="aspect-video rounded-lg border border-dashed border-white/5 bg-white/[0.02] flex items-center justify-center text-gray-600 text-[9px]">
                            No hay resultado aún
                          </div>
                        );
                      })()}
                    </div>

                    {/* 9:16 Result */}
                    <div className="space-y-2">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">9:16 (Mobile)</div>
                      {(() => {
                        const img916 = bannerHistory.find(h => h.aspectRatio === '9:16');
                        const img169 = bannerHistory.find(h => h.aspectRatio === '16:9');

                        if (img916) {
                          return (
                            <div
                              className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5 group cursor-pointer w-[140px]"
                              onClick={() => setPreviewImage(img916.url)}
                            >
                              <img src={img916.url} className="w-full h-auto" alt="9:16 result" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(img916.url, img916.id);
                                }}
                                className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-lg hover:bg-black transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        } else if (img169 && !bannerIsProcessing) {
                          return (
                            <div className="w-[140px] aspect-[9/16] rounded-lg border border-dashed border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                              <button
                                onClick={() => handleBannerGenerate916()}
                                className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-400 transition-colors"
                              >
                                <Plus className="w-5 h-5" />
                                <span className="text-[8px] font-bold uppercase">Generar 9:16</span>
                              </button>
                            </div>
                          );
                        } else if (bannerIsProcessing && !img916) {
                          return (
                            <div className="w-[140px] aspect-[9/16] rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                              <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                            </div>
                          );
                        }
                        return (
                          <div className="w-[140px] aspect-[9/16] rounded-lg border border-dashed border-white/5 bg-white/[0.02]"></div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Chat */}
              <div className="flex-1 flex flex-col min-w-0 bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                  <div className="text-center space-y-4 max-w-md">
                    <Zap className="w-12 h-12 mx-auto text-gray-700" />
                    <h2 className="text-lg font-black uppercase tracking-wider text-gray-400">Banner Generator</h2>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Describe el banner que necesitas para tu e-commerce. Primero se generará en formato 16:9 (desktop) y luego podrás crear la versión 9:16 (móvil).
                    </p>
                  </div>
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/5 bg-black/30">
                  <div className="relative">
                    <textarea
                      value={bannerInputText}
                      onChange={(e) => setBannerInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleBannerSend();
                        }
                      }}
                      placeholder="Ej: Banner para venta de verano de zapatillas deportivas con tonos naranjas..."
                      className="w-full bg-white/5 rounded-xl px-4 py-3 pr-14 text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                      rows={3}
                    />
                    <button
                      onClick={handleBannerSend}
                      disabled={!bannerInputText.trim() || bannerIsProcessing}
                      className="absolute bottom-3 right-3 p-2 bg-white text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-all"
                    >
                      {bannerIsProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: FEEDBACK */}
          {currentView === 'feedback' && (
            <Feedback />
          )}

          {/* VIEW: EDITOR */}
          {currentView === 'editor' && (
            <div className="h-full flex flex-col p-6 overflow-hidden">
              {/* Hidden file inputs for Editor */}
              <input type="file" ref={editorInput916Ref} onChange={handleEditor916Change} className="hidden" accept="image/*" />
              <input type="file" ref={editorInput11Ref} onChange={handleEditor11Change} className="hidden" accept="image/*" />
              {/* Hidden file inputs for Format */}
              <input type="file" ref={formatInput916Ref} onChange={handleFormatInput916Change} className="hidden" accept="image/*" />
              <input type="file" ref={formatInput11Ref} onChange={handleFormatInput11Change} className="hidden" accept="image/*" />

              {/* Brush Modal - Canvas Painting Editor */}
              {showBrushModal && (editorImage916 || editorImage11) && (
                <div
                  className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
                  onClick={(e) => e.target === e.currentTarget && setShowBrushModal(false)}
                >
                  {/* Toolbar */}
                  <div className="flex items-center gap-4 mb-4 p-3 bg-white/10 rounded-xl border border-white/20">
                    {/* Image selector tabs */}
                    {editorImage916 && editorImage11 && (
                      <div className="flex gap-2 mr-4 pr-4 border-r border-white/20">
                        <button
                          onClick={() => {
                            // Auto-save current mask before switching
                            const canvas = canvasRef.current;
                            if (canvas && activeEditImage === '11') {
                              setMask11Data(canvas.toDataURL('image/png'));
                            }
                            setActiveEditImage('916');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeEditImage === '916' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                          9:16
                        </button>
                        <button
                          onClick={() => {
                            // Auto-save current mask before switching
                            const canvas = canvasRef.current;
                            if (canvas && activeEditImage === '916') {
                              setMask916Data(canvas.toDataURL('image/png'));
                            }
                            setActiveEditImage('11');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeEditImage === '11' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                          1:1
                        </button>
                      </div>
                    )}

                    {/* Brush size control */}
                    <div className="flex items-center gap-2">
                      <Paintbrush className="w-4 h-4 text-gray-400" />
                      <button
                        onClick={() => setBrushSize(prev => Math.max(5, prev - 10))}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-8 text-center">{brushSize}</span>
                      <button
                        onClick={() => setBrushSize(prev => Math.min(100, prev + 10))}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Clear mask button */}
                    <button
                      onClick={() => {
                        const canvas = canvasRef.current;
                        if (canvas) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs font-bold uppercase"
                    >
                      <Eraser className="w-4 h-4" />
                      Limpiar
                    </button>

                    {/* Save and close */}
                    <button
                      onClick={() => {
                        const canvas = canvasRef.current;
                        if (canvas) {
                          const maskData = canvas.toDataURL('image/png');
                          if (activeEditImage === '916') {
                            setMask916Data(maskData);
                          } else {
                            setMask11Data(maskData);
                          }
                        }
                        setShowBrushModal(false);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-bold uppercase hover:bg-gray-200 transition-colors"
                    >
                      Guardar
                    </button>

                    {/* Close */}
                    <button
                      onClick={() => setShowBrushModal(false)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Canvas container */}
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/10">
                    <img
                      ref={imageRef}
                      src={activeEditImage === '916' ? editorImage916! : editorImage11!}
                      alt="Edit"
                      className="max-h-[75vh] object-contain"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const canvas = canvasRef.current;
                        if (canvas) {
                          canvas.width = img.clientWidth;
                          canvas.height = img.clientHeight;
                          // Restore existing mask if any
                          const existingMask = activeEditImage === '916' ? mask916Data : mask11Data;
                          if (existingMask) {
                            const ctx = canvas.getContext('2d');
                            const maskImg = new Image();
                            maskImg.onload = () => {
                              ctx?.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                            };
                            maskImg.src = existingMask;
                          }
                        }
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 cursor-crosshair"
                      style={{ mixBlendMode: 'normal' }}
                      onMouseDown={(e) => {
                        setIsDrawing(true);
                        const canvas = canvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.beginPath();
                            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(255, 0, 100, 0.5)';
                            ctx.fill();
                          }
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawing) return;
                        const canvas = canvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.beginPath();
                            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(255, 0, 100, 0.5)';
                            ctx.fill();
                          }
                        }
                      }}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                    />
                  </div>

                  {/* Instructions */}
                  <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest">
                    Pinta las zonas que quieres que la IA modifique
                  </p>
                </div>
              )}

              {/* Main Layout: Two Sections Side by Side */}
              <div className="flex-1 flex gap-8 overflow-hidden">

                {/* LEFT SECTION: FORMATOS */}
                <div className="flex flex-col border-r border-white/10 pr-8">
                  <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-center">Formatos</h2>

                  {/* 9:16 → 1:1 Row */}
                  <div className="flex items-center gap-3 mb-4">
                    {/* Input 9:16 */}
                    <div className="flex flex-col gap-1">
                      <div
                        className="w-[100px] h-[178px] border-2 border-dashed border-white/20 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
                        onClick={() => formatInput916Ref.current?.click()}
                      >
                        {formatInput916 ? (
                          <img src={formatInput916} alt="9:16" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Paperclip className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-1">9:16</p>
                          </>
                        )}
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500 text-center">añade 9:16</p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-5 h-5 text-gray-600" />

                    {/* Output 1:1 */}
                    <div
                      className={`w-[100px] h-[100px] border rounded-lg overflow-hidden cursor-pointer ${formatResult11 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                        }`}
                      onClick={() => formatResult11 && setPreviewImage(formatResult11)}
                    >
                      {formatResult11 ? (
                        <img src={formatResult11} alt="Result 1:1" className="w-full h-full object-cover" />
                      ) : isFormatProcessing && formatInput916 ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* 1:1 → 9:16 Row */}
                  <div className="flex items-center gap-3 mb-4">
                    {/* Input 1:1 */}
                    <div className="flex flex-col gap-1">
                      <div
                        className="w-[100px] h-[100px] border-2 border-dashed border-white/20 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
                        onClick={() => formatInput11Ref.current?.click()}
                      >
                        {formatInput11 ? (
                          <img src={formatInput11} alt="1:1" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Paperclip className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-1">1:1</p>
                          </>
                        )}
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500 text-center">añade 1:1</p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-5 h-5 text-gray-600" />

                    {/* Output 9:16 */}
                    <div
                      className={`w-[100px] h-[178px] border rounded-lg overflow-hidden cursor-pointer ${formatResult916 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                        }`}
                      onClick={() => formatResult916 && setPreviewImage(formatResult916)}
                    >
                      {formatResult916 ? (
                        <img src={formatResult916} alt="Result 9:16" className="w-full h-full object-cover" />
                      ) : isFormatProcessing && formatInput11 ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Status */}
                  {formatStatus && (
                    <p className={`text-[10px] font-medium mb-2 ${formatStatus.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                      {formatStatus}
                    </p>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={handleFormatGenerate}
                    disabled={isFormatProcessing || (!formatInput916 && !formatInput11)}
                    className={`w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isFormatProcessing || (!formatInput916 && !formatInput11)
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-gray-200'
                      }`}
                  >
                    {isFormatProcessing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Convertir'
                    )}
                  </button>
                </div>

                {/* RIGHT SECTION: EDITOR */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-center">Editor</h2>

                  {/* Editor Content */}
                  <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* Image Upload Zones */}
                    <div className="flex gap-4">
                      {/* 9:16 Zone */}
                      <div className="flex flex-col gap-2">
                        <div
                          className="w-[180px] h-[320px] border-2 border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
                          onClick={() => editorInput916Ref.current?.click()}
                        >
                          {editorImage916 ? (
                            <img src={editorImage916} alt="9:16" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Paperclip className="w-8 h-8 text-gray-600 group-hover:text-gray-400 transition-colors" />
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mt-2">Click para añadir</p>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">añade 9:16</p>
                      </div>

                      {/* 1:1 Zone */}
                      <div className="flex flex-col gap-2">
                        <div
                          className="w-[180px] h-[180px] border-2 border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
                          onClick={() => editorInput11Ref.current?.click()}
                        >
                          {editorImage11 ? (
                            <img src={editorImage11} alt="1:1" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Paperclip className="w-8 h-8 text-gray-600 group-hover:text-gray-400 transition-colors" />
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mt-2">Click para añadir</p>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">añade 1:1</p>
                      </div>
                    </div>

                    {/* Right Section: Prompt + Brush Button */}
                    <div className="flex-1 flex flex-col gap-4 max-w-md">
                      {/* Prompt Area */}
                      <div className="border border-white/10 rounded-xl bg-[#0a0a0a]/50 p-4 flex-1 flex flex-col">
                        <textarea
                          value={editorPrompt}
                          onChange={(e) => setEditorPrompt(e.target.value)}
                          placeholder="añade el prompt para cambiar (ej: 'cambia el fondo a una playa')"
                          className="flex-1 bg-transparent focus:outline-none text-sm font-medium placeholder:text-gray-600 resize-none"
                        />
                      </div>

                      {/* Status */}
                      {editorStatus && (
                        <p className={`text-xs font-medium ${editorStatus.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                          {editorStatus}
                        </p>
                      )}

                      {/* Brush Button */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => (editorImage916 || editorImage11) && setShowBrushModal(true)}
                          className={`p-3 border border-white/20 rounded-xl transition-colors group ${(editorImage916 || editorImage11)
                            ? 'bg-white/5 hover:bg-white/10 cursor-pointer'
                            : 'bg-white/[0.02] cursor-not-allowed opacity-50'
                            }`}
                          title={editorImage916 || editorImage11 ? "Pintar zonas a editar" : "Sube imágenes primero"}
                        >
                          <Paintbrush className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                        </button>
                        {(mask916Data || mask11Data) && (
                          <span className="text-[10px] text-green-400 font-bold uppercase">Máscara guardada</span>
                        )}
                      </div>

                      {/* Generate Button */}
                      <button
                        onClick={handleEditorGenerate}
                        disabled={isEditorProcessing || (!editorImage916 && !editorImage11) || !editorPrompt.trim()}
                        className={`w-full py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isEditorProcessing || (!editorImage916 && !editorImage11) || !editorPrompt.trim()
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : 'bg-white text-black hover:bg-gray-200'
                          }`}
                      >
                        {isEditorProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          'Generar'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Results Section */}
                  <div className="mt-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Resultado:</h3>
                    <div className="flex gap-4">
                      {/* Result 9:16 */}
                      <div
                        className={`w-[140px] h-[250px] border rounded-xl overflow-hidden cursor-pointer ${editorResult916 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                          }`}
                        onClick={() => editorResult916 && setPreviewImage(editorResult916)}
                      >
                        {editorResult916 ? (
                          <img src={editorResult916} alt="Result 9:16" className="w-full h-full object-cover" />
                        ) : isEditorProcessing && editorImage916 ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-gray-600" />
                          </div>
                        ) : null}
                      </div>
                      {/* Result 1:1 */}
                      <div
                        className={`w-[120px] h-[120px] border rounded-xl overflow-hidden cursor-pointer ${editorResult11 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                          }`}
                        onClick={() => editorResult11 && setPreviewImage(editorResult11)}
                      >
                        {editorResult11 ? (
                          <img src={editorResult11} alt="Result 1:1" className="w-full h-full object-cover" />
                        ) : isEditorProcessing && editorImage11 ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-gray-600" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;