import { GoogleGenAI, Part } from "@google/genai";

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

export const config = {
    runtime: 'edge',
    regions: ['iad1'],
    maxDuration: 60,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { action, imageBase64, sourceFormat, optimizedPrompt, targetFormat } = await req.json();

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Action: optimize - optimize the format prompt
        if (action === 'optimize') {
            const targetFmt = sourceFormat === '9:16' ? '1:1' : '9:16';
            const imageMimeType = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
            const parts: Part[] = [
                {
                    inlineData: {
                        data: imageBase64.split(',')[1] || imageBase64,
                        mimeType: imageMimeType
                    }
                },
                {
                    text: `Esta imagen está en formato ${sourceFormat}. Genera el prompt para expandirla a formato ${targetFmt}.`
                }
            ];

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: parts }],
                config: {
                    systemInstruction: FORMAT_PROMPT,
                    temperature: 0.3,
                },
            });

            const result = response.text?.trim() || `Expand this image from ${sourceFormat} to ${targetFmt}. Keep the original content centered and unchanged.`;
            return new Response(JSON.stringify({ result }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Action: generate - generate the reformatted image
        if (action === 'generate') {
            const imageMimeType = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
            const parts: Part[] = [
                {
                    inlineData: {
                        data: imageBase64.split(',')[1] || imageBase64,
                        mimeType: imageMimeType
                    }
                },
                { text: optimizedPrompt },
                { text: "CRITICAL: Expand the canvas while keeping the ORIGINAL IMAGE CONTENT EXACTLY in the center. The new areas must blend seamlessly. Do not modify, crop, or alter the original subject in any way." }
            ];

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
                            errorMessage.includes('UNAVAILABLE');

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
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Format API error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
