import { AspectRatio, ChatMode } from "../types";

// All API calls go through server-side functions - API key is NEVER exposed to client

export const professionalizePrompt = async (input: string, mode: ChatMode, imagesBase64: string[] = []): Promise<string> => {
  try {
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, mode, imagesBase64 }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Optimization failed');
    }

    const data = await response.json();
    console.log('🎨 OPTIMIZED PROMPT:', data.result);
    return data.result || input;
  } catch (err) {
    console.error("Prompt optimization failed:", err);
    return input;
  }
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio, referenceImages: string[] = []): Promise<string> => {
  console.log('🚀 [generateImage] Starting image generation...');
  console.log('📝 [generateImage] Prompt length:', prompt.length);
  console.log('🖼️  [generateImage] Reference images count:', referenceImages.length);
  console.log('📐 [generateImage] Aspect ratio:', aspectRatio);

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, referenceImages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Image generation failed');
  }

  const data = await response.json();
  console.log('✨ [generateImage] Success!');
  return data.result;
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

  try {
    const response = await fetch('/api/editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'optimize',
        userPrompt,
        imageBase64,
        maskBase64
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Editor optimization failed');
    }

    const data = await response.json();
    console.log('✅ [optimizeEditorPrompt] Optimized prompt:', data.result);
    return data.result || userPrompt;
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

  const response = await fetch('/api/editor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate',
      optimizedPrompt,
      imageBase64: originalImage,
      aspectRatio
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Editor image generation failed');
  }

  const data = await response.json();
  console.log('🎉 [generateEditorImage] Image generated successfully!');
  return data.result;
};

// ============================================
// FORMAT CONVERSION FUNCTIONS
// ============================================

export const optimizeFormatPrompt = async (
  imageBase64: string,
  sourceFormat: '9:16' | '1:1'
): Promise<string> => {
  console.log('📐 [optimizeFormatPrompt] Starting format prompt optimization...');

  try {
    const response = await fetch('/api/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'optimize',
        imageBase64,
        sourceFormat
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Format optimization failed');
    }

    const data = await response.json();
    console.log('✅ [optimizeFormatPrompt] Optimized prompt:', data.result);
    return data.result;
  } catch (err) {
    console.error('❌ [optimizeFormatPrompt] Failed:', err);
    const targetFormat = sourceFormat === '9:16' ? '1:1' : '9:16';
    return `Expand this image from ${sourceFormat} to ${targetFormat}. Keep the original content centered and unchanged. Extend the canvas naturally.`;
  }
};

export const generateFormatImage = async (
  optimizedPrompt: string,
  originalImage: string,
  targetFormat: AspectRatio
): Promise<string> => {
  console.log('🚀 [generateFormatImage] Starting format image generation...');

  const response = await fetch('/api/format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate',
      optimizedPrompt,
      imageBase64: originalImage,
      targetFormat
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Format image generation failed');
  }

  const data = await response.json();
  console.log('🎉 [generateFormatImage] Image generated successfully!');
  return data.result;
};