import { GoogleGenAI, Part } from "@google/genai";
import { AspectRatio, ChatMode } from "../types";

const GENERATOR_PROMPT = `
You are an elite Visual Strategist for high-end commercial advertising.
Your goal: Take a user's idea or an object from an image and place it in a breathtaking, professional environment.
STRICT VISUAL CONSTRAINTS: NO studio gear, luxury environments, cinematic lighting, NO TEXT.
`;

const ITERATION_PROMPT = `
You are a Lead Creative Director. 
Task: Recreate exact composition, lighting, and style from reference ad, replacing the original product with a new one.
WORKFLOW: PRODUCT REPLACEMENT IN AD. 
Match perspective, scale, and lighting. REMOVE ALL TEXT/LOGOS.
`;

const FASHION_PROMPT = `
You are a World-Class Fashion Photographer and AI Retoucher for Vogue and Harper's Bazaar.
TASK: Generate a hyper-realistic fashion photography iteration.
CRITICAL CONSTRAINTS:
1. FACIAL PRESERVATION: You MUST preserve exact facial features, identity, bone structure, eye shape/color, and distinctive marks from the source image.
2. REALISM: Visible skin pores, subsurface scattering, individual hair strands (flyaways), and natural skin texture variation.
3. ANATOMY: Perfect human anatomy, correct finger count (5), natural joints.
4. FABRIC: Realistic fabric physics, draping, and texture (silk, leather, denim).
5. PHOTOGRAPHY: Canon EOS R5 quality, 85mm f/1.4, shallow depth of field, creamy bokeh, professional editorial lighting.
6. NO AI TELLS: No plastic skin, no smoothing, no symmetry artifacts. 
7. NEGATIVE: Different face, altered features, CGI look, deepfake artifacts, extra fingers, blurry, oversaturated.
`;

const EDITOR_PROMPT = `
Eres un agente de edición de imágenes mediante Nano Banana. Tu función es recibir una imagen, un prompt del usuario, y opcionalmente una máscara, para generar UN ÚNICO prompt optimizado para Nano Banana.

NO puedes hacer preguntas ni pedir aclaraciones. Debes interpretar la intención del usuario y generar el mejor prompt posible en un solo intento.

---

## DETECCIÓN DE MÁSCARA

**Sin máscara:**
- Genera el prompt confiando en que Nano Banana interpretará automáticamente qué área editar
- Basa tu prompt únicamente en la descripción textual del usuario

**Con máscara:**
- La máscara tiene PRIORIDAD ABSOLUTA
- Edita SOLO el área enmascarada, sin importar lo que diga el prompt
- Analiza: posición (top/middle/bottom, left/center/right), tamaño relativo, y qué objeto cubre
- NUNCA modifiques nada fuera del área enmascarada

---

## ANÁLISIS DE MÁSCARA (solo si se proporciona)

1. **Posición:** Divide la imagen en cuadrícula 3x3, identifica dónde está la máscara
2. **Tamaño:** tiny (<5%), small (5-15%), medium (15-40%), large (40-70%), full (>70%)
3. **Contenido:** Identifica qué objeto/elemento específico está bajo la máscara
4. **Contexto:** Identifica elementos circundantes que deben preservarse

---

## REGLAS DE GENERACIÓN

1. **FIDELIDAD ABSOLUTA:** Ejecuta únicamente lo que el usuario pide. No añadas mejoras no solicitadas.

2. **SIEMPRE EN INGLÉS:** Genera el prompt final en inglés para mejor rendimiento de Nano Banana.

3. **ESTRUCTURA DEL PROMPT:**
   - Sin máscara: "[ACTION] [ELEMENT] to [DESIRED_CHANGE], keeping [OTHER_ELEMENTS] exactly the same. Maintain consistent lighting and style."
   - Con máscara: "[ACTION] the [IDENTIFIED_OBJECT] in the [POSITION] area to [DESIRED_CHANGE], keeping [SURROUNDING_ELEMENTS] exactly the same. Maintain consistent lighting, perspective, and style."

4. **PRESERVACIÓN:** Siempre incluye instrucciones para mantener intactos los elementos no editados.

5. **ESPECIFICIDAD:** Sé lo más específico posible. Evita términos vagos.

6. **UN CAMBIO POR PROMPT:** Si la solicitud es compleja, prioriza la acción principal.

7. **INTERPRETACIÓN INTELIGENTE:** Si el prompt del usuario es vago, interpreta la intención más probable basándote en el contexto de la imagen.

---

## OUTPUT

Responde ÚNICAMENTE con el prompt optimizado en inglés. Sin explicaciones, sin análisis, sin notas adicionales. Solo el prompt listo para Nano Banana.
`;

