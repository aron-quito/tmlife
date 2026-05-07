import { registerCharacterState, getCharacterState, addEventToShortTerm } from './gameState.js';

export class Character {
    constructor(id, name, archetype, emoji, x, y) {
        this.id = id;
        this.name = name;
        this.archetype = archetype;
        this.emoji = emoji;
        
        // Coordinates for rendering in 2D space (0-100% relative to container)
        this.x = x || Math.floor(Math.random() * 80) + 10;
        this.y = y || Math.floor(Math.random() * 80) + 10;
        
        // Target Coordinates for smooth movement
        this.targetX = this.x;
        this.targetY = this.y;
        this.speed = 0.5; // Movement speed per engine tick
        
        // Physical Stats
        this.stats = {
            energy: 100, // 0 to 100
            hunger: 0    // 0 to 100 (0 is full, 100 is starving)
        };
        
        // Register this character in the central state
        registerCharacterState(this.id, this.name, this.archetype, this.emoji);

        // DOM Element Reference
        this.element = null;
    }

    // Called by the Engine's GameLoop periodically
    updatePhysics() {
        // Drain energy slowly, increases hunger
        if (Math.random() > 0.5) {
            this.stats.energy = Math.max(0, this.stats.energy - 0.2);
        }
        if (Math.random() > 0.5) {
            this.stats.hunger = Math.min(100, this.stats.hunger + 0.2);
        }

        // Handle Movement towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.5) {
            // Move fraction towards target
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    // Proxy to get mental state from global state
    getMentalState() {
        return getCharacterState(this.id);
    }

    // When a direct player interaction happens (or engine forces an event)
    receiveEvent(eventString) {
        addEventToShortTerm(this.id, eventString);
    }
}
