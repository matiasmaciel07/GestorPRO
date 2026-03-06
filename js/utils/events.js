"use strict";

export const events = {
    _events: {},
    _schemas: {}, // FASE 2: Almacén de esquemas para validación de tipado dinámico

    // Permite registrar un esquema de validación para un evento específico
    registerSchema(eventName, schemaDefinition) {
        this._schemas[eventName] = schemaDefinition;
    },

    on(eventName, callback) {
        if (!this._events[eventName]) {
            this._events[eventName] = [];
        }
        this._events[eventName].push(callback);
    },

    emit(eventName, data) {
        // FASE 2: Validación de esquemas (Tipado Dinámico)
        if (this._schemas[eventName] && data !== undefined && data !== null) {
            const schema = this._schemas[eventName];
            for (const key in schema) {
                if (data.hasOwnProperty(key)) {
                    const expectedType = schema[key];
                    const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
                    
                    if (actualType !== expectedType && expectedType !== 'any') {
                        console.error(`[EventBus] 🛑 Evento bloqueado '${eventName}': Corrupción de datos. La propiedad '${key}' esperaba '${expectedType}' pero recibió '${actualType}'.`);
                        return; // Aborta la emisión para proteger la inmutabilidad de la vista
                    }
                }
            }
        }

        if (this._events[eventName]) {
            this._events[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error aislado ejecutando callback para '${eventName}':`, error);
                }
            });
        }
    }
};

// --- Registro de esquemas críticos para el sistema ---
events.registerSchema('ui:guardar-inflacion', { mes: 'string', val: 'number' });
events.registerSchema('ui:add-watchlist', { activo: 'string', precio: 'number' });
events.registerSchema('app:toast', { msg: 'string', type: 'string' });