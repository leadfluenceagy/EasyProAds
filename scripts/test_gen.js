
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_API_KEY=(.*)/);
    if (match) apiKey = match[1].trim();
} catch (e) { }

async function testWithModel(modelName) {
    if (!apiKey) return;
    const ai = new GoogleGenAI({ apiKey });

    console.log(`\nTesting ${modelName}...`);
    try {
        const resultPromise = ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: "Describe a red apple." }] }],
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout (5s)")), 5000)
        );

        const response = await Promise.race([resultPromise, timeoutPromise]);

        console.log("Success!");
        // Check text access
        // @ts-ignore
        if (typeof response.text === 'function') console.log("Text:", response.text());
        // @ts-ignore
        else console.log("Text (prop):", response.text);

    } catch (e) {
        console.error(`Error with ${modelName}:`, e.message);
    }
}

async function run() {
    await testWithModel('gemini-3-flash-preview');
    await testWithModel('gemini-3-pro-preview');
}

run();
