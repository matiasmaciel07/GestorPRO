"use strict";
import { storage } from './storage.js';

const CURRENT_DB_VERSION = 9;

export const MigrationManager = {
    /**
     * Orquesta la migración secuencial de datos locales.
     * @returns {Promise<Array>} Array de movimientos actualizados a la última versión.
     */
    async runMigrations() {
        let storedVersion = await storage.get('gfp_db_version') || 7;
        let data = [];
        
        if (storedVersion <= 7) {
            data = await storage.get('gfp_movimientos_v7') || await storage.get('gfp_movimientos') || [];
        } else if (storedVersion === 8) {
            data = await storage.get('gestor_pro_v8') || [];
        } else {
            data = await storage.get('gestor_pro_v9') || [];
        }

        switch (storedVersion) {
            case 7:
                data = this._migrateV7toV8(data);
            case 8:
                data = this._migrateV8toV9(data);
        }

        if (storedVersion < CURRENT_DB_VERSION) {
            await storage.set('gfp_db_version', CURRENT_DB_VERSION);
            await storage.set('gestor_pro_v9', data);
            
            await storage.remove('gfp_movimientos');
            await storage.remove('gfp_movimientos_v7');
            await storage.remove('gestor_pro_v8');
        }

        return data;
    },

    _migrateV7toV8(data) {
        return data.map(m => {
            let curado = { ...m };
            if (curado.montoARS !== undefined) { curado.monto = curado.montoARS; delete curado.montoARS; }
            if (curado.usdNominal !== undefined) { curado.usd = curado.usdNominal; delete curado.usdNominal; }
            if (curado.resultado !== undefined) { curado.resultadoCalculado = curado.resultado; delete curado.resultado; }
            curado.monto = parseFloat(curado.monto) || 0; 
            return curado;
        });
    },

    _migrateV8toV9(data) {
        return data.map(m => {
            let curado = { ...m };
            if (curado.activo) curado.activo = curado.activo.trim().toUpperCase();
            if (curado.tipo === 'Compra' && !curado.sector) curado.sector = 'Otro';
            return curado;
        });
    }
};