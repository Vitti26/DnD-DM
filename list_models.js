const fs = require('fs');
const path = require('path');

async function listModels() {
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

    console.log(`Checking models with API Key starting with: ${apiKey.substring(0, 5)}...`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Details:", text);
            return;
        }

        const data = await response.json();
        const modelNames = data.models ? data.models.map(m => m.name) : [];

        const dumpPath = path.join(__dirname, 'models_list.txt');
        fs.writeFileSync(dumpPath, JSON.stringify(modelNames, null, 2));
        console.log(`Dumped ${modelNames.length} models to models_list.txt`);

    } catch (err) {
        console.error("Fetch error:", err);
    }
}

listModels();
