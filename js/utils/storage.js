"use strict";

const DB_NAME = 'GestorProDB';
const STORE_NAME = 'keyval';
const KEY_STORE = 'crypto_keys';
const DB_VERSION = 2; // Soporte almacenamiento de llaves y cursores

function getDB() {
    return new Promise((resolve, reject) => {
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
        
        // CORRECCIÓN: Prevención de Deadlock si la DB está bloqueada por otra pestaña abierta
        request.onblocked = () => {
            console.error("[Storage] IndexedDB bloqueada por otra instancia/pestaña.");
            reject(new Error('IDB_BLOCKED'));
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Motor Criptográfico AES-256-GCM
async function getOrCreateKey() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(KEY_STORE, 'readwrite');
        const store = tx.objectStore(KEY_STORE);
        
        // Uso de cursor para buscar la llave criptográfica (Preparación para multi-keys)
        const request = store.openCursor();
        let keyFound = false;
        
        request.onsuccess = async (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (cursor.key === 'aes_master_key') {
                    keyFound = true;
                    resolve(cursor.value);
                } else {
                    cursor.continue();
                }
            } else if (!keyFound) {
                try {
                    const key = await crypto.subtle.generateKey(
                        { name: "AES-GCM", length: 256 },
                        false, // No exportable por seguridad
                        ["encrypt", "decrypt"]
                    );
                    
                    const writeTx = db.transaction(KEY_STORE, 'readwrite');
                    writeTx.objectStore(KEY_STORE).put(key, 'aes_master_key');
                    resolve(key);
                } catch (err) {
                    reject(err);
                }
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function encryptPayload(data) {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
    
    return {
        isEncrypted: true,
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
    };
}

async function decryptPayload(payload) {
    if (!payload || !payload.isEncrypted) return payload; // Retrocompatibilidad
    const key = await getOrCreateKey();
    const iv = new Uint8Array(payload.iv);
    const data = new Uint8Array(payload.data);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
}

export const storage = {
    async get(keyToFind) {
        try {
            const db = await getDB();
            const payload = await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                
                // Implementación de Lectura Progresiva mediante Cursores (Fase 4)
                const request = store.openCursor();
                let foundValue = null;
                
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.key === keyToFind) {
                            foundValue = cursor.value;
                            resolve(foundValue !== undefined ? foundValue : null);
                        } else {
                            cursor.continue(); // Mueve el cursor al siguiente registro progresivamente
                        }
                    } else {
                        // Fin del cursor, clave no encontrada
                        if (!foundValue) resolve(null);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
            
            if (payload && payload.isEncrypted) {
                return await decryptPayload(payload);
            }
            return payload;
        } catch (e) {
            console.error(`Error leyendo/desencriptando ${keyToFind}`, e);
            return null;
        }
    },
    
    async set(key, value) {
        try {
            // Arrays u objetos pesados se encriptan. Configuraciones menores pueden ir en texto plano.
            let finalValue = value;
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
            console.error(`Error encriptando/guardando ${key}`, e);
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
            console.error(`Error borrando ${key}`, e);
        }
    },
    
    async clearAll() {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                // Iniciamos una única transacción maestra
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                
                // Vaciado absoluto y optimizado de toda la base de datos
                store.clear(); 
                
                // CRÍTICO: Esperamos a que la transacción se confirme en el disco duro
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.error("Error crítico al formatear la Base de Datos", e);
        }
    }}