
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Manually load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.local");
}

async function listModels() {
    if (!apiKey) {
        console.error("Error: VITE_API_KEY not found in .env.local");
        return;
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        console.log("Fetching available models...");
        const response = await ai.models.list();

        console.log("\n--- AVAILABLE MODELS ---");
        for await (const model of response) {
            console.log(`- ${model.name}`);
            // console.log(`  Display Name: ${model.displayName}`); // displayName might not be on all objects
            // console.log(`  Supported Actions: ${model.supportedGenerationMethods?.join(', ')}`);
        }
    } catch (error) {
        console.error("Error listing models:", JSON.stringify(error, null, 2));
    }
}

listModels();
