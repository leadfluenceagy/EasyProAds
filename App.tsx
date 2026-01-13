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
  Layers
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

const App: React.FC = () => {
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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, activeMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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

    const currentMode = activeMode;
    const userMsgId = Date.now().toString();
    const assistantMsgId = (Date.now() + 1).toString();

    const assistantStatusText = 
      currentMode === 'generator' ? 'Synthesizing product environment...' :
      currentMode === 'iteration' ? 'Replicating composition and lighting...' :
      'Analyzing facial identity and fashion context...';

    setMessagesByMode(prev => ({
      ...prev,
      [currentMode]: [...prev[currentMode], 
        { id: userMsgId, role: 'user', content: query || "Visual synthesis request...", mode: currentMode },
        { id: assistantMsgId, role: 'assistant', content: assistantStatusText, status: 'processing', mode: currentMode }
      ]
    }));
    
    const currentImgs = [...selectedImages];
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
    <div className="flex h-screen w-full bg-[#020202] text-gray-200 overflow-hidden font-sans p-4 gap-4">
      
      {/* SIDEBAR */}
      <aside className="w-80 flex flex-col gap-4 hidden lg:flex h-full">
        <nav className="glass-panel border border-white/5 bg-[#050505] rounded-[2.5rem] p-6 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl flex items-center justify-center border border-white/10 shadow-lg">
              <Zap className="text-white w-6 h-6 fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter text-white uppercase italic">Studio Pro</h1>
              <span className="text-[8px] text-purple-500 font-black tracking-[0.1em] uppercase">V3 Pipeline</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest px-2 mb-2">Functions</p>
            
            <button 
              onClick={() => setActiveMode('generator')}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight text-left ${
                activeMode === 'generator' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <LayoutGrid className="w-5 h-5 shrink-0" />
              Ad Generator from Product
            </button>

            <button 
              onClick={() => setActiveMode('iteration')}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight text-left ${
                activeMode === 'iteration' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <Repeat className="w-5 h-5 shrink-0" />
              Ad Reference Copy
            </button>

            <button 
              onClick={() => setActiveMode('fashion')}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight text-left ${
                activeMode === 'fashion' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <Layers className="w-5 h-5 shrink-0" />
              Image Fashion Iteration
            </button>
          </div>
        </nav>

        <div className="flex-1 glass-panel border border-white/5 bg-[#050505] rounded-[2.5rem] p-6 flex flex-col overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Master Gallery</span>
            {history.length > 0 && (
              <button onClick={() => setHistory([])} className="text-gray-600 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 overflow-y-auto chat-container pr-1">
            {history.map((img) => (
              <div key={img.id} className="group relative overflow-hidden border border-white/5 aspect-square bg-white/5 rounded-none cursor-pointer">
                <img src={img.url} className="w-full h-full object-cover transition-all group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <button onClick={() => downloadImage(img.url, img.id)} className="p-2 bg-white/10 rounded-xl text-white backdrop-blur-md">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 flex flex-col relative bg-[#020202] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="absolute top-0 inset-x-0 h-20 flex items-center px-10 border-b border-white/5 bg-[#020202]/50 backdrop-blur-xl z-20 justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
              {activeMode === 'generator' ? <LayoutGrid className="w-5 h-5" /> : activeMode === 'iteration' ? <Repeat className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.3em]">Workspace Active</p>
              <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                {activeMode === 'generator' ? 'Ad Generator from Product' : activeMode === 'iteration' ? 'Ad Reference Copy' : 'Image Fashion Iteration'}
              </h3>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-28 chat-container bg-[radial-gradient(circle_at_50%_-20%,_#1a1025_0%,_#020202_70%)]">
          <div className="max-w-4xl mx-auto space-y-16 pb-48">
            
            {activeMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-12">
                <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-3xl">
                  {activeMode === 'fashion' ? <Layers className="w-10 h-10 text-white/20" /> : <ImageIcon className="w-10 h-10 text-white/20" />}
                </div>
                <div className="space-y-4">
                  <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
                    {activeMode === 'fashion' ? 'Fashion' : activeMode === 'iteration' ? 'Reference Copy' : 'Generator'} <br /><span className="text-purple-500">Workspace</span>
                  </h2>
                  <p className="text-gray-500 max-w-sm mx-auto text-lg font-medium tracking-tight">
                    {activeMode === 'generator' ? 'Place your product in a professional scene.' : 
                     activeMode === 'iteration' ? 'Match a reference ad style perfectly.' : 
                     'Iterate fashion models preserving identity and realism.'}
                  </p>
                </div>
              </div>
            )}

            {activeMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`group relative max-w-[95%] md:max-w-[85%] p-8 rounded-[2.5rem] ${
                  msg.role === 'user' ? 'bg-white text-black font-black italic' : 'glass-panel text-gray-100 border-white/10 shadow-2xl backdrop-blur-2xl'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-3 mb-6">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">AI Synthesis Pipeline</span>
                    </div>
                  )}
                  <p className={`whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'text-2xl' : 'text-sm font-medium text-gray-400 font-mono tracking-tight'}`}>
                    {msg.content}
                  </p>
                  
                  {msg.status === 'done' && (
                    <div className="mt-10 pt-10 border-t border-white/5 space-y-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {(() => {
                          const currentPromptMap = promptMapByMode[activeMode];
                          const img916 = history.find(h => h.prompt === currentPromptMap[msg.id] && h.aspectRatio === '9:16');
                          return img916 && (
                            <div className="space-y-4">
                              <span className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] flex items-center gap-2">9:16 Vertical Master</span>
                              <div className="overflow-hidden border border-white/5 shadow-2xl rounded-none">
                                <img src={img916.url} className="w-full h-auto" />
                              </div>
                              <button onClick={() => downloadImage(img916.url, img916.id)} className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase border border-white/5 rounded-[1.5rem]">
                                <Download className="w-4 h-4" /> Download 9:16
                              </button>
                            </div>
                          );
                        })()}

                        <div className="space-y-4">
                          {(() => {
                            const currentPromptMap = promptMapByMode[activeMode];
                            const img11 = history.find(h => h.prompt === currentPromptMap[msg.id] && h.aspectRatio === '1:1');
                            return img11 ? (
                              <>
                                <span className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] flex items-center gap-2">1:1 Square Adapter</span>
                                <div className="overflow-hidden border border-white/5 shadow-2xl rounded-none">
                                  <img src={img11.url} className="w-full h-auto" />
                                </div>
                                <button onClick={() => downloadImage(img11.url, img11.id)} className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase border border-white/5 rounded-[1.5rem]">
                                  <Download className="w-4 h-4" /> Download 1:1
                                </button>
                              </>
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/5 bg-white/5 space-y-8 rounded-[2.5rem]">
                                <div className="text-center">
                                  <h4 className="text-xl font-black text-white uppercase italic">Add Square?</h4>
                                </div>
                                <button onClick={() => handleGenerate1to1(msg.id)} disabled={isProcessing} className="flex items-center gap-4 px-10 py-5 bg-purple-600 hover:bg-purple-500 text-white transition-all font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.5rem] shadow-xl">
                                  {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Generate 1:1
                                </button>
                              </div>
                            );
                          })()}
                        </div>
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
        <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-4 pointer-events-none px-6 z-30">
          {selectedImages.length > 0 && (
            <div className="flex gap-4 pointer-events-auto bg-white/10 p-3 rounded-[2rem] border border-white/20 backdrop-blur-3xl animate-in slide-in-from-bottom-4 shadow-2xl overflow-x-auto no-scrollbar">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative shrink-0">
                  <img src={img} className="h-20 w-20 object-cover rounded-xl border border-white/10" />
                  <button onClick={() => removeSelectedImage(idx)} className="absolute -top-2 -right-2 bg-red-500 p-1.5 rounded-full shadow-lg border-2 border-[#020202]">
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                  <span className="absolute -bottom-2 -left-2 bg-purple-600 text-[8px] font-black px-1.5 rounded-full border border-white/20 uppercase">
                    {activeMode === 'fashion' ? (idx === 0 ? 'Face' : 'Ref') : (idx === 0 ? 'Ref' : 'Obj')}
                  </span>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} className="h-20 w-20 flex items-center justify-center bg-white/5 border-2 border-dashed border-white/10 rounded-xl text-white/20">
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}
          
          <div className="max-w-4xl w-full pointer-events-auto">
            <div className="relative flex items-center bg-[#0a0a0a]/90 border border-white/10 rounded-[2.5rem] p-3 shadow-2xl backdrop-blur-3xl group">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
              <button onClick={() => fileInputRef.current?.click()} className="p-5 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                <Paperclip className="w-7 h-7" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={activeMode === 'fashion' ? "Face reference + iteration instructions..." : "Reference images + synthesis instructions..."}
                className="flex-1 bg-transparent py-5 px-4 focus:outline-none text-xl font-medium tracking-tight placeholder:text-gray-700"
              />
              <button
                onClick={() => handleSend()}
                disabled={isProcessing || (!inputText.trim() && selectedImages.length === 0)}
                className={`p-6 rounded-[2rem] transition-all duration-500 ${
                  isProcessing || (!inputText.trim() && selectedImages.length === 0) ? 'text-gray-800' : 'bg-white text-black hover:bg-purple-500 hover:text-white shadow-xl scale-105 active:scale-95'
                }`}
              >
                {isProcessing ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Send className="w-7 h-7" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;