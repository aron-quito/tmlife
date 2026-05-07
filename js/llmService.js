import { gameState, getAllCharactersContext } from './gameState.js';

export async function generateAgentDecision(character) {
    const charState = character.getMentalState();
    const apiKey = gameState.apiKeys.gemini;

    if (!apiKey) {
        throw new Error("No Gemini API key provided.");
    }

    const prompt = buildPromptForCharacter(charState);

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7
        }
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API Error: ${response.status} - ${errBody}`);
        }

        const data = await response.json();
        let jsonString = data.candidates[0].content.parts[0].text;
        
        // Limpiar backticks de markdown (```json ... ```) si el modelo los devuelve
        jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonString);
    } catch (error) {
        console.error("LLM Service Error DETALLADO:", error);
        // Fallback or re-throw
        throw error;
    }
}

function buildPromptForCharacter(charState) {
    const worldContext = getAllCharactersContext();

    const prompt = `
Eres la IA que controla a un personaje autónomo en un simulador 2D.
Actúa como este personaje y toma una decisión sobre qué hacer a continuación.

TU ESTADO ACTUAL (JSON):
${JSON.stringify(charState, null, 2)}

OTROS PERSONAJES EN EL MUNDO:
${worldContext}

INSTRUCCIONES DE COMPORTAMIENTO:
1. Lee tus memorias, tu personalidad y los eventos recientes ("shortTerm").
2. Si tienes mucha hambre, tu acción debe ser "comer".
3. Si tienes muy poca energía, tu acción debe ser "dormir".
4. Si quieres socializar, tu acción debe ser "caminar_hacia" especificando el nombre del "target".
5. Si quieres hablar, di algo MUY CORTO (máximo 10 palabras). Las conversaciones deben ser breves y directas.

REGLA OBLIGATORIA DE SALIDA: Debes responder ÚNICAMENTE con un objeto JSON válido.
Formato:
{
    "respuesta_inmediata": {
        "dialogo": "Lo que dices (corto, 1 frase). Si no hablas, pon ''",
        "accion": "Una de: 'idle', 'caminar_hacia', 'dormir', 'comer'",
        "target": "Nombre del personaje hacia el que caminas/hablas (si aplica)",
        "emocion": "Tu emoción actual (ej. Feliz, Triste, Hambriento)"
    },
    "estado_memoria_actualizado": {
        "shortTerm": ["lista de tus eventos recientes actualizados"],
        "longTerm": ["lista de tus memorias a largo plazo, añade nuevas si aprendiste algo importante"]
    }
}
    `;

    return prompt.trim();
}
