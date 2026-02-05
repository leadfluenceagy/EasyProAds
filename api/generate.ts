import { GoogleGenAI, Part } from "@google/genai";

export const config = {
    maxDuration: 60, // 60 seconds for image generation
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { prompt, aspectRatio, referenceImages } = await req.json();

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        const parts: Part[] = [{ text: prompt }];

        // Add reference images
        if (referenceImages?.length > 0) {
            referenceImages.forEach((img: string) => {
                const mimeType = img.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
                const base64Data = img.split(',')[1] || img;
                parts.unshift({
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                });
            });
        }

        parts.push({
            text: "CRITICAL REQUIREMENTS: 1) PRESERVE EXACT PRODUCT DESIGN - same colors, logos, textures, patterns, and all visual details from reference. 2) You MAY reposition the product naturally in the scene (rotate, tilt, angle). 3) Create a stunning environment around the product. 4) Photorealistic 8K quality. 5) No text overlays. 6) No artifacts."
        });

        const modelsToTry = [
            'gemini-3-pro-image-preview',
            'gemini-2.5-flash-image'
        ];

        const maxRetriesPerModel = 2;

        for (const modelName of modelsToTry) {
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
                                break;
                            }
                        }
                    }

                    if (imageUrl) {
                        return new Response(JSON.stringify({ result: imageUrl }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }

                    throw new Error('No image in response');

                } catch (error: any) {
                    const errorMessage = error?.message || String(error);
                    const isOverloaded = errorMessage.includes('503') ||
                        errorMessage.includes('overloaded') ||
                        errorMessage.includes('UNAVAILABLE') ||
                        errorMessage.includes('Resource exhausted');

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

        throw new Error('Image generation failed: All models are currently overloaded. Please try again in a few minutes.');

    } catch (error: any) {
        console.error('Generate API error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
