import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GeneratedImage, AspectRatio, ChatMode } from './types';
import { professionalizePrompt, generateImage, optimizeEditorPrompt, generateEditorImage, optimizeFormatPrompt, generateFormatImage, optimizeRefCopyPrompt, generateRefCopyImage } from './services/geminiService';
import { fetchTemplates, uploadTemplate, deleteTemplate, RefCopyTemplate } from './services/templateService';
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
  ArrowRight,
  Undo2,
  Redo2,
  ChevronDown,
  Pencil
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

type View = 'workspace' | 'gallery' | 'settings' | 'feedback' | 'banners' | 'refcopy' | 'editor';

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

  // Editor history for undo/redo (tracks RESULTS, not inputs)
  const [editorResultHistory916, setEditorResultHistory916] = useState<string[]>([]);
  const [editorResultHistory11, setEditorResultHistory11] = useState<string[]>([]);
  const [editorResultIndex916, setEditorResultIndex916] = useState(-1);
  const [editorResultIndex11, setEditorResultIndex11] = useState(-1);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editingFormat, setEditingFormat] = useState<'916' | '11'>('916');
  const [editPrompt, setEditPrompt] = useState('');
  const [editHistory, setEditHistory] = useState<string[]>([]);
  const [editHistoryIndex, setEditHistoryIndex] = useState(-1);
  const [isEditProcessing, setIsEditProcessing] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editMaskData, setEditMaskData] = useState<string | null>(null);
  const [showEditBrushModal, setShowEditBrushModal] = useState(false);

  // Format section state
  const [formatInput916, setFormatInput916] = useState<string | null>(null);
  const [formatInput11, setFormatInput11] = useState<string | null>(null);
  const [formatInput169, setFormatInput169] = useState<string | null>(null); // 16:9 input
  const [formatResult916, setFormatResult916] = useState<string | null>(null);
  const [formatResult11, setFormatResult11] = useState<string | null>(null);
  const [formatResult916From169, setFormatResult916From169] = useState<string | null>(null); // 9:16 from 16:9
  const [isFormatProcessing, setIsFormatProcessing] = useState(false);
  const [formatStatus, setFormatStatus] = useState('');
  const [selectedFormatType, setSelectedFormatType] = useState<'916to11' | '11to916' | '169to916'>('916to11');
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const formatInput916Ref = useRef<HTMLInputElement>(null);
  const formatInput11Ref = useRef<HTMLInputElement>(null);
  const formatInput169Ref = useRef<HTMLInputElement>(null);

  // Banner section state
  const [bannerInputText, setBannerInputText] = useState('');
  const [bannerIsProcessing, setBannerIsProcessing] = useState(false);
  const [bannerHistory, setBannerHistory] = useState<GeneratedImage[]>([]);
  const [bannerLastPrompt, setBannerLastPrompt] = useState('');
  const [bannerSelectedImages, setBannerSelectedImages] = useState<string[]>([]);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Ref Copy section state
  const [refCopyTemplates, setRefCopyTemplates] = useState<RefCopyTemplate[]>([]);
  const [refCopySelectedTemplate, setRefCopySelectedTemplate] = useState<string | null>(null);
  const [refCopyProductImage, setRefCopyProductImage] = useState<string | null>(null);
  const [refCopyMessages, setRefCopyMessages] = useState<{ role: 'user' | 'assistant', content: string, image?: string }[]>([]);
  const [refCopyInputText, setRefCopyInputText] = useState('');
  const [refCopyResult, setRefCopyResult] = useState<string | null>(null);
  const [isRefCopyProcessing, setIsRefCopyProcessing] = useState(false);
  const [refCopyStatus, setRefCopyStatus] = useState('');
  const [refCopyShowGallery, setRefCopyShowGallery] = useState(false);
  const [refCopyAnnotations, setRefCopyAnnotations] = useState<{ x: number, y: number, comment: string }[]>([]);
  const [refCopyActivePin, setRefCopyActivePin] = useState<number | null>(null);
  const [refCopyPinInput, setRefCopyPinInput] = useState('');
  const refCopyTemplateInputRef = useRef<HTMLInputElement>(null);
  const refCopyProductInputRef = useRef<HTMLInputElement>(null);
  const refCopyChatEndRef = useRef<HTMLDivElement>(null);

  // Load templates from Supabase on mount / session change
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchTemplates(session.user.id).then(templates => {
      setRefCopyTemplates(templates);
    });
  }, [session?.user?.id]);

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

  // Editor image handlers (NO history tracking - only for initial input)
  const handleEditor916Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditorImage916(reader.result as string);
      // Clear result history when changing input
      setEditorResultHistory916([]);
      setEditorResultIndex916(-1);
      setEditorResult916(null);
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
      // Clear result history when changing input
      setEditorResultHistory11([]);
      setEditorResultIndex11(-1);
      setEditorResult11(null);
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
        // Add to RESULT history for undo/redo
        setEditorResultHistory916(prev => [...prev.slice(0, editorResultIndex916 + 1), result916]);
        setEditorResultIndex916(prev => prev + 1);
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
        // Add to RESULT history for undo/redo
        setEditorResultHistory11(prev => [...prev.slice(0, editorResultIndex11 + 1), result11]);
        setEditorResultIndex11(prev => prev + 1);
      }

      setEditorStatus('¡Completado!');

      // Clear input images after generating (they move to results)
      setEditorImage916(null);
      setEditorImage11(null);
      setMask916Data(null);
      setMask11Data(null);
    } catch (error: any) {
      console.error('❌ Editor generation failed:', error);
      setEditorStatus(`Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsEditorProcessing(false);
    }
  };

  // Editor undo function - reverts to previous RESULT
  const handleEditorUndo = () => {
    // Undo 9:16 result
    if (editorResultIndex916 > 0) {
      const newIndex = editorResultIndex916 - 1;
      setEditorResultIndex916(newIndex);
      setEditorResult916(editorResultHistory916[newIndex]);
    }
    // Undo 1:1 result
    if (editorResultIndex11 > 0) {
      const newIndex = editorResultIndex11 - 1;
      setEditorResultIndex11(newIndex);
      setEditorResult11(editorResultHistory11[newIndex]);
    }
  };

  // Editor redo function - restores next RESULT
  const handleEditorRedo = () => {
    // Redo 9:16 result
    if (editorResultIndex916 < editorResultHistory916.length - 1) {
      const newIndex = editorResultIndex916 + 1;
      setEditorResultIndex916(newIndex);
      setEditorResult916(editorResultHistory916[newIndex]);
    }
    // Redo 1:1 result
    if (editorResultIndex11 < editorResultHistory11.length - 1) {
      const newIndex = editorResultIndex11 + 1;
      setEditorResultIndex11(newIndex);
      setEditorResult11(editorResultHistory11[newIndex]);
    }
  };

  // Use result as new input (for iterating on generated images)
  const handleUseResultAsInput = (format: '916' | '11') => {
    if (format === '916' && editorResult916) {
      setEditorImage916(editorResult916);
      // Clear result and its history
      setEditorResult916(null);
      setEditorResultHistory916([]);
      setEditorResultIndex916(-1);
      setMask916Data(null);
    } else if (format === '11' && editorResult11) {
      setEditorImage11(editorResult11);
      // Clear result and its history
      setEditorResult11(null);
      setEditorResultHistory11([]);
      setEditorResultIndex11(-1);
      setMask11Data(null);
    }
  };

  // New generation: save current results to gallery and clear ALL slots
  const handleEditorNewGeneration = () => {
    // Save current results to gallery
    if (editorResult916) {
      setHistory(prev => [{
        id: Date.now().toString() + '-editor-916',
        url: editorResult916,
        prompt: editorPrompt,
        timestamp: Date.now(),
        aspectRatio: '9:16'
      }, ...prev]);
    }
    if (editorResult11) {
      setHistory(prev => [{
        id: Date.now().toString() + '-editor-11',
        url: editorResult11,
        prompt: editorPrompt,
        timestamp: Date.now(),
        aspectRatio: '1:1'
      }, ...prev]);
    }

    // Clear ALL slots (input AND result)
    setEditorImage916(null);
    setEditorImage11(null);
    setEditorResult916(null);
    setEditorResult11(null);
    // Clear masks
    setMask916Data(null);
    setMask11Data(null);
    // Clear prompt
    setEditorPrompt('');
    // Clear result history
    setEditorResultHistory916([]);
    setEditorResultHistory11([]);
    setEditorResultIndex916(-1);
    setEditorResultIndex11(-1);
    setEditorStatus('');
  };

  // Open edit modal for a result image
  const openEditModal = (image: string, format: '916' | '11') => {
    setEditingImage(image);
    setEditingFormat(format);
    setEditHistory([image]);
    setEditHistoryIndex(0);
    setEditPrompt('');
    setEditStatus('');
    setShowEditModal(true);
  };

  // Generate edit in modal
  const handleEditGenerate = async () => {
    if (!editingImage || !editPrompt.trim()) return;

    try {
      setIsEditProcessing(true);
      setEditStatus('Optimizando prompt...');

      const optimizedPrompt = await optimizeEditorPrompt(editPrompt, editingImage, editMaskData);

      setEditStatus('Generando...');
      const result = await generateEditorImage(optimizedPrompt, editingImage, editingFormat === '916' ? '9:16' : '1:1');

      // Add to history
      setEditHistory(prev => [...prev.slice(0, editHistoryIndex + 1), result]);
      setEditHistoryIndex(prev => prev + 1);
      setEditingImage(result);

      // Also update the main result
      if (editingFormat === '916') {
        setEditorResult916(result);
        setEditorResultHistory916(prev => [...prev.slice(0, editorResultIndex916 + 1), result]);
        setEditorResultIndex916(prev => prev + 1);
      } else {
        setEditorResult11(result);
        setEditorResultHistory11(prev => [...prev.slice(0, editorResultIndex11 + 1), result]);
        setEditorResultIndex11(prev => prev + 1);
      }

      setEditStatus('¡Completado!');
    } catch (error: any) {
      setEditStatus(`Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsEditProcessing(false);
    }
  };

  // Edit modal undo
  const handleEditUndo = () => {
    if (editHistoryIndex > 0) {
      const newIndex = editHistoryIndex - 1;
      setEditHistoryIndex(newIndex);
      setEditingImage(editHistory[newIndex]);
    }
  };

  // Edit modal redo
  const handleEditRedo = () => {
    if (editHistoryIndex < editHistory.length - 1) {
      const newIndex = editHistoryIndex + 1;
      setEditHistoryIndex(newIndex);
      setEditingImage(editHistory[newIndex]);
    }
  };

  // Close edit modal and save
  const closeEditModal = () => {
    // Update the main result with the current editing image
    if (editingImage) {
      if (editingFormat === '916') {
        setEditorResult916(editingImage);
      } else {
        setEditorResult11(editingImage);
      }
    }
    setShowEditModal(false);
    setEditingImage(null);
    setEditHistory([]);
    setEditHistoryIndex(-1);
    setEditMaskData(null);
  };

  // Download image from edit modal
  const handleDownloadEditImage = () => {
    if (!editingImage) return;
    const link = document.createElement('a');
    link.href = editingImage;
    link.download = `edited_image_${editingFormat}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleFormatInput169Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormatInput169(reader.result as string);
      setFormatResult916From169(null); // Reset result
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Clear all formats function
  const handleFormatClear = () => {
    setFormatInput916(null);
    setFormatInput11(null);
    setFormatInput169(null);
    setFormatResult916(null);
    setFormatResult11(null);
    setFormatResult916From169(null);
    setFormatStatus('');
  };

  const handleFormatGenerate = async () => {
    if (isFormatProcessing) return;
    if (!formatInput916 && !formatInput11 && !formatInput169) return;

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

      // Convert 16:9 to 9:16
      if (formatInput169) {
        setFormatStatus('Generando prompt para 16:9 → 9:16...');
        const optimizedPrompt = await optimizeFormatPrompt(formatInput169, '16:9');
        console.log('📐 Format prompt (16:9→9:16):', optimizedPrompt);

        setFormatStatus('Generando imagen 9:16 desde 16:9...');
        const result = await generateFormatImage(optimizedPrompt, formatInput169, '9:16');
        setFormatResult916From169(result);
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

    // Get the 16:9 image to use as reference
    const img169 = bannerHistory.find(h => h.aspectRatio === '16:9');
    if (!img169) return;

    setBannerIsProcessing(true);

    try {
      // Create prompt that references the 16:9 image for consistency
      const prompt916 = `CRITICAL: Recreate this EXACT same image but adapted to 9:16 vertical format. 
      
PRESERVE EVERYTHING:
- Same product/subject in the EXACT same position relative to the frame
- Same colors, lighting, and visual style
- Same mood and atmosphere
- Same level of detail and quality

ADAPT FOR VERTICAL:
- Expand the canvas vertically (add space above and below)
- Keep the main subject centered
- Maintain the negative space proportions for text overlay
- Keep 40-60% of the frame as clean space for text

Original concept: ${bannerLastPrompt}

DO NOT change the subject, colors, or style. Only adapt the composition for vertical format.`;

      // Use the 16:9 image as the primary reference
      const finalImageUrl = await generateImage(prompt916, '9:16', [img169.url, ...bannerSelectedImages]);
      console.log('✅ Banner 9:16 generated from 16:9 reference');

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

  // Restart handlers for each mode - clear all state and start fresh
  const handleRestartGenerator = () => {
    setInputText('');
    setSelectedImages([]);
    setMessagesByMode(prev => ({ ...prev, generator: [] }));
    setPromptMapByMode(prev => ({ ...prev, generator: {} }));
    setLastPrompt('');
  };

  const handleRestartIteration = () => {
    setInputText('');
    setSelectedImages([]);
    setMessagesByMode(prev => ({ ...prev, iteration: [] }));
    setPromptMapByMode(prev => ({ ...prev, iteration: {} }));
    setLastPrompt('');
  };

  const handleRestartFashion = () => {
    setInputText('');
    setSelectedImages([]);
    setMessagesByMode(prev => ({ ...prev, fashion: [] }));
    setPromptMapByMode(prev => ({ ...prev, fashion: {} }));
    setLastPrompt('');
  };

  // ============================================
  // REF COPY HANDLERS
  // ============================================

  const handleRefCopyAddTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !session?.user?.id) return;
    const files = Array.from(e.target.files) as File[];
    for (const file of files) {
      const template = await uploadTemplate(session.user.id, file);
      if (template) {
        setRefCopyTemplates(prev => [...prev, template]);
      }
    }
    e.target.value = '';
  };

  const handleRefCopyDeleteTemplate = async (index: number) => {
    const template = refCopyTemplates[index];
    if (!template) return;
    // Remove from state immediately for snappy UX
    setRefCopyTemplates(prev => prev.filter((_, i) => i !== index));
    if (refCopySelectedTemplate === template.url) {
      setRefCopySelectedTemplate(null);
    }
    // Delete from Supabase in background
    await deleteTemplate(template.id, template.storagePath);
  };

  const handleRefCopyProductChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setRefCopyProductImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Helper: describe position in natural language
  const describePosition = (x: number, y: number): string => {
    const vPos = y < 0.33 ? 'parte superior' : y < 0.66 ? 'centro' : 'parte inferior';
    const hPos = x < 0.33 ? 'izquierda' : x < 0.66 ? 'centro' : 'derecha';
    if (vPos === 'centro' && hPos === 'centro') return 'centro de la imagen';
    if (hPos === 'centro') return vPos;
    return `${vPos}-${hPos}`;
  };

  const handleRefCopyAddPin = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newIdx = refCopyAnnotations.length;
    setRefCopyAnnotations(prev => [...prev, { x, y, comment: '' }]);
    setRefCopyActivePin(newIdx);
    setRefCopyPinInput('');
  };

  const handleRefCopySavePin = () => {
    if (refCopyActivePin === null) return;
    setRefCopyAnnotations(prev => prev.map((a, i) =>
      i === refCopyActivePin ? { ...a, comment: refCopyPinInput.trim() } : a
    ));
    setRefCopyActivePin(null);
    setRefCopyPinInput('');
  };

  const handleRefCopyDeletePin = (idx: number) => {
    setRefCopyAnnotations(prev => prev.filter((_, i) => i !== idx));
    if (refCopyActivePin === idx) {
      setRefCopyActivePin(null);
      setRefCopyPinInput('');
    }
  };

  const handleRefCopySend = async () => {
    const hasAnnotations = refCopyAnnotations.some(a => a.comment.trim());
    const hasText = refCopyInputText.trim();
    if ((!hasAnnotations && !hasText) || isRefCopyProcessing) return;
    if (!refCopySelectedTemplate || !refCopyProductImage) return;

    // Build prompt from annotations + optional text
    let userText = '';
    if (hasAnnotations) {
      const annotationLines = refCopyAnnotations
        .filter(a => a.comment.trim())
        .map((a, i) => `${i + 1}. En la ${describePosition(a.x, a.y)} (${Math.round(a.x * 100)}%, ${Math.round(a.y * 100)}%): "${a.comment}"`);
      userText = 'INSTRUCCIONES POR ZONA:\n' + annotationLines.join('\n');
    }
    if (hasText) {
      userText += (userText ? '\n\nINSTRUCCIONES GENERALES: ' : '') + refCopyInputText.trim();
    }

    setRefCopyMessages(prev => [...prev, { role: 'user', content: userText }]);
    setRefCopyInputText('');
    setIsRefCopyProcessing(true);
    setRefCopyStatus('Analizando plantilla y producto...');

    try {
      setRefCopyStatus('Optimizando prompt...');
      const optimizedPrompt = await optimizeRefCopyPrompt(
        userText,
        refCopySelectedTemplate,
        refCopyProductImage
      );
      console.log('📝 [RefCopy] Optimized prompt:', optimizedPrompt);

      setRefCopyStatus('Generando imagen...');
      const result = await generateRefCopyImage(
        optimizedPrompt,
        refCopySelectedTemplate,
        refCopyProductImage,
        '9:16'
      );

      setRefCopyResult(result);
      setRefCopyMessages(prev => [...prev, { role: 'assistant', content: '¡Imagen generada!', image: result }]);
      setRefCopyStatus('¡Completado!');

      // Save to gallery
      setHistory(prev => [{
        id: Date.now().toString() + '-refcopy',
        url: result,
        prompt: userText,
        timestamp: Date.now(),
        aspectRatio: '9:16'
      }, ...prev]);

    } catch (error: any) {
      console.error('❌ Ref copy generation failed:', error);
      setRefCopyStatus(`Error: ${error?.message || 'Unknown error'}`);
      setRefCopyMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error?.message || 'Error desconocido'}` }]);
    } finally {
      setIsRefCopyProcessing(false);
    }
  };

  const handleRefCopyRestart = () => {
    setRefCopySelectedTemplate(null);
    setRefCopyProductImage(null);
    setRefCopyMessages([]);
    setRefCopyInputText('');
    setRefCopyResult(null);
    setRefCopyStatus('');
    setRefCopyAnnotations([]);
    setRefCopyActivePin(null);
    setRefCopyPinInput('');
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
              onClick={() => setCurrentView('refcopy')}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-tight group ${currentView === 'refcopy' ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-gray-400'
                }`}
            >
              <Repeat className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block">Ref Copy</span>
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Introduce el Prompt</h3>
                    {/* Restart button for current mode */}
                    <button
                      onClick={() => {
                        if (activeMode === 'generator') handleRestartGenerator();
                        else if (activeMode === 'iteration') handleRestartIteration();
                        else if (activeMode === 'fashion') handleRestartFashion();
                      }}
                      disabled={activeMessages.length === 0 && selectedImages.length === 0 && !inputText.trim()}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeMessages.length > 0 || selectedImages.length > 0 || inputText.trim()
                        ? 'border-white/30 bg-white/5 hover:bg-white/10 text-white'
                        : 'border-white/10 text-gray-600 cursor-not-allowed'
                        }`}
                      title="Reiniciar (limpia todo el contenido)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

          {/* VIEW: REF COPY */}
          {currentView === 'refcopy' && (
            <div className="h-full flex flex-col p-4 overflow-hidden">
              {/* Hidden file inputs */}
              <input type="file" ref={refCopyTemplateInputRef} onChange={handleRefCopyAddTemplate} className="hidden" accept="image/*" multiple />
              <input type="file" ref={refCopyProductInputRef} onChange={handleRefCopyProductChange} className="hidden" accept="image/*" />

              {/* FULLSCREEN TEMPLATE GALLERY MODAL */}
              {refCopyShowGallery && (
                <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Plantillas de Ads</h2>
                      <span className="text-[10px] text-gray-500 font-medium">{refCopyTemplates.length} plantillas</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => refCopyTemplateInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir
                      </button>
                      <button
                        onClick={() => setRefCopyShowGallery(false)}
                        className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Grid */}
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                      {refCopyTemplates.map((tmpl, idx) => (
                        <div
                          key={tmpl.id}
                          className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 cursor-pointer group transition-all hover:scale-[1.03] ${refCopySelectedTemplate === tmpl.url
                            ? 'border-white shadow-lg shadow-white/20 ring-2 ring-white/30'
                            : 'border-white/10 hover:border-white/40'
                            }`}
                          onClick={() => {
                            setRefCopySelectedTemplate(tmpl.url);
                            setRefCopyShowGallery(false);
                          }}
                        >
                          <img src={tmpl.url} className="w-full h-full object-cover" alt={`Template ${idx + 1}`} />
                          {refCopySelectedTemplate === tmpl.url && (
                            <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4 text-black" />
                              </div>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRefCopyDeleteTemplate(idx);
                            }}
                            className="absolute top-2 right-2 bg-red-500/90 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add Template Tile */}
                      <div
                        className="aspect-[9/16] rounded-xl border-2 border-dashed border-white/15 bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center cursor-pointer group hover:border-white/30"
                        onClick={() => refCopyTemplateInputRef.current?.click()}
                      >
                        <Plus className="w-8 h-8 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-2 group-hover:text-gray-400">Añadir</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TOP BAR: Template selector strip + Product + Restart */}
              <div className="flex items-center gap-3 mb-4">
                {/* Template Selector - clickable strip */}
                <div
                  onClick={() => setRefCopyShowGallery(true)}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group flex-1 min-w-0"
                >
                  {refCopySelectedTemplate ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={refCopySelectedTemplate} className="w-8 h-14 object-cover rounded-md border border-white/20 shrink-0" alt="Selected" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white truncate">Plantilla seleccionada</p>
                        <p className="text-[9px] text-gray-500">Click para cambiar · {refCopyTemplates.length} disponibles</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-14 rounded-md border border-dashed border-white/20 bg-white/5 flex items-center justify-center shrink-0">
                        <Repeat className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selecciona plantilla</p>
                        <p className="text-[9px] text-gray-500">Click para ver todas · {refCopyTemplates.length} disponibles</p>
                      </div>
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors shrink-0 ml-auto" />
                </div>

                {/* Product upload mini */}
                <div
                  onClick={() => refCopyProductInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group shrink-0"
                >
                  {refCopyProductImage ? (
                    <div className="flex items-center gap-3">
                      <img src={refCopyProductImage} className="w-8 h-14 object-contain rounded-md border border-white/20" alt="Product" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white">Producto</p>
                        <p className="text-[9px] text-gray-500">Click para cambiar</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefCopyProductImage(null);
                        }}
                        className="p-1 bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-14 rounded-md border border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                        <Paperclip className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Producto</p>
                        <p className="text-[9px] text-gray-500">Subir imagen</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Restart */}
                <button
                  onClick={handleRefCopyRestart}
                  disabled={!refCopySelectedTemplate && !refCopyProductImage && refCopyMessages.length === 0}
                  className={`p-3 border rounded-xl transition-all shrink-0 ${refCopySelectedTemplate || refCopyProductImage || refCopyMessages.length > 0
                    ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-white/10 text-gray-700 cursor-not-allowed'
                    }`}
                  title="Reiniciar"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* MAIN AREA: Template (with annotations) + Result */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {/* Content area */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {refCopySelectedTemplate ? (
                    <div className="h-full flex gap-4 items-start justify-center p-2">

                      {/* Template with annotations — main visual */}
                      <div className="flex flex-col gap-2 max-w-[400px] shrink-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Plantilla <span className="text-gray-700 font-medium normal-case tracking-normal">· click para anotar</span></h3>
                          {refCopyAnnotations.length > 0 && (
                            <button
                              onClick={() => { setRefCopyAnnotations([]); setRefCopyActivePin(null); }}
                              className="text-[8px] text-red-400/70 hover:text-red-400 font-bold uppercase tracking-wider transition-colors"
                            >
                              Borrar pins
                            </button>
                          )}
                        </div>
                        <div
                          className="relative border border-white/10 rounded-xl overflow-hidden cursor-crosshair"
                          onClick={handleRefCopyAddPin}
                        >
                          <img src={refCopySelectedTemplate} className="w-full h-auto select-none pointer-events-none" alt="Template" draggable={false} />

                          {/* Render pins */}
                          {refCopyAnnotations.map((pin, idx) => (
                            <div
                              key={idx}
                              className="absolute"
                              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (refCopyActivePin === idx) {
                                  setRefCopyActivePin(null);
                                } else {
                                  setRefCopyActivePin(idx);
                                  setRefCopyPinInput(pin.comment);
                                }
                              }}
                            >
                              {/* Pin circle */}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg cursor-pointer transition-all hover:scale-110 ${pin.comment ? 'bg-white text-black' : 'bg-yellow-400 text-black animate-pulse'
                                }`}>
                                {idx + 1}
                              </div>

                              {/* Comment popup */}
                              {refCopyActivePin === idx && (
                                <div
                                  className="absolute z-50 mt-2 w-[240px] bg-[#1a1a1a] border border-white/20 rounded-xl shadow-2xl p-3"
                                  style={{ left: pin.x > 0.6 ? 'auto' : '0', right: pin.x > 0.6 ? '0' : 'auto' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Pin {idx + 1} · {describePosition(pin.x, pin.y)}</span>
                                    <button
                                      onClick={() => handleRefCopyDeletePin(idx)}
                                      className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
                                    >
                                      <X className="w-3 h-3 text-red-400" />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={refCopyPinInput}
                                    onChange={(e) => setRefCopyPinInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRefCopySavePin(); }}
                                    placeholder="Ej: Cambiar producto, nuevo color..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleRefCopySavePin}
                                    disabled={!refCopyPinInput.trim()}
                                    className="mt-2 w-full py-1.5 bg-white text-black rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 hover:bg-gray-200 transition-all"
                                  >
                                    Guardar
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Result — appears next to template after generation */}
                      {refCopyResult ? (
                        <div className="flex flex-col gap-2 max-w-[400px] shrink-0">
                          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Resultado</h3>
                          <div className="border border-white/20 rounded-xl overflow-hidden cursor-pointer group relative">
                            <img src={refCopyResult} className="w-full h-auto" alt="Result" onClick={() => setPreviewImage(refCopyResult)} />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(refCopyResult!, Date.now().toString());
                                }}
                                className="p-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all"
                                title="Descargar"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditorImage916(refCopyResult!);
                                  setEditorResult916(null);
                                  setEditorResultHistory916([]);
                                  setEditorResultIndex916(-1);
                                  setCurrentView('editor');
                                }}
                                className="p-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all"
                                title="Editar en Editor"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : isRefCopyProcessing ? (
                        <div className="flex flex-col items-center justify-center gap-3 min-w-[200px] py-20">
                          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
                          <p className="text-xs text-gray-500">{refCopyStatus}</p>
                        </div>
                      ) : null}

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="text-center space-y-3">
                        <Repeat className="w-10 h-10 mx-auto text-gray-800" />
                        <p className="text-[10px] text-gray-600 leading-relaxed max-w-xs">
                          Selecciona una plantilla y sube tu producto.<br />
                          Haz click en la imagen para anotar los cambios.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom bar: Annotations summary + Input */}
                <div className="shrink-0 px-2 pb-2 pt-2">
                  {/* Annotations chips */}
                  {refCopyAnnotations.filter(a => a.comment.trim()).length > 0 && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {refCopyAnnotations.filter(a => a.comment.trim()).map((a, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                            <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center text-[8px] font-black shrink-0">
                              {refCopyAnnotations.indexOf(a) + 1}
                            </span>
                            <span className="text-[10px] text-gray-400 truncate max-w-[180px]">{a.comment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Previous messages (compact) */}
                  {refCopyMessages.length > 0 && (
                    <div className="max-h-[60px] overflow-y-auto mb-2 space-y-1 px-1">
                      {refCopyMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[60%] rounded-xl px-3 py-1 ${msg.role === 'user'
                            ? 'bg-white/10 text-white'
                            : 'bg-white/5 border border-white/10 text-gray-400'
                            }`}>
                            <p className="text-[10px]">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={refCopyChatEndRef} />
                    </div>
                  )}

                  {/* Validation hint */}
                  {(!refCopySelectedTemplate || !refCopyProductImage) && (
                    <p className="text-[9px] text-yellow-500/60 font-medium mb-1.5 px-1">
                      {!refCopySelectedTemplate && !refCopyProductImage
                        ? '⚠ Selecciona una plantilla y añade un producto'
                        : !refCopySelectedTemplate
                          ? '⚠ Selecciona una plantilla de ad'
                          : '⚠ Añade la imagen del producto'}
                    </p>
                  )}

                  {/* Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={refCopyInputText}
                      onChange={(e) => setRefCopyInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleRefCopySend();
                        }
                      }}
                      placeholder={refCopyAnnotations.some(a => a.comment.trim()) ? 'Instrucciones adicionales (opcional)...' : 'Describe los cambios o añade pins en la plantilla...'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                      disabled={!refCopySelectedTemplate || !refCopyProductImage}
                    />
                    <button
                      onClick={handleRefCopySend}
                      disabled={(!refCopyInputText.trim() && !refCopyAnnotations.some(a => a.comment.trim())) || isRefCopyProcessing || !refCopySelectedTemplate || !refCopyProductImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-all"
                    >
                      {isRefCopyProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
              <input type="file" ref={formatInput169Ref} onChange={handleFormatInput169Change} className="hidden" accept="image/*" />

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
                  {/* Header with clear button */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black uppercase tracking-tight">Formatos</h2>
                    <button
                      onClick={handleFormatClear}
                      disabled={!formatInput916 && !formatInput11 && !formatInput169 && !formatResult916 && !formatResult11 && !formatResult916From169}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${formatInput916 || formatInput11 || formatInput169 || formatResult916 || formatResult11 || formatResult916From169
                        ? 'border-white/30 bg-white/5 hover:bg-white/10 text-white'
                        : 'border-white/10 text-gray-600 cursor-not-allowed'
                        }`}
                      title="Limpiar todo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

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

                  {/* 16:9 → 9:16 Row (NEW) */}
                  <div className="flex items-center gap-3 mb-4">
                    {/* Input 16:9 */}
                    <div className="flex flex-col gap-1">
                      <div
                        className="w-[140px] h-[80px] border-2 border-dashed border-white/20 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
                        onClick={() => formatInput169Ref.current?.click()}
                      >
                        {formatInput169 ? (
                          <img src={formatInput169} alt="16:9" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Paperclip className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mt-1">16:9</p>
                          </>
                        )}
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500 text-center">añade 16:9</p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-5 h-5 text-gray-600" />

                    {/* Output 9:16 (from 16:9) */}
                    <div
                      className={`w-[100px] h-[178px] border rounded-lg overflow-hidden cursor-pointer ${formatResult916From169 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                        }`}
                      onClick={() => formatResult916From169 && setPreviewImage(formatResult916From169)}
                    >
                      {formatResult916From169 ? (
                        <img src={formatResult916From169} alt="Result 9:16" className="w-full h-full object-cover" />
                      ) : isFormatProcessing && formatInput169 ? (
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
                    disabled={isFormatProcessing || (!formatInput916 && !formatInput11 && !formatInput169)}
                    className={`w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isFormatProcessing || (!formatInput916 && !formatInput11 && !formatInput169)
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
                  {/* Editor Header with Toolbar */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black uppercase tracking-tight">Editor</h2>

                    {/* Toolbar: New Generation Button only */}
                    <button
                      onClick={handleEditorNewGeneration}
                      disabled={!editorResult916 && !editorResult11}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${editorResult916 || editorResult11
                        ? 'border-white/30 bg-white/5 hover:bg-white/10 text-white'
                        : 'border-white/10 text-gray-600 cursor-not-allowed'
                        }`}
                      title="Nueva generación (guarda actual en galería)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

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

                    {/* Right Section: Prompt with integrated Brush */}
                    <div className="flex-1 flex flex-col gap-3 max-w-md">
                      {/* Generate Button - moved up */}
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

                      {/* Status */}
                      {editorStatus && (
                        <p className={`text-xs font-medium ${editorStatus.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                          {editorStatus}
                        </p>
                      )}

                      {/* Prompt Area with integrated Brush */}
                      <div className="border border-white/10 rounded-xl bg-[#0a0a0a]/50 p-4 flex-1 flex flex-col relative">
                        <textarea
                          value={editorPrompt}
                          onChange={(e) => setEditorPrompt(e.target.value)}
                          placeholder="añade el prompt para cambiar (ej: 'cambia el fondo a una playa')"
                          className="flex-1 bg-transparent focus:outline-none text-sm font-medium placeholder:text-gray-600 resize-none pb-10"
                        />
                        {/* Brush button inside chat box - bottom right */}
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                          {(mask916Data || mask11Data) && (
                            <span className="text-[8px] text-green-400 font-bold uppercase">Máscara ✓</span>
                          )}
                          <button
                            onClick={() => {
                              if (editorImage916 || editorImage11) {
                                // Set activeEditImage to a format that actually has an image
                                if (!editorImage916 && editorImage11) {
                                  setActiveEditImage('11');
                                } else if (editorImage916 && !editorImage11) {
                                  setActiveEditImage('916');
                                }
                                setShowBrushModal(true);
                              }
                            }}
                            className={`p-2 border border-white/20 rounded-lg transition-colors group ${(editorImage916 || editorImage11)
                              ? 'bg-white/5 hover:bg-white/10 cursor-pointer'
                              : 'bg-white/[0.02] cursor-not-allowed opacity-50'
                              }`}
                            title={editorImage916 || editorImage11 ? "Pintar zonas a editar" : "Sube imágenes primero"}
                          >
                            <Paintbrush className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results Section */}
                  <div className="mt-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Resultado:</h3>
                    <div className="flex gap-4">
                      {/* Result 9:16 */}
                      <div className="flex flex-col gap-2">
                        <div
                          className={`w-[140px] h-[250px] border rounded-xl overflow-hidden cursor-pointer relative group ${editorResult916 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                            }`}
                          onClick={() => editorResult916 && setPreviewImage(editorResult916)}
                        >
                          {editorResult916 ? (
                            <img src={editorResult916} alt="Result 9:16" className="w-full h-full object-cover" />
                          ) : isEditorProcessing ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <RefreshCw className="w-6 h-6 animate-spin text-gray-600" />
                            </div>
                          ) : null}
                        </div>
                        {editorResult916 && (
                          <button
                            onClick={() => openEditModal(editorResult916, '916')}
                            className="text-[9px] font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-1 py-1.5 border border-white/20 rounded-lg"
                          >
                            ✏️ Editar
                          </button>
                        )}
                      </div>
                      {/* Result 1:1 */}
                      <div className="flex flex-col gap-2">
                        <div
                          className={`w-[120px] h-[120px] border rounded-xl overflow-hidden cursor-pointer relative group ${editorResult11 ? 'border-white/20' : 'border-dashed border-white/10 bg-white/[0.02]'
                            }`}
                          onClick={() => editorResult11 && setPreviewImage(editorResult11)}
                        >
                          {editorResult11 ? (
                            <img src={editorResult11} alt="Result 1:1" className="w-full h-full object-cover" />
                          ) : isEditorProcessing ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <RefreshCw className="w-6 h-6 animate-spin text-gray-600" />
                            </div>
                          ) : null}
                        </div>
                        {editorResult11 && (
                          <button
                            onClick={() => openEditModal(editorResult11, '11')}
                            className="text-[9px] font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-1 py-1.5 border border-white/20 rounded-lg"
                          >
                            ✏️ Editar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-black uppercase tracking-tight">Editar Imagen</h3>
                {/* Undo/Redo Controls */}
                <div className="flex items-center gap-1 border border-white/10 rounded-lg px-2 py-1">
                  <button
                    onClick={handleEditUndo}
                    disabled={editHistoryIndex <= 0}
                    className={`p-1 rounded transition-all ${editHistoryIndex > 0
                      ? 'text-white hover:bg-white/10'
                      : 'text-gray-600 cursor-not-allowed'
                      }`}
                    title="Ver versión anterior"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 px-1">antes</span>
                  <span className="text-gray-600">-</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 px-1">después</span>
                  <button
                    onClick={handleEditRedo}
                    disabled={editHistoryIndex >= editHistory.length - 1}
                    className={`p-1 rounded transition-all ${editHistoryIndex < editHistory.length - 1
                      ? 'text-white hover:bg-white/10'
                      : 'text-gray-600 cursor-not-allowed'
                      }`}
                    title="Ver siguiente versión"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] text-gray-500">
                  Versión {editHistoryIndex + 1} de {editHistory.length}
                </span>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex gap-6 p-6 overflow-hidden">
              {/* Left: Image + Download */}
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className={`${editingFormat === '916' ? 'max-w-[300px]' : 'max-w-[400px]'} w-full`}>
                  <img
                    src={editingImage}
                    alt="Editing"
                    className="w-full h-auto rounded-xl border border-white/20"
                  />
                </div>
                {/* Download Button */}
                <button
                  onClick={handleDownloadEditImage}
                  className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-[10px] font-bold uppercase tracking-wider"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
              </div>

              {/* Right: Chat */}
              <div className="w-[320px] flex flex-col gap-4">
                {/* Generate Button */}
                <button
                  onClick={handleEditGenerate}
                  disabled={isEditProcessing || !editPrompt.trim()}
                  className={`w-full py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isEditProcessing || !editPrompt.trim()
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-gray-200'
                    }`}
                >
                  {isEditProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Aplicar cambio'
                  )}
                </button>

                {/* Status */}
                {editStatus && (
                  <p className={`text-xs font-medium ${editStatus.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                    {editStatus}
                  </p>
                )}

                {/* Chat/Prompt Area with integrated Brush */}
                <div className="border border-white/10 rounded-xl bg-[#0a0a0a]/50 p-4 flex-1 flex flex-col relative">
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Describe qué cambio quieres aplicar (ej: 'cambia el fondo a una playa', 'hazlo más brillante')"
                    className="flex-1 bg-transparent focus:outline-none text-sm font-medium placeholder:text-gray-600 resize-none pb-10"
                  />
                  {/* Brush button inside chat box - bottom right */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {editMaskData && (
                      <span className="text-[8px] text-green-400 font-bold uppercase">Máscara ✓</span>
                    )}
                    <button
                      onClick={() => setShowEditBrushModal(true)}
                      className="p-2 border border-white/20 rounded-lg transition-colors group bg-white/5 hover:bg-white/10 cursor-pointer"
                      title="Pintar zonas a editar"
                    >
                      <Paintbrush className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Tips */}
                <div className="text-[9px] text-gray-600 space-y-1">
                  <p>💡 Cada cambio se guarda en el historial</p>
                  <p>↩️ Usa "antes/después" para comparar versiones</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Brush Modal (for edit modal) */}
      {showEditBrushModal && editingImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowEditBrushModal(false)}
        >
          {/* Toolbar */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-white/10 rounded-xl border border-white/20">
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
                  setEditMaskData(maskData);
                }
                setShowEditBrushModal(false);
              }}
              className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-bold uppercase hover:bg-gray-200 transition-colors"
            >
              Guardar
            </button>

            {/* Close */}
            <button
              onClick={() => setShowEditBrushModal(false)}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas container */}
          <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <img
              ref={imageRef}
              src={editingImage}
              alt="Edit mask"
              className="max-w-[80vw] max-h-[70vh] object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                const canvas = canvasRef.current;
                if (canvas) {
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  // Load existing mask if any
                  if (editMaskData) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      const maskImg = new Image();
                      maskImg.onload = () => {
                        ctx.drawImage(maskImg, 0, 0);
                      };
                      maskImg.src = editMaskData;
                    }
                  }
                }
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              style={{ opacity: 0.6 }}
              onMouseDown={(e) => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(x, y, brushSize, 0, Math.PI * 2);
                ctx.fill();

                setIsDrawing(true);
              }}
              onMouseMove={(e) => {
                if (!isDrawing) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(x, y, brushSize, 0, Math.PI * 2);
                ctx.fill();
              }}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;