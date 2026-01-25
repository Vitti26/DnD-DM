import { GoogleGenerativeAI } from "@google/generative-ai";

// Forzamos la carga de la API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
    try {
        const { mensaje, jugadores, idioma, historial } = await req.json();

        // Verificación de seguridad para la API KEY
        if (!process.env.GEMINI_API_KEY) {
            return new Response(JSON.stringify({ texto: "Error: No configuraste la API KEY en el servidor." }), { status: 500 });
        }

        // Cambiamos ligeramente la forma de invocarlo para evitar el 404
        // Algunos entornos requieren especificar la versión completa
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
        });

        const systemPrompt = `Eres un Dungeon Master experto de D&D 5e. 
      Idioma: ${idioma}.
      Jugadores actuales: ${JSON.stringify(jugadores)}.
      Reglas: 
      1. Interpreta las habilidades de cada Raza y Clase fielmente al Manual del Jugador 5e.
      2. Si un Mago lanza un hechizo, narra la magia. Si un Guerrero ataca, narra el acero.
      3. No termines tus respuestas abruptamente. Si la escena es larga, haz una pausa dramática pidiendo una tirada.
      4. Usa el formato Markdown para resaltar nombres de lugares en **negrita** y diálogos en *itálica*.
      
      REGLA DE ACTUALIZACIÓN DE ESTADO:
      Si durante la narrativa un jugador recibe daño, se cura o recibe un objeto, DEBES incluir al final de tu respuesta un bloque JSON encerrado entre etiquetas [UPDATE] de la siguiente forma:

      [UPDATE]
      {
        "jugadores": [
          { "id": 1, "hp": 15, "inventario": ["Espada", "Poción"] }
        ]
      }
      [/UPDATE]

      Solo incluye en el JSON los campos que cambiaron. Si no hubo cambios, no incluyas el bloque.`;

        // Re-formateamos el historial para asegurarnos de que no haya basura
        const safeHistory = (historial || []).map(m => ({
            role: m.rol === 'dm' ? 'model' : 'user',
            parts: [{ text: m.texto }],
        }));

        const chat = model.startChat({
            history: safeHistory,
            generationConfig: {
                maxOutputTokens: 8192, // Aumentado para evitar respuestas cortadas
                temperature: 0.8, // Mayor creatividad
            },
        });

        // IMPORTANTE: Aquí mandamos el mensaje con las instrucciones de sistema embebidas
        // si el modelo por alguna razón ignora el systemInstruction inicial.
        const promptFinal = `[System: ${systemPrompt}]\n\nUsuario dice: ${mensaje}`;

        const result = await chat.sendMessage(promptFinal);
        const response = await result.response;
        const text = response.text();

        return new Response(JSON.stringify({ texto: text }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("DETALLE DEL ERROR:", error);
        // Esto nos devolverá el error real de Google al frontend para que lo veas
        return new Response(JSON.stringify({
            texto: "Error de la API de Google: " + error.message
        }), { status: 500 });
    }
}