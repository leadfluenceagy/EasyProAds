import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GeneratedImage, AspectRatio, ChatMode } from './types';
import { professionalizePrompt, generateImage } from './services/geminiService';
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
  User
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

type View = 'workspace' | 'gallery' | 'settings' | 'feedback';

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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const link = document.createElement('a');
    link.href = url;
    link.download = `studio-pro-${id}.png`;
    link.click();
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

          {/* VIEW: FEEDBACK */}
          {currentView === 'feedback' && (
            <Feedback />
          )}

        </div>
      </main>
    </div>
  );
};

export default App;