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

// Fix: Follow GoogleGenAI initialization guidelines and ensure correct model usage
export const professionalizePrompt = async (input: string, mode: ChatMode, imagesBase64: string[] = []): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let systemInstruction = GENERATOR_PROMPT;
  if (mode === 'iteration') systemInstruction = ITERATION_PROMPT;
  if (mode === 'fashion') systemInstruction = FASHION_PROMPT;

  const parts: Part[] = [
    {
      text: mode === 'fashion'
        ? `Fashion Iteration Request: "${input}". Focus on identity preservation and high-end editorial quality.`
        : mode === 'iteration'
          ? `Ad Re-composition Request: "${input}". Match reference style perfectly.`
          : `Environment Synthesis Request: "${input}"`
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

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      systemInstruction,
      temperature: 0.5,
    },
  });

  return response.text?.trim() || input;
};

// Fix: Ensure proper image generation model usage and output extraction
export const generateImage = async (prompt: string, aspectRatio: AspectRatio, referenceImages: string[] = []): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: Part[] = [{ text: prompt }];

  referenceImages.forEach((img) => {
    const mimeType = img.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
    parts.unshift({
      inlineData: {
        data: img.split(',')[1] || img,
        mimeType: mimeType
      }
    });
  });

  parts.push({ text: "FINAL VERIFICATION: Absolute facial identity preservation. Photographic realism. 8K Resolution. No text. No artifacts." });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "4K"
      },
    },
  });

  let imageUrl = '';
  if (response.candidates?.[0]?.content) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!imageUrl) throw new Error('Generation failed.');
  return imageUrl;
};