const FORMAT_PROMPT = `
Eres un agente de reformateo de imágenes mediante Nano Banana. Tu función es recibir una imagen en formato 9:16 o 1:1 y generar un prompt para recrearla en el formato contrario, manteniendo el contenido EXACTAMENTE igual.
NO puedes hacer preguntas. Debes analizar la imagen y generar el mejor prompt posible en un solo intento.

DETECCIÓN DE FORMATO
Analiza el aspect ratio de la imagen de entrada. Si es vertical (9:16 o similar) el output será 1:1. Si es cuadrada (1:1 o similar) el output será 9:16. Si el formato no es claramente 9:16 ni 1:1, elige el más cercano.

ESTRATEGIA DE CONVERSIÓN
De 9:16 (vertical) a 1:1 (cuadrado): La imagen se expandirá HORIZONTALMENTE (lados izquierdo y derecho). El contenido original debe quedar CENTRADO. Las áreas nuevas deben continuar el contexto visual de forma coherente.
De 1:1 (cuadrado) a 9:16 (vertical): La imagen se expandirá VERTICALMENTE (arriba y abajo). El contenido original debe quedar CENTRADO. Las áreas nuevas deben continuar el contexto visual de forma coherente.

REGLAS FUNDAMENTALES
PRESERVACIÓN TOTAL: El contenido original NO se modifica. Solo se expande el canvas.
COHERENCIA VISUAL: Las áreas expandidas deben continuar el fondo y ambiente de forma natural, mantener la misma iluminación, mantener el mismo estilo y paleta de colores, y no añadir elementos nuevos importantes como personas u objetos destacados.
SIEMPRE EN INGLÉS: Genera el prompt en inglés.
DESCRIPCIÓN DETALLADA: Describe con precisión qué hay en la imagen para que Nano Banana la replique fielmente al expandir.

ESTRUCTURA DEL PROMPT
Sigue esta estructura: Expand this image from [FORMATO_ACTUAL] to [FORMATO_NUEVO]. The image contains: [DESCRIPCIÓN DETALLADA DEL CONTENIDO]. Extend the [LEFT AND RIGHT SIDES o TOP AND BOTTOM] naturally, continuing the [DESCRIPCIÓN DEL FONDO] seamlessly. Keep the original content exactly in the center, completely unchanged. Do not add any new prominent objects or subjects. Maintain identical lighting, color palette, and visual style throughout the expanded areas.

OUTPUT
Responde ÚNICAMENTE con el prompt optimizado en inglés. Sin explicaciones, sin análisis, sin notas adicionales. Solo el prompt listo para Nano Banana.
`;

