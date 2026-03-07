"use strict";

const DB_NAME = 'GestorProDB';
const STORE_NAME = 'keyval';
const KEY_STORE = 'crypto_keys';
const DB_VERSION = 2; 

// Patrón Singleton para evitar colisiones de conexión y múltiples instancias
let dbPromise = null;
let keyPromise = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
                if (!db.objectStoreNames.contains(KEY_STORE)) {
                    db.createObjectStore(KEY_STORE);
                }
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                dbPromise = null; // Liberar para permitir reintentos
                reject(request.error);
            };
        });
    }
    return dbPromise;
}

// Patrón Singleton para aislar y blindar la creación/lectura de la Llave Maestra (AES-256-GCM)
function getOrCreateKey() {
    if (!keyPromise) {
        keyPromise = (async () => {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(KEY_STORE, 'readonly');
                const store = tx.objectStore(KEY_STORE);
                const request = store.get('aes_master_key');
                
                request.onsuccess = async (e) => {
                    if (e.target.result) {
                        resolve(e.target.result);
                    } else {
                        // Generación asíncrona segura si no existe llave previa
                        try {
                            const key = await crypto.subtle.generateKey(
                                { name: "AES-GCM", length: 256 },
                                false, // No exportable para garantizar integridad del entorno
                                ["encrypt", "decrypt"]
                            );
                            
                            const writeTx = db.transaction(KEY_STORE, 'readwrite');
                            const writeReq = writeTx.objectStore(KEY_STORE).put(key, 'aes_master_key');
                            
                            writeReq.onsuccess = () => resolve(key);
                            writeReq.onerror = () => {
                                keyPromise = null;
                                reject(writeReq.error);
                            };
                        } catch (err) {
                            keyPromise = null;
                            reject(err);
                        }
                    }
                };
                request.onerror = () => {
                    keyPromise = null;
                    reject(request.error);
                };
            });
        })();
    }
    return keyPromise;
}

async function encryptPayload(data) {
    try {
        const key = await getOrCreateKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
        
        return {
            isEncrypted: true,
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };
    } catch (error) {
        console.error("[Auditoría Criptográfica] Fallo en el empaquetado de cifrado:", error);
        throw error;
    }
}

async function decryptPayload(payload) {
    if (!payload || !payload.isEncrypted) return payload; // Retorno en plano (Retrocompatibilidad o configuraciones menores)
    
    try {
        const key = await getOrCreateKey();
        const iv = new Uint8Array(payload.iv);
        const data = new Uint8Array(payload.data);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (error) {
        console.error("[Auditoría Criptográfica] Error de descifrado. Corrupción de llave o adulteración de bloque:", error);
        return null; // Prevención de crash total del sistema
    }
}

export const storage = {
    async get(keyToFind) {
        try {
            const db = await getDB();
            const payload = await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                
                // Acceso indexado directo, abandonando el barrido iterativo por cursor
                const request = store.get(keyToFind);
                request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
                request.onerror = () => reject(request.error);
            });
            
            if (payload && payload.isEncrypted) {
                return await decryptPayload(payload);
            }
            return payload;
        } catch (e) {
            console.error(`[Data Storage] Error en lectura del bloque de datos: ${keyToFind}`, e);
            return null;
        }
    },
    
    async set(key, value) {
        try {
            let finalValue = value;
            // Encriptación selectiva orientada a datos críticos o estructuras mayores
            if (key === 'gestor_pro_v9' || key.includes('gfp_')) {
                finalValue = await encryptPayload(value);
            }

            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(finalValue, key);
                
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error(`[Data Storage] Falla al consolidar persistencia en bloque: ${key}`, e);
        }
    },
    
    async remove(key) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(key);
                
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error(`[Data Storage] Error al ejecutar purga en bloque: ${key}`, e);
        }
    },
    
    async clearAll() {
        await this.remove('gestor_pro_v9');
        await this.remove('gestor_pin');
        await this.remove('gfp_precios_cache');
        await this.remove('gfp_inflacion');
        await this.remove('gfp_proveedores');
        await this.remove('gfp_categorias');
        await this.remove('gfp_watchlist');
    }
};