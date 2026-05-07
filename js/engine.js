import { generateAgentDecision } from './llmService.js';
import { gameState, getCharacterState, updateCharacterMemory, addEventToShortTerm } from './gameState.js';

export class GameEngine {
    constructor() {
        this.characters = [];
        this.selectedCharacter = null;
        this.physicsTickRate = 100; // 10 ticks per second for smooth movement
        this.cognitiveTickRate = 10000; // Every 10 seconds an agent might think
        this.physicsIntervalId = null;
        this.cognitiveIntervalId = null;
        this.onCharacterSelected = null; // Callback for UI
        this.isProcessingCognitive = false;
    }

    addCharacter(character) {
        this.characters.push(character);
        this.renderCharacterInWorld(character);
    }

    start() {
        if (this.physicsIntervalId) return;
        
        // Fast loop for movement and physical stats
        this.physicsIntervalId = setInterval(() => this.physicsTick(), this.physicsTickRate);
        
        // Slow loop for LLM decisions
        this.cognitiveIntervalId = setInterval(() => this.cognitiveTick(), this.cognitiveTickRate);
        
        this.logSystemMessage("Simulation Engine started. Autonomous agents active.");
    }

    stop() {
        if (this.physicsIntervalId) {
            clearInterval(this.physicsIntervalId);
            clearInterval(this.cognitiveIntervalId);
            this.physicsIntervalId = null;
            this.cognitiveIntervalId = null;
            this.logSystemMessage("Simulation Engine stopped.");
        }
    }

    physicsTick() {
        // Update physics/biology for all entities
        this.characters.forEach(char => {
            char.updatePhysics();
            
            // Update visual DOM element position
            if (char.element) {
                char.element.style.left = `${char.x}%`;
                char.element.style.top = `${char.y}%`;
            }
        });

        // Update UI for the currently selected character
        if (this.selectedCharacter) {
            this.updatePlayerConsole(this.selectedCharacter);
        }
    }

    async cognitiveTick() {
        // Prevent concurrent overlapping API calls to save rate limits
        if (this.isProcessingCognitive) return;
        if (!gameState.apiKeys.gemini) return; // Wait until API key is set

        this.isProcessingCognitive = true;

        try {
            // Pick a random character to make a decision
            const activeChar = this.characters[Math.floor(Math.random() * this.characters.length)];
            const state = activeChar.getMentalState();

            // Only make a decision if they are idle or just wandering
            if (state.currentAction === "Idle" || Math.random() > 0.5) {
                // Call LLM
                this.showDialogBubble(activeChar.id, "🤔 Pensando...", 2000);
                const decision = await generateAgentDecision(activeChar);
                
                this.processLLMDecision(activeChar, decision);
            }
        } catch (error) {
            console.error("Cognitive Error:", error);
        } finally {
            this.isProcessingCognitive = false;
        }
    }

    processLLMDecision(character, llmJSON) {
        const charState = character.getMentalState();
        
        // 1. Update Memory
        if (llmJSON.estado_memoria_actualizado) {
            updateCharacterMemory(character.id, llmJSON.estado_memoria_actualizado);
        }

        const accion = llmJSON.respuesta_inmediata.accion;
        const dialogo = llmJSON.respuesta_inmediata.dialogo;
        charState.currentEmotion = llmJSON.respuesta_inmediata.emocion || charState.currentEmotion;
        charState.currentAction = accion;

        let logAction = "";

        // 2. Handle specific actions
        if (accion.includes("caminar_hacia")) {
            const targetName = llmJSON.respuesta_inmediata.target;
            const targetChar = this.characters.find(c => c.name.toLowerCase() === (targetName || "").toLowerCase());
            
            if (targetChar) {
                // Walk towards another character
                character.targetX = targetChar.x + (Math.random() * 10 - 5);
                character.targetY = targetChar.y + (Math.random() * 10 - 5);
                logAction = `Caminando hacia ${targetName}`;
            } else {
                // Wander randomly
                character.targetX = Math.max(10, Math.min(90, character.x + (Math.random() * 40 - 20)));
                character.targetY = Math.max(10, Math.min(90, character.y + (Math.random() * 40 - 20)));
                logAction = "Deambulando...";
            }
        } else if (accion === "dormir") {
            character.stats.energy = Math.min(100, character.stats.energy + 50);
            logAction = "Durmiendo...";
        } else if (accion === "comer") {
            character.stats.hunger = Math.max(0, character.stats.hunger - 50);
            logAction = "Comiendo...";
        }

        // 3. Handle dialogue
        if (dialogo && dialogo.trim() !== "" && dialogo.toLowerCase() !== "ninguno") {
            this.showDialogBubble(character.id, dialogo, 6000);
            
            // If they are talking to a target, add it to the target's memory
            const targetName = llmJSON.respuesta_inmediata.target;
            const targetChar = this.characters.find(c => c.name.toLowerCase() === (targetName || "").toLowerCase());
            if (targetChar) {
                addEventToShortTerm(targetChar.id, `${character.name} me dijo: "${dialogo}"`);
            }
        }

        this.logSystemMessage(`${character.name}: [${charState.currentEmotion}] ${logAction} - "${dialogo}"`, 'agent');

        // Force UI update
        if (this.selectedCharacter && this.selectedCharacter.id === character.id) {
            this.updatePlayerConsole(this.selectedCharacter);
        }
    }

