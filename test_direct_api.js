const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function runTest() {
    // 1. Load API Key
    const envPath = path.join(__dirname, '.env.local');
    let apiKey = '';

    try {
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('GEMINI_API_KEY=')) {
                    apiKey = line.split('=')[1].trim();
                    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) ||
                        (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
                        apiKey = apiKey.slice(1, -1);
                    }
                    break;
                }
            }
        }
    } catch (e) {
        console.error("Error reading .env.local:", e);
        return;
    }

    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY not found in .env.local");
        return;
    }

    console.log("API Key found. Testing 'gemini-flash-latest'...");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    try {
        const start = Date.now();
        console.log("Sending prompt: 'Hello'...");
        const result = await model.generateContent("Say 'Hello' if you can hear me.");
        const response = await result.response;
        const text = response.text();
        console.log(`[SUCCESS] Model "gemini-flash-latest" worked!`);
        console.log(`Response: ${text.trim()} (${Date.now() - start}ms)`);

        console.log("\n--- Stress Test (3 requests) ---");
        for (let i = 0; i < 3; i++) {
            const tStart = Date.now();
            await model.generateContent("Quick check " + i);
            console.log(`Request ${i + 1}: OK (${Date.now() - tStart}ms)`);
        }

    } catch (error) {
        console.error(`[FAILED] Model "gemini-flash-latest":`, error.message);
    }
}

runTest();
