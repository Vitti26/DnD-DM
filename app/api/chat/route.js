import { GoogleGenerativeAI } from "@google/generative-ai";

// Rate limiting simple en memoria por IP (para proteger la cuota de la API de Gemini)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 20;

function isRateLimited(ip) {
    const now = Date.now();
    const clientData = rateLimitMap.get(ip);

    if (!clientData || now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, startTime: now });
        return false;
    }

    if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
        return true;
    }

    clientData.count += 1;
    return false;
}

// Limpieza periódica cada 5 minutos para evitar fugas de memoria
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of rateLimitMap.entries()) {
            if (now - data.startTime > RATE_LIMIT_WINDOW_MS * 2) {
                rateLimitMap.delete(ip);
            }
        }
    }, 5 * 60 * 1000);
}

// Construye y sanea el historial para cumplir con las exigencias de Gemini:
// - Alternancia estricta entre user y model
// - Sin turnos consecutivos del mismo rol
// - Siempre debe empezar con el rol 'user'
// - No incluye el mensaje actual (ese se envía en sendMessage)
function buildGeminiHistory(historialRaw) {
    if (!Array.isArray(historialRaw) || historialRaw.length === 0) {
        return [];
    }

    // Acotamos a los últimos 20 mensajes para evitar desbordes de tokens o payload exhaustion
    const ultimosMensajes = historialRaw.slice(-20);

    const mapped = [];
    for (const m of ultimosMensajes) {
        if (!m || typeof m.texto !== 'string') continue;
        const texto = m.texto.trim();
        if (!texto) continue;
        const role = m.rol === 'dm' ? 'model' : 'user';
        // Limitamos la longitud de cada mensaje previo a 3000 caracteres
        mapped.push({ role, text: texto.slice(0, 3000) });
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
        // 1. Verificación de Origen (Defensa anti-CSRF para API pública)
        const origin = req.headers.get('origin');
        const host = req.headers.get('host');
        if (origin && host) {
            try {
                const originHost = new URL(origin).host;
                const isLocal = originHost.includes('localhost') || originHost.includes('127.0.0.1');
                const isVercel = originHost.endsWith('.vercel.app');
                const isSameHost = originHost === host;
                if (!isSameHost && !isLocal && !isVercel) {
                    return Response.json(
                        { ok: false, error: 'Acceso no autorizado por política de origen.' },
                        { status: 403 }
                    );
                }
            } catch {
                // Si la URL de origin está malformada
                return Response.json({ ok: false, error: 'Origen inválido.' }, { status: 400 });
            }
        }

        // 2. Rate Limiting por IP
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') ||
            'unknown-ip';

        if (clientIp !== 'unknown-ip' && isRateLimited(clientIp)) {
            return Response.json(
                { ok: false, error: 'Demasiadas peticiones. Por favor esperá unos segundos antes de enviar otra acción.' },
                { status: 429 }
            );
        }

        // 3. Verificación de Secrets
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json(
                { ok: false, error: 'GEMINI_API_KEY no está configurada en las variables de entorno.' },
                { status: 500 }
            );
        }

        // 4. Validación de Payload
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

        if (mensaje.length > 3000) {
            return Response.json(
                { ok: false, error: 'El mensaje es demasiado largo (máximo 3000 caracteres).' },
                { status: 400 }
            );
        }

        // Sanitización estricta contra Prompt Injection en idioma
        const idiomaSeguro = idioma === 'en' ? 'English' : 'Español (Castellano)';

        // Sanitización y tipado de jugadores (máximo 10)
        const jugadoresSeguros = (Array.isArray(jugadores) ? jugadores.slice(0, 10) : []).map(j => ({
            id: String(j?.id || '').slice(0, 50),
            nombre: String(j?.nombre || 'Aventurero').slice(0, 50),
            raza: String(j?.raza || 'Humano').slice(0, 30),
            clase: String(j?.clase || 'Guerrero').slice(0, 30),
            hp: Math.max(0, Math.min(999, Number(j?.hp) || 10)),
            hp_max: Math.max(1, Math.min(999, Number(j?.hp_max) || 10)),
            ca: Math.max(1, Math.min(50, Number(j?.ca) || 10)),
            nivel: Math.max(1, Math.min(20, Number(j?.nivel) || 1)),
            inventario: Array.isArray(j?.inventario) ? j.inventario.slice(0, 15).map(item => String(item).slice(0, 50)) : []
        }));

        const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
        const genAI = new GoogleGenerativeAI(apiKey);

        const systemPrompt = `Eres un Dungeon Master experto de D&D 5e.
Idioma obligatorio: ${idiomaSeguro}.
Jugadores actuales: ${JSON.stringify(jugadoresSeguros)}.

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
    { "id": "1", "hp": 15, "inventario": ["Espada corta", "Poción de curación"] }
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

        // Historial saneado: acotado y validado
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
        console.error("Error en endpoint /api/chat:", error?.message || error);
        const { status, userMsg } = classifyError(error);
        return Response.json(
            { ok: false, error: userMsg },
            { status }
        );
    }
}