    // --- RENDERING & UI ---

    renderCharacterInWorld(character) {
        const container = document.getElementById('characters-container');
        
        const entityDiv = document.createElement('div');
        entityDiv.className = 'character-entity';
        entityDiv.style.left = `${character.x}%`;
        entityDiv.style.top = `${character.y}%`;
        entityDiv.id = `char-${character.id}`;

        const emojiDiv = document.createElement('div');
        emojiDiv.className = 'char-emoji';
        emojiDiv.textContent = character.emoji;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'char-label';
        labelDiv.textContent = character.name;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'dialog-bubble';
        bubbleDiv.id = `bubble-${character.id}`;

        entityDiv.appendChild(bubbleDiv);
        entityDiv.appendChild(emojiDiv);
        entityDiv.appendChild(labelDiv);

        entityDiv.addEventListener('click', () => {
            this.selectCharacter(character, entityDiv);
        });

        character.element = entityDiv;
        container.appendChild(entityDiv);
    }

    selectCharacter(character, domElement) {
        // Deselect previous
        document.querySelectorAll('.character-entity').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new
        domElement.classList.add('selected');
        this.selectedCharacter = character;
        
        // Show panel, hide empty state
        document.getElementById('character-info').classList.remove('hidden');
        document.getElementById('api-setup').classList.add('hidden'); // hide api setup if selecting
        document.getElementById('no-selection-msg').classList.add('hidden');
        
        // Enable interaction form
        document.getElementById('player-input').disabled = false;
        document.getElementById('submit-action').disabled = false;
        document.getElementById('btn-suggest').disabled = false;

        this.updatePlayerConsole(character);
        
        if (this.onCharacterSelected) {
            this.onCharacterSelected(character);
        }
    }

    updatePlayerConsole(character) {
        const mentalState = character.getMentalState();

        // Update header info
        document.getElementById('char-avatar').textContent = character.emoji;
        document.getElementById('char-name').textContent = character.name;
        document.getElementById('char-archetype').textContent = character.archetype;
        document.getElementById('char-emotion').textContent = mentalState.currentEmotion;

        // Update stats
        const energyBar = document.getElementById('stat-energy');
        energyBar.style.width = `${character.stats.energy}%`;
        energyBar.style.backgroundColor = character.stats.energy < 20 ? 'var(--danger)' : 'var(--primary)';

        const hungerBar = document.getElementById('stat-hunger');
        hungerBar.style.width = `${character.stats.hunger}%`;
        hungerBar.style.backgroundColor = character.stats.hunger > 80 ? 'var(--danger)' : 'var(--primary)';

        // Update memory display
        const shortMemText = mentalState.memory.shortTerm.length > 0 
            ? mentalState.memory.shortTerm.join('<br>') 
            : "...";
        document.getElementById('short-term-memory').innerHTML = shortMemText;
    }

    showDialogBubble(characterId, text, duration = 4000) {
        const bubble = document.getElementById(`bubble-${characterId}`);
        if (bubble) {
            bubble.textContent = text;
            bubble.classList.add('show');
            
            // Clear existing timeout if present
            if (bubble.timeoutId) {
                clearTimeout(bubble.timeoutId);
            }
            
            bubble.timeoutId = setTimeout(() => {
                bubble.classList.remove('show');
            }, duration);
        }
    }

    logSystemMessage(msg, type = 'system') {
        const logContainer = document.getElementById('interaction-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = type === 'system' ? `[${new Date().toLocaleTimeString()}] ${msg}` : msg;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}
