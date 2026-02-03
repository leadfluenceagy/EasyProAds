// Diagnostic script to test Gemini API image generation
import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyC5FcaUCE93Hg6YIgQGrFzPVBkDqoY8wEY';

async function testModels() {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const modelsToTest = [
        'gemini-3-pro-image-preview',
        'gemini-2.5-flash-image',
        'gemini-2.0-flash-exp'
    ];

    console.log('🔍 Starting Gemini API diagnostics...\n');
    console.log('='.repeat(60));

    for (const modelName of modelsToTest) {
        console.log(`\n📡 Testing model: ${modelName}`);
        console.log('-'.repeat(40));

        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: 'Generate a simple red boxing glove on a white background. Photorealistic.',
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: {
                        aspectRatio: '1:1',
                        imageSize: modelName === 'gemini-3-pro-image-preview' ? '1K' : undefined
                    },
                },
            });

            console.log('✅ API call successful!');
            console.log(`📦 Response candidates: ${response.candidates?.length || 0}`);

            // Check if we got an image
            let hasImage = false;
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        hasImage = true;
                        console.log(`🎉 Image generated! Size: ${part.inlineData.data.length} bytes`);
                        break;
                    }
                    if (part.text) {
                        console.log(`📝 Text response: ${part.text.substring(0, 100)}...`);
                    }
                }
            }

            if (!hasImage) {
                console.log('⚠️  No image in response');
            }

        } catch (error) {
            console.log(`❌ Error: ${error.message || error}`);

            // Parse error details
            if (error.message) {
                if (error.message.includes('503')) {
                    console.log('   → Model is OVERLOADED (too many requests)');
                } else if (error.message.includes('404')) {
                    console.log('   → Model NOT FOUND (wrong name or not available)');
                } else if (error.message.includes('400')) {
                    console.log('   → BAD REQUEST (configuration error)');
                } else if (error.message.includes('403')) {
                    console.log('   → FORBIDDEN (API key issue or model not enabled)');
                } else if (error.message.includes('429')) {
                    console.log('   → RATE LIMITED (too many requests from this key)');
                }
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Diagnostics complete!\n');
}

// Also list available models
async function listAvailableModels() {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    console.log('\n📋 Fetching available models...\n');

    try {
        const models = await ai.models.list();

        console.log('Available image generation models:');
        for await (const model of models) {
            if (model.name.includes('image') || model.name.includes('imagen')) {
                console.log(`  - ${model.name}`);
            }
        }
    } catch (error) {
        console.log('Could not list models:', error.message);
    }
}

// Run diagnostics
console.log('\n🚀 GEMINI API DIAGNOSTIC TOOL\n');
console.log('API Key:', API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 4));
console.log('Timestamp:', new Date().toISOString());
console.log('');

listAvailableModels()
    .then(() => testModels())
    .catch(err => console.error('Fatal error:', err));