export const professionalizePrompt = async (input: string, mode: ChatMode, imagesBase64: string[] = []): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  let systemInstruction = GENERATOR_PROMPT;
  if (mode === 'iteration') systemInstruction = ITERATION_PROMPT;
  if (mode === 'fashion') systemInstruction = FASHION_PROMPT;

  // Enhanced instruction when images are present
  const hasImages = imagesBase64.length > 0;
  const imageAnalysisInstruction = hasImages
    ? `\n\nCRITICAL IMAGE ANALYSIS REQUIRED:
You are analyzing ${imagesBase64.length} reference image(s). You MUST:
1. Describe EVERY visible object, product, person, or subject in extreme detail
2. Note exact colors (hex codes if possible), materials, textures, shapes, sizes
3. Describe lighting, shadows, perspective, and composition
4. List all visible text, logos, or branding (to be removed if needed)
5. Identify the environment, setting, and background elements
6. Your output prompt MUST be so detailed that an image generator can recreate these objects/subjects without seeing the original images

Output Format: A single, comprehensive prompt for Imagen that includes all visual details from the reference images combined with the user's request.`
    : '';

  const parts: Part[] = [
    {
      text: (mode === 'fashion'
        ? `Fashion Iteration Request: "${input}". Focus on identity preservation and high-end editorial quality.`
        : mode === 'iteration'
          ? `Ad Re-composition Request: "${input}". Match reference style perfectly.`
          : `Environment Synthesis Request: "${input}"`) + imageAnalysisInstruction
    }
  ];

  imagesBase64.forEach(img => {
    const mimeType = img.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
    parts.push({
      inlineData: {
        data: img.split(',')[1] || img,
        mimeType: mimeType
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-preview-09-2025',
      contents: [{ role: 'user', parts: parts }],
      config: {
        systemInstruction,
        temperature: 0.7, // Increased for more creative descriptions
      },
    });

    const txt = response.text;
    console.log('🎨 OPTIMIZED PROMPT:', txt);
    return txt?.trim() || input;
  } catch (err) {
    console.error("Prompt optimization failed:", err);
    return input;
  }
};

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateImage = async (prompt: string, aspectRatio: AspectRatio, referenceImages: string[] = []): Promise<string> => {
  console.log('🚀 [generateImage] Starting image generation...');
  console.log('📝 [generateImage] Prompt length:', prompt.length);
  console.log('🖼️  [generateImage] Reference images count:', referenceImages.length);
  console.log('📐 [generateImage] Aspect ratio:', aspectRatio);

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const parts: Part[] = [{ text: prompt }];

  // Add reference images as inline data parts
  referenceImages.forEach((img, idx) => {
    const mimeType = img.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
    const base64Data = img.split(',')[1] || img;
    console.log(`🖼️  [generateImage] Adding reference image ${idx + 1}: ${mimeType}, data length: ${base64Data.length}`);
    parts.unshift({
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    });
  });

  parts.push({ text: "FINAL VERIFICATION: Absolute facial identity preservation. Photographic realism. 8K Resolution. No text. No artifacts." });

  console.log('🎯 [generateImage] Total parts to send:', parts.length);

  // Models to try in order of preference
  const modelsToTry = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-preview-image-generation'
  ];

  const maxRetriesPerModel = 2;

  for (const modelName of modelsToTry) {
    console.log(`\n🔄 [generateImage] === Trying model: ${modelName} ===`);

    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      console.log(`📡 [generateImage] Attempt ${attempt}/${maxRetriesPerModel} with ${modelName}`);

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: '2K'
            },
          },
        });

        console.log('✅ [generateImage] API call successful');
        console.log('📦 [generateImage] Response candidates:', response.candidates?.length || 0);

        // Extract the generated image from response parts
        let imageUrl = '';
        if (response.candidates?.[0]?.content) {
          console.log('🔍 [generateImage] Searching for image in response parts...');
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              console.log('🎉 [generateImage] Image found! Data length:', part.inlineData.data.length);
              break;
            }
          }
        }

        if (imageUrl) {
          console.log(`✨ [generateImage] Success with ${modelName}!`);
          return imageUrl;
        }

        console.warn('⚠️ [generateImage] No image in response');
        throw new Error('No image in response');

      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isOverloaded = errorMessage.includes('503') ||
          errorMessage.includes('overloaded') ||
          errorMessage.includes('UNAVAILABLE') ||
          errorMessage.includes('Resource exhausted');

        console.error(`💥 [generateImage] Error with ${modelName} (attempt ${attempt}):`, errorMessage);

        if (isOverloaded && attempt < maxRetriesPerModel) {
          const waitTime = attempt * 3000; // 3s, 6s
          console.log(`⏳ [generateImage] Model overloaded, waiting ${waitTime / 1000}s before retry...`);
          await delay(waitTime);
          continue;
        }

        // If overloaded on last attempt, break to try next model
        if (isOverloaded) {
          console.log(`🔀 [generateImage] ${modelName} overloaded, switching to next model...`);
          break;
        }

        // Non-overload error on primary model - try fallback
        if (modelName === modelsToTry[0]) {
          console.log(`⚠️ [generateImage] Error with primary model, trying fallback...`);
          break;
        }

        // Non-overload error on fallback - throw
        throw error;
      }
    }
  }

  throw new Error('Image generation failed: All models are currently overloaded. Please try again in a few minutes.');
};

