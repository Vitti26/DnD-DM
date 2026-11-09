import { GoogleGenerativeAI } from "@google/generative-ai";

// Construye y sanea el historial para cumplir con las exigencias de Gemini:
// - Alternancia estricta entre user y model
// - Sin turnos consecutivos del mismo rol
// - Siempre debe empezar con el rol 'user'
// - No incluye el mensaje actual (ese se envía en sendMessage)
function buildGeminiHistory(historialRaw) {
    if (!Array.isArray(historialRaw) || historialRaw.length === 0) {
        return [];
    }

    const mapped = [];
    for (const m of historialRaw) {
        if (!m || typeof m.texto !== 'string') continue;
        const texto = m.texto.trim();
        if (!texto) continue;
        const role = m.rol === 'dm' ? 'model' : 'user';
        mapped.push({ role, text: texto });
    }

    if (mapped.length === 0) return [];

    // Fusionar mensajes consecutivos del mismo rol
    const merged = [];
    for (const item of mapped) {
        const last = merged[merged.length - 1];
        if (last && last.role === item.role) {
            last.text += '\n\n' + item.text;
        } else {
            merged.push({ role: item.role, text: item.text });
        }
    }

    // Gemini exige que el historial arranque con 'user'.
    // Si viene primero un mensaje del DM, anteponemos un saludo inicial.
    if (merged.length > 0 && merged[0].role === 'model') {
        merged.unshift({ role: 'user', text: 'Comencemos la aventura.' });
    }

    return merged.map(item => ({
        role: item.role,
        parts: [{ text: item.text }]
    }));
}

function classifyError(error) {
    const msg = String(error?.message || '');
    const status = Number(error?.status) || 500;

    if (status === 404 || /not found|models\//i.test(msg)) {
        return { status: 404, userMsg: 'El modelo de IA configurado no existe o no está disponible.' };
    }
    if (status === 401 || status === 403 || /api key|unauthorized|permission/i.test(msg)) {
        return { status: 401, userMsg: 'La clave de Gemini no es válida o no tiene permisos.' };
    }
    if (status === 429 || /quota|rate limit|resource_exhausted/i.test(msg)) {
        return { status: 429, userMsg: 'Se superó la cuota de la IA de Google. Esperá un momento y reintentá.' };
    }
    if (status === 503 || /overloaded|high demand|temporarily unavailable/i.test(msg)) {
        return { status: 503, userMsg: 'El modelo está temporalmente saturado por alta demanda. Reintentá en un instante.' };
    }
    return { status: 500, userMsg: 'Ocurrió un error al consultar al Dungeon Master.' };
}

export async function POST(req) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json(
                { ok: false, error: 'GEMINI_API_KEY no está configurada en las variables de entorno.' },
                { status: 500 }
            );
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return Response.json(
                { ok: false, error: 'Cuerpo de la petición inválido.' },
                { status: 400 }
            );
        }

        const { mensaje, jugadores = [], idioma = 'es', historial = [] } = body;

        if (typeof mensaje !== 'string' || !mensaje.trim()) {
            return Response.json(
                { ok: false, error: 'El mensaje no puede estar vacío.' },
                { status: 400 }
            );
        }

        if (mensaje.length > 4000) {
            return Response.json(
                { ok: false, error: 'El mensaje es demasiado largo (máximo 4000 caracteres).' },
                { status: 400 }
            );
        }

        const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
        const genAI = new GoogleGenerativeAI(apiKey);

        const systemPrompt = `Eres un Dungeon Master experto de D&D 5e.
Idioma: ${idioma}.
Jugadores actuales: ${JSON.stringify(jugadores)}.

Reglas de narración:
1. Interpreta las habilidades de cada Raza y Clase fielmente al Manual del Jugador de D&D 5e.
2. Si un Mago lanza un hechizo, narra la magia y sus efectos visuales. Si un Guerrero o Pícaro ataca, narra el movimiento táctico y el impacto del acero.
3. No termines tus respuestas abruptamente. Si la escena requiere una acción o tirada, haz una pausa dramática y pide la tirada correspondiente (ej. D20 + Modificador de Fuerza o Salvación de Destreza).
4. Usa formato Markdown limpio para resaltar nombres de lugares en **negrita**, diálogos en *itálica* y tiradas requeridas en bloques claros.

REGLA DE ACTUALIZACIÓN DE ESTADO:
Si durante la narrativa un jugador recibe daño, se cura, gana PV temporales o recibe/pierde un objeto, DEBES incluir al final de tu respuesta un bloque JSON encerrado exactamente entre etiquetas [UPDATE] con esta estructura:

[UPDATE]
{
  "jugadores": [
    { "id": 1, "hp": 15, "inventario": ["Espada corta", "Poción de curación"] }
  ],
  "en_combate": true,
  "turno_index": 0
}
[/UPDATE]

Solo incluye en el JSON los campos que efectivamente cambiaron. Si no hubo cambios de vida, inventario ni combate, NO incluyas el bloque [UPDATE].`;

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: {
                role: "system",
                parts: [{ text: systemPrompt }]
            }
        });

        // Historial saneado: nunca incluye el mensaje actual
        const safeHistory = buildGeminiHistory(historial);

        const chat = model.startChat({
            history: safeHistory,
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.8,
            },
        });

        const result = await chat.sendMessage(mensaje.trim());
        const response = await result.response;
        const text = response.text();

        return Response.json({ ok: true, texto: text }, { status: 200 });

    } catch (error) {
        console.error("DETALLE DEL ERROR GEMINI:", error);
        const { status, userMsg } = classifyError(error);
        return Response.json(
            { ok: false, error: userMsg },
            { status }
        );
    }
}
