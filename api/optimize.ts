import { GoogleGenAI, Part } from "@google/genai";

const GENERATOR_PROMPT = `
You are an elite Visual Strategist for high-end commercial advertising.

PRODUCT DESIGN PRESERVATION RULE:
The product/object from the reference image MUST maintain its EXACT DESIGN:
- EXACT same colors, textures, and materials
- EXACT same logos, labels, patterns, and all visual details
- EXACT same proportions and scale relative to itself
- DO NOT modify, improve, recolor, or redesign the product

WHAT YOU CAN CHANGE:
- Product POSITION in the scene (angle, rotation, tilt, orientation)
- Product PLACEMENT (where it sits in the composition)
- Environment, background, lighting, shadows, reflections

WHAT YOU CANNOT CHANGE:
- Any aspect of the product's actual DESIGN or APPEARANCE
- Colors, logos, textures, patterns, labels, or visual details of the product

YOUR JOB: Place this product (with unchanged design) in an appropriate, stunning environment. You may reposition/rotate the product naturally in the scene.

STRICT VISUAL CONSTRAINTS: NO studio gear visible, luxury environments preferred, cinematic lighting, NO TEXT anywhere.
`;

const ITERATION_PROMPT = `
You are a Lead Creative Director specializing in product photography.

PRODUCT DESIGN PRESERVATION RULE:
The product from the reference image MUST maintain its EXACT DESIGN:
- EXACT same colors, textures, logos, patterns, and all visual details
- DO NOT modify, recolor, redesign, or reinterpret the product's appearance

WHAT YOU CAN CHANGE:
- Product POSITION (angle, rotation, orientation in the scene)
- Product PLACEMENT in the composition
- The entire ENVIRONMENT and STYLE around the product

Task: Take the product (with unchanged design) and place it into a scene that matches the style, composition, lighting, and perspective of the reference advertisement. You can reposition the product naturally.

MATCH: lighting direction, color grading, mood, visual style.
REMOVE: All text and watermarks from the ENVIRONMENT (keep product logos intact).
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

export const config = {
    maxDuration: 60,
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { input, mode, imagesBase64 } = await req.json();

        // API Key is ONLY on server - never exposed to client
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        let systemInstruction = GENERATOR_PROMPT;
        if (mode === 'iteration') systemInstruction = ITERATION_PROMPT;
        if (mode === 'fashion') systemInstruction = FASHION_PROMPT;

        const hasImages = imagesBase64?.length > 0;
        const imageAnalysisInstruction = hasImages
            ? `\n\nCRITICAL IMAGE ANALYSIS - PRODUCT DESIGN PRESERVATION:
You are analyzing ${imagesBase64.length} reference image(s) containing a PRODUCT whose DESIGN must be preserved exactly.

STEP 1 - DOCUMENT THE PRODUCT DESIGN:
- Note EVERY color with precision (hex codes preferred)
- Document ALL visible logos, labels, text, patterns, and design details
- Describe materials and textures (glossy, matte, metallic, fabric type, etc.)
- These design elements CANNOT change

STEP 2 - UNDERSTAND WHAT CAN CHANGE:
- Product POSITION: Can be rotated, tilted, angled differently
- Product PLACEMENT: Can be positioned anywhere in the scene
- ENVIRONMENT: Can be completely changed

STEP 3 - UNDERSTAND WHAT CANNOT CHANGE:
- Product DESIGN: Colors, logos, textures, patterns, labels
- Product APPEARANCE: Must look identical, just from a different angle/position if needed

OUTPUT FORMAT:
Generate a prompt that:
1. Describes the product design in extreme detail (colors, logos, textures, materials)
2. Emphasizes "PRESERVE EXACT PRODUCT DESIGN - same colors, logos, textures"
3. Describes the new environment/scene
4. Allows natural repositioning of the product in the scene`
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

        if (imagesBase64) {
            imagesBase64.forEach((img: string) => {
                const mimeType = img.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
                parts.push({
                    inlineData: {
                        data: img.split(',')[1] || img,
                        mimeType: mimeType
                    }
                });
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: parts }],
            config: {
                systemInstruction,
                temperature: 0.7,
            },
        });

        const text = response.text?.trim() || input;

        return new Response(JSON.stringify({ result: text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Optimize API error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