// ============================================
// EDITOR MODE FUNCTIONS
// ============================================

export const optimizeEditorPrompt = async (
  userPrompt: string,
  imageBase64: string,
  maskBase64: string | null
): Promise<string> => {
  console.log('🎨 [optimizeEditorPrompt] Starting editor prompt optimization...');
  console.log('📝 [optimizeEditorPrompt] User prompt:', userPrompt);
  console.log('🖼️  [optimizeEditorPrompt] Has image:', !!imageBase64);
  console.log('🎭 [optimizeEditorPrompt] Has mask:', !!maskBase64);

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const parts: Part[] = [];

  // Add the original image
  const imageMimeType = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
  parts.push({
    inlineData: {
      data: imageBase64.split(',')[1] || imageBase64,
      mimeType: imageMimeType
    }
  });

  // Add mask if present
  if (maskBase64) {
    const maskMimeType = maskBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
    parts.push({
      inlineData: {
        data: maskBase64.split(',')[1] || maskBase64,
        mimeType: maskMimeType
      }
    });
    parts.push({
      text: `IMAGEN ORIGINAL: Primera imagen adjunta.
MÁSCARA: Segunda imagen adjunta (las zonas pintadas en rosa/rojo son las áreas a editar).
SOLICITUD DEL USUARIO: "${userPrompt}"

Analiza la máscara y genera el prompt optimizado en inglés.`
    });
  } else {
    parts.push({
      text: `IMAGEN ORIGINAL: Imagen adjunta.
NO HAY MÁSCARA.
SOLICITUD DEL USUARIO: "${userPrompt}"

Genera el prompt optimizado en inglés.`
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-preview-09-2025',
      contents: [{ role: 'user', parts: parts }],
      config: {
        systemInstruction: EDITOR_PROMPT,
        temperature: 0.3, // Lower temperature for more precise outputs
      },
    });

    const optimizedPrompt = response.text?.trim() || userPrompt;
    console.log('✅ [optimizeEditorPrompt] Optimized prompt:', optimizedPrompt);
    return optimizedPrompt;
  } catch (err) {
    console.error('❌ [optimizeEditorPrompt] Failed:', err);
    return userPrompt;
  }
};

export const generateEditorImage = async (
  optimizedPrompt: string,
  originalImage: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  console.log('🚀 [generateEditorImage] Starting editor image generation...');
  console.log('📝 [generateEditorImage] Prompt:', optimizedPrompt.substring(0, 100) + '...');

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  // Add original image first, then the editing prompt
  const imageMimeType = originalImage.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
  const parts: Part[] = [
    {
      inlineData: {
        data: originalImage.split(',')[1] || originalImage,
        mimeType: imageMimeType
      }
    },
    { text: optimizedPrompt },
    { text: "CRITICAL: Apply the edit to this exact image. Preserve all unmentioned elements exactly. Photorealistic quality. No artifacts." }
  ];

  const modelsToTry = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-preview-image-generation'
  ];

  const maxRetriesPerModel = 2;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const modelName of modelsToTry) {
    console.log(`🔄 [generateEditorImage] Trying model: ${modelName}`);

    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: '2K'
            },
          },
        });

        let imageUrl = '';
        if (response.candidates?.[0]?.content) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              console.log('🎉 [generateEditorImage] Image generated successfully!');
              break;
            }
          }
        }

        if (imageUrl) return imageUrl;
        throw new Error('No image in response');

      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isOverloaded = errorMessage.includes('503') ||
          errorMessage.includes('overloaded') ||
          errorMessage.includes('UNAVAILABLE');

        console.error(`💥 [generateEditorImage] Error (attempt ${attempt}):`, errorMessage);

        if (isOverloaded && attempt < maxRetriesPerModel) {
          await delay(attempt * 3000);
          continue;
        }

        if (isOverloaded) break;
        if (modelName !== modelsToTry[0]) throw error;
        break;
      }
    }
  }

  throw new Error('Editor image generation failed. Please try again.');
};

// ============================================
// FORMAT CONVERSION FUNCTIONS
// ============================================

export const optimizeFormatPrompt = async (
  imageBase64: string,
  sourceFormat: '9:16' | '1:1'
): Promise<string> => {
  console.log('📐 [optimizeFormatPrompt] Starting format prompt optimization...');
  console.log('📝 [optimizeFormatPrompt] Source format:', sourceFormat);
  const targetFormat = sourceFormat === '9:16' ? '1:1' : '9:16';
  console.log('🎯 [optimizeFormatPrompt] Target format:', targetFormat);

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const imageMimeType = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
  const parts: Part[] = [
    {
      inlineData: {
        data: imageBase64.split(',')[1] || imageBase64,
        mimeType: imageMimeType
      }
    },
    {
      text: `Esta imagen está en formato ${sourceFormat}. Genera el prompt para expandirla a formato ${targetFormat}.`
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-preview-09-2025',
      contents: [{ role: 'user', parts: parts }],
      config: {
        systemInstruction: FORMAT_PROMPT,
        temperature: 0.3,
      },
    });

    const optimizedPrompt = response.text?.trim() || `Expand this image from ${sourceFormat} to ${targetFormat}. Keep the original content centered and unchanged.`;
    console.log('✅ [optimizeFormatPrompt] Optimized prompt:', optimizedPrompt);
    return optimizedPrompt;
  } catch (err) {
    console.error('❌ [optimizeFormatPrompt] Failed:', err);
    return `Expand this image from ${sourceFormat} to ${targetFormat}. Keep the original content centered and unchanged. Extend the canvas naturally.`;
  }
};

export const generateFormatImage = async (
  optimizedPrompt: string,
  originalImage: string,
  targetFormat: AspectRatio
): Promise<string> => {
  console.log('🚀 [generateFormatImage] Starting format image generation...');
  console.log('📐 [generateFormatImage] Target format:', targetFormat);

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  const imageMimeType = originalImage.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
  const parts: Part[] = [
    {
      inlineData: {
        data: originalImage.split(',')[1] || originalImage,
        mimeType: imageMimeType
      }
    },
    { text: optimizedPrompt },
    { text: "CRITICAL: Expand the canvas while keeping the ORIGINAL IMAGE CONTENT EXACTLY in the center. The new areas must blend seamlessly. Do not modify, crop, or alter the original subject in any way." }
  ];

  const modelsToTry = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-preview-image-generation'
  ];

  const maxRetriesPerModel = 2;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const modelName of modelsToTry) {
    console.log(`🔄 [generateFormatImage] Trying model: ${modelName}`);

    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: targetFormat,
              imageSize: '2K'
            },
          },
        });

        let imageUrl = '';
        if (response.candidates?.[0]?.content) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              console.log('🎉 [generateFormatImage] Image generated successfully!');
              break;
            }
          }
        }

        if (imageUrl) return imageUrl;
        throw new Error('No image in response');

      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isOverloaded = errorMessage.includes('503') ||
          errorMessage.includes('overloaded') ||
          errorMessage.includes('UNAVAILABLE');

        console.error(`💥 [generateFormatImage] Error (attempt ${attempt}):`, errorMessage);

        if (isOverloaded && attempt < maxRetriesPerModel) {
          await delay(attempt * 3000);
          continue;
        }

        if (isOverloaded) break;
        if (modelName !== modelsToTry[0]) throw error;
        break;
      }
    }
  }

  throw new Error('Format image generation failed. Please try again.');
};