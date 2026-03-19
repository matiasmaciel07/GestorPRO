export const events = {
    _events: {},
    _schemas: {},

    registerSchema(eventName, schemaDefinition) {
        this._schemas[eventName] = schemaDefinition;
    },

    on(eventName, callback) {
        if (!this._events[eventName]) {
            this._events[eventName] = [];
        }
        this._events[eventName].push(callback);
    },

    off(eventName, callbackToRemove) {
        if (this._events[eventName]) {
            this._events[eventName] = this._events[eventName].filter(cb => cb !== callbackToRemove);
        }
    },

    emit(eventName, data) {
        if (this._schemas[eventName] && data !== undefined && data !== null) {
            const schema = this._schemas[eventName];
            for (const key in schema) {
                if (data.hasOwnProperty(key)) {
                    const expectedType = schema[key];
                    const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
                    
                    if (actualType !== expectedType && expectedType !== 'any') {
                        console.error(`[EventBus] Bloqueo de mutación '${eventName}': Corrupción de datos detectada. La propiedad '${key}' esperaba '${expectedType}' pero recibió '${actualType}'.`);
                        return;
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

events.registerSchema('ui:guardar-inflacion', { mes: 'string', val: 'number' });
events.registerSchema('ui:add-watchlist', { activo: 'string', precio: 'number' });
events.registerSchema('app:toast', { msg: 'string', type: 'string' });