import { Character } from './Character.js';
import { GameEngine } from './engine.js';
import { gameState, addEventToShortTerm } from './gameState.js';
import { generateAgentDecision } from './llmService.js';

// DOM Elements
const form = document.getElementById('action-form');
const inputField = document.getElementById('player-input');
const submitBtn = document.getElementById('submit-action');
const suggestBtn = document.getElementById('btn-suggest');
const loader = document.querySelector('.loader');

// API Key Setup Elements
const btnSettings = document.getElementById('btn-settings');
const apiSetupPanel = document.getElementById('api-setup');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');

// Initialize Engine
const engine = new GameEngine();

// Create Initial Characters
const char1 = new Character("1", "Bob", "Perezoso pero amigable", "🧑‍🦱", 30, 40);
const char2 = new Character("2", "Alice", "Energética y curiosa", "👩‍🦰", 70, 60);

engine.addCharacter(char1);
engine.addCharacter(char2);

// Start the physics loop immediately
engine.start();

// --- Event Listeners ---

btnSettings.addEventListener('click', () => {
    apiSetupPanel.classList.toggle('hidden');
});

saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        gameState.apiKeys.gemini = key;
        engine.logSystemMessage("Gemini API Key configurada. La IA ahora está activa.");
        apiSetupPanel.classList.add('hidden');
    }
});

// Force Action (Direct interaction simulating player)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handlePlayerIntervention(true);
});

// Suggest Topic (Inception)
suggestBtn.addEventListener('click', async () => {
    await handlePlayerIntervention(false);
});

async function handlePlayerIntervention(isForce) {
    const selectedChar = engine.selectedCharacter;
    if (!selectedChar) return;

    const playerInput = inputField.value.trim();
    if (!playerInput) return;

    // 1. UI Updates
    inputField.disabled = true;
    submitBtn.disabled = true;
    suggestBtn.disabled = true;
    loader.classList.remove('hidden');
    inputField.value = '';
    
    const actionType = isForce ? "Forzado por Dios" : "Sugerencia del Destino";
    engine.logSystemMessage(`[${actionType}] hacia ${selectedChar.name}: "${playerInput}"`);

    try {
        // 2. Inject event into character's memory
        selectedChar.receiveEvent(`EVENTO DEL MUNDO: ${playerInput}`);

        // 3. Force an immediate cognitive tick for this character to react
        if (!gameState.apiKeys.gemini) {
            engine.showDialogBubble(selectedChar.id, "Necesito la API Key de Gemini para pensar...", 3000);
            return;
        }

        engine.showDialogBubble(selectedChar.id, "🤔 Pensando en lo que pasó...", 2000);
        const decision = await generateAgentDecision(selectedChar);
        engine.processLLMDecision(selectedChar, decision);

    } catch (error) {
        console.error("Error during interaction:", error);
        engine.logSystemMessage(`Error de sistema: Fallo en la conexión neuronal con ${selectedChar.name}. Revisa la API Key.`, 'system');
    } finally {
        inputField.disabled = false;
        submitBtn.disabled = false;
        suggestBtn.disabled = false;
        loader.classList.add('hidden');
        inputField.focus();
    }
}
