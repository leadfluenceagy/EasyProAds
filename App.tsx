import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GeneratedImage, AspectRatio, ChatMode } from './types';
import { professionalizePrompt, generateImage } from './services/geminiService';
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
  Settings
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

type View = 'workspace' | 'gallery' | 'settings';

const App: React.FC = () => {
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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMessages = messagesByMode[activeMode];

  // Fix: Ensure API key check handles potential unknown return value correctly to resolve line 94 error
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

  const handleOpenKeySelection = async () => {
    try {
      await window.aistudio?.openSelectKey();
      setHasKey(true);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentView === 'workspace') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages, activeMode, currentView]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [...prev, reader.result as string]);
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
    if ((!query.trim() && selectedImages.length === 0) || isProcessing) return;

    // Force view to workspace if sending a message
    if (currentView !== 'workspace') setCurrentView('workspace');

    const currentMode = activeMode;
    const currentImgs = [...selectedImages]; // Capture images FIRST
    const userMsgId = Date.now().toString();
    const newMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query || "Visual synthesis request...",
      mode: currentMode,
      images: [...currentImgs]
    };
    const assistantMsgId = (Date.now() + 1).toString();

    const assistantStatusText =
      currentMode === 'generator' ? 'Synthesizing product environment...' :
        currentMode === 'iteration' ? 'Replicating composition and lighting...' :
          'Analyzing facial identity and fashion context...';

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
      const optimizedPrompt = await professionalizePrompt(query, currentMode, currentImgs);

      setPromptMapByMode(prev => ({
        ...prev,
        [currentMode]: { ...prev[currentMode], [assistantMsgId]: optimizedPrompt }
      }));

      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `Prompt Optimized.\n\nExecuting 4K rendering...`, status: 'generating' }
            : m
        )
      }));

      const imageUrl916 = await generateImage(optimizedPrompt, '9:16', currentImgs);

      setHistory(prev => [{
        id: Date.now().toString(),
        url: imageUrl916,
        prompt: optimizedPrompt,
        originalIdea: query,
        aspectRatio: '9:16',
        timestamp: Date.now(),
      }, ...prev]);

      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m => m.id === assistantMsgId ? { ...m, content: optimizedPrompt, status: 'done' } : m)
      }));

    } catch (error: any) {
      if (error?.message?.includes("Requested entity was not found")) setHasKey(false);
      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Synthesis failed. Please ensure the references are photographic.', status: 'error' }
            : m
        )
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate1to1 = async (msgId: string) => {
    const currentMode = activeMode;
    const prompt = promptMapByMode[currentMode][msgId];
    if (!prompt || isProcessing) return;

    const original916 = history.find(h => h.prompt === prompt && h.aspectRatio === '9:16');

    setIsProcessing(true);
    setMessagesByMode(prev => ({
      ...prev,
      [currentMode]: prev[currentMode].map(m => m.id === msgId ? { ...m, status: 'generating' } : m)
    }));

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

      setMessagesByMode(prev => ({
        ...prev,
        [currentMode]: prev[currentMode].map(m => m.id === msgId ? { ...m, status: 'done' } : m)
      }));
    } catch (error: any) {
      if (error?.message?.includes("Requested entity was not found")) setHasKey(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#020202] text-gray-200 overflow-hidden font-sans p-2 gap-2">

      {/* LEFT SIDEBAR navigation */}
      <aside className="w-20 lg:w-64 flex flex-col gap-4 h-full shrink-0">
        <div className="glass-panel border border-white/5 bg-[#050505] rounded-[2rem] flex flex-col h-full shadow-xl overflow-hidden">

          {/* LOGO AREA */}
          <div className="p-6 pb-2 flex justify-center lg:justify-start">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 lg:w-auto lg:h-16 object-contain" />
          </div>

          <div className="flex-1 flex flex-col justify-end p-4 gap-2">
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

          {/* VIEW: WORKSPACE */}
          {currentView === 'workspace' && (
            <>
              <div
                className="absolute inset-0 overflow-y-auto p-4 md:p-8 pt-6 chat-container pb-32"
              >
                <div className="max-w-4xl mx-auto space-y-12">
                  {activeMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-8 opacity-50">
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-3xl">
                        {activeMode === 'fashion' ? <Layers className="w-8 h-8 text-white/40" /> : activeMode === 'iteration' ? <Repeat className="w-8 h-8 text-white/40" /> : <LayoutGrid className="w-8 h-8 text-white/40" />}
                      </div>
                      <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                        {activeMode === 'generator' ? 'Product Scene' : activeMode === 'iteration' ? 'Reference Copy' : 'Fashion Edit'}
                      </h2>
                      <p className="text-gray-500 max-w-lg mx-auto text-sm font-medium tracking-tight leading-relaxed">
                        {activeMode === 'generator' ? 'Añade un producto preferiblemente en png y dale una breve descripción de cómo quieres adaptarlo a qué fondo.' :
                          activeMode === 'iteration' ? 'Añade un anuncio de referencia y añade el producto que quieras meter en ese anuncio. De esta forma tendrás el mismo anuncio pero con tu producto deseado. IMPORTANTE: Todo el texto se elimina.' :
                            'Primero pasa una foto de la cara de la modelo, luego pasa la foto de moda que quieras iterar.\nEJ: Meto la cara de la de Milan y meto una foto de ella llevando el vestido, le digo que cambie la pose y que el fondo sea en una casa con una piscina infinita.'}
                      </p>
                    </div>
                  )}

                  {activeMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-2`}>

                      {/* USER SENT IMAGES (Outside Bubble) */}
                      {msg.role === 'user' && msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end max-w-[80%] mb-1">
                          {msg.images.map((img, idx) => (
                            <div key={idx} className="relative w-24 h-24 shrink-0 overflow-hidden rounded-xl border-2 border-white/10 shadow-lg">
                              <img src={img} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={`group relative max-w-[90%] md:max-w-[80%] p-5 rounded-2xl shadow-xl ${msg.role === 'user'
                        ? 'bg-white text-black font-medium'
                        : 'glass-panel text-gray-100 border border-white/5 backdrop-blur-3xl'
                        }`}>

                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-4 opacity-50">
                            <ShieldCheck className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Synthesis</span>
                          </div>
                        )}

                        <p className={`whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'text-lg' : 'text-sm font-mono text-gray-300'}`}>
                          {msg.content}
                        </p>

                        {msg.status === 'done' && (
                          <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 9:16 Result */}
                            {(() => {
                              const currentPromptMap = promptMapByMode[activeMode];
                              const img916 = history.find(h => h.prompt === currentPromptMap[msg.id] && h.aspectRatio === '9:16');
                              return img916 && (
                                <div className="space-y-3">
                                  <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">9:16 Format</span>
                                  <div className="overflow-hidden rounded-xl border border-white/10 relative group-img">
                                    <img src={img916.url} className="w-full h-auto" />
                                    <button onClick={() => downloadImage(img916.url, img916.id)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors">
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 1:1 Result */}
                            <div className="space-y-3">
                              {(() => {
                                const currentPromptMap = promptMapByMode[activeMode];
                                const img11 = history.find(h => h.prompt === currentPromptMap[msg.id] && h.aspectRatio === '1:1');
                                if (img11) {
                                  return (
                                    <>
                                      <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">1:1 Format</span>
                                      <div className="overflow-hidden rounded-xl border border-white/10 relative group-img">
                                        <img src={img11.url} className="w-full h-auto" />
                                        <button onClick={() => downloadImage(img11.url, img11.id)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors">
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </>
                                  );
                                } else {
                                  return (
                                    <div className="h-full flex items-center justify-center p-6 border border-dashed border-white/10 rounded-xl bg-white/5">
                                      <button onClick={() => handleGenerate1to1(msg.id)} disabled={isProcessing} className="flex flex-col items-center gap-2 text-gray-500 hover:text-white transition-colors">
                                        {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Create Square</span>
                                      </button>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* INPUT DOCK */}
              <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-4 px-6 z-30 pointer-events-none">
                {selectedImages.length > 0 && (
                  <div className="flex gap-3 pointer-events-auto bg-black/80 p-2 rounded-2xl border border-white/10 backdrop-blur-xl animate-in slide-in-from-bottom-2">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 shrink-0">
                        <img src={img} className="w-full h-full object-cover rounded-lg border border-white/20" />
                        <button onClick={() => removeSelectedImage(idx)} className="absolute -top-2 -right-2 bg-red-500 p-1 rounded-full text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="w-full max-w-3xl pointer-events-auto">
                  <div className="relative flex items-center bg-[#151515] border border-white/10 rounded-[2rem] p-2 shadow-2xl">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                    <button onClick={() => fileInputRef.current?.click()} className="p-4 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-full">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Describe your idea..."
                      className="flex-1 bg-transparent px-4 focus:outline-none text-base font-medium placeholder:text-gray-700 h-full"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={isProcessing || (!inputText.trim() && selectedImages.length === 0)}
                      className={`p-4 rounded-full transition-all ${isProcessing ? 'text-gray-600' : 'bg-white text-black hover:scale-105'
                        }`}
                    >
                      {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
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
                  <div key={img.id} className="group relative aspect-[9/16] bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all">
                    <img src={img.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 p-4 text-center">
                      <button onClick={() => downloadImage(img.url, img.id)} className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
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
          {currentView === 'settings' && (
            <div className="h-full flex flex-col items-center justify-center text-white/20">
              <Settings className="w-24 h-24 mb-6 stroke-1" />
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white/40">Settings</h2>
              <p className="text-sm font-bold tracking-widest mt-2 uppercase">Coming Soon</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;