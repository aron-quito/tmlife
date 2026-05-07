/**
 * gameState.js
 * Almacena el estado global de todos los agentes. Esta es la "fuente de la verdad"
 * que se envía al LLM para que tome decisiones y actualice las memorias.
 */

export const gameState = {
    characters: {}, // map of id -> character data
    
    // Config global
    apiKeys: {
        gemini: "AIzaSyCPyLHuH1kMw2qbEk6pHCpObdboySpUiQ8" // Hardcoded a petición del usuario
    }
};

export function registerCharacterState(id, name, archetype, emoji) {
    gameState.characters[id] = {
        id,
        name,
        archetype,
        emoji,
        // The LLM manages this:
        memory: {
            shortTerm: [], // Últimos 5 eventos/interacciones
            longTerm: [
                `Eres ${name}.`,
                `Tu personalidad es: ${archetype}.`,
                "Estás en un mundo 2D con otros personajes."
            ]
        },
        currentEmotion: "Neutral 😐",
        currentAction: "Idle",
        // Position targets (LLM can decide to walk towards something)
        targetId: null // ID of character to walk to, or null if wandering
    };
}

export function updateCharacterMemory(id, newMemoryState) {
    if (gameState.characters[id]) {
        if (newMemoryState.shortTerm) gameState.characters[id].memory.shortTerm = newMemoryState.shortTerm;
        if (newMemoryState.longTerm) gameState.characters[id].memory.longTerm = newMemoryState.longTerm;
    }
}

export function addEventToShortTerm(id, eventString) {
    const charState = gameState.characters[id];
    if (!charState) return;
    
    charState.memory.shortTerm.push(eventString);
    if (charState.memory.shortTerm.length > 5) {
        charState.memory.shortTerm.shift(); // keep only last 5
    }
}

export function getCharacterState(id) {
    return gameState.characters[id];
}

export function getAllCharactersContext() {
    // Return a summarized view of who is in the world for the LLM to know
    return Object.values(gameState.characters).map(c => 
        `ID: ${c.id} | Nombre: ${c.name} | Emoción actual: ${c.currentEmotion} | Acción: ${c.currentAction}`
    ).join("\\n");
}
