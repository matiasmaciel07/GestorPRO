"use strict";
import { events } from './events.js';

export class AppError extends Error {
    /**
     * @param {string} message - Mensaje amigable para el usuario.
     * @param {string} type - Categoría del error (NETWORK, DATA, VALIDATION).
     * @param {Error} [originalError] - Error nativo de JS capturado.
     */
    constructor(message, type = 'APP_ERROR', originalError = null) {
        super(message);
        this.type = type;
        this.originalError = originalError;
        this.name = 'AppError';
    }
}

export const ErrorHandler = {
    handle(error) {
        // 1. Log para el desarrollador (se puede enviar a Sentry/Datadog a futuro)
        console.error(`[${error.type || 'UNKNOWN_ERROR'}]`, error.message, error.originalError || '');
        
        // 2. Feedback amigable para el usuario
        events.emit('app:toast', { 
            msg: error.message || "Ocurrió un error inesperado", 
            type: "error" 
        });
    },

    /**
     * FASE 2: Boundary Catcher
     * Envuelve la ejecución de una función render o lógica visual en un entorno seguro.
     * @param {string} contextName - Nombre del componente que está fallando (ej: 'Gráfico Evolución')
     * @param {HTMLElement|string} fallbackDOM - Elemento del DOM o ID donde pintar el error visual
     * @param {Function} executionBlock - El bloque de código a ejecutar (renderizado)
     */
    catchBoundary(contextName, fallbackDOM, executionBlock) {
        try {
            // Intenta ejecutar el renderizado normal
            executionBlock();
        } catch (error) {
            // Registramos el fallo usando la estructura nativa pero sin invocar el toast molesto
            console.error(`[Boundary Catcher] 🛡️ Fallo contenido en '${contextName}':`, error);
            
            const container = typeof fallbackDOM === 'string' 
                ? document.getElementById(fallbackDOM) 
                : fallbackDOM;

            if (container) {
                // Renderiza un estado de error suave sin romper el grid CSS ni la UI general
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:120px; width:100%; padding: 20px; text-align:center; color: var(--text-muted); background: rgba(255, 0, 92, 0.03); border: 1px dashed rgba(255, 0, 92, 0.2); border-radius: 8px;">
                        <svg width="24" height="24" style="margin-bottom:8px; opacity:0.6; fill: var(--color-down);">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--color-down);">Módulo Protegido</span>
                        <span style="font-size: 0.75rem; margin-top: 4px; opacity:0.8;">Fallo aislado en ${contextName}</span>
                    </div>
                `;
            }
        }
    }
};