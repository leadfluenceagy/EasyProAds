import { GoogleGenAI, Part } from "@google/genai";

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

export const config = {
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
        const { action, userPrompt, imageBase64, maskBase64, optimizedPrompt, aspectRatio } = await req.json();

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Action: optimize - optimize the editor prompt
        if (action === 'optimize') {
            const parts: Part[] = [];

            const imageMimeType = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png';
            parts.push({
                inlineData: {
                    data: imageBase64.split(',')[1] || imageBase64,
                    mimeType: imageMimeType
                }
            });

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

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: parts }],
                config: {
                    systemInstruction: EDITOR_PROMPT,
                    temperature: 0.3,
                },
            });

            const result = response.text?.trim() || userPrompt;
            return new Response(JSON.stringify({ result }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Action: generate - generate the edited image
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
                { text: "CRITICAL: Apply the edit to this exact image. Preserve all unmentioned elements exactly. Photorealistic quality. No artifacts." }
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

            throw new Error('Editor image generation failed. Please try again.');
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Editor API error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
