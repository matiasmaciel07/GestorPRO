"use strict";

export const backup = {
    exportar(datosCompletos) {
        try {
            // FASE 1: Se exporta el JSON completo estructurado (movimientos + inflacionINDEC)
            const data = JSON.stringify(datosCompletos, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            
            const node = document.createElement('a');
            node.href = url;
            node.download = `Backup_GestorPro_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(node);
            node.click();
            
            // Limpieza de memoria
            setTimeout(() => {
                document.body.removeChild(node);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error("Error exportando backup:", error);
            throw new Error("No se pudo generar el archivo de backup.");
        }
    },
    
    importar(file, onSuccess, onError) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                let obj = JSON.parse(ev.target.result);
                
                // FASE 1: Se delega la responsabilidad de descifrar si es un backup viejo (Array)
                // o un backup nuevo (Objeto) directamente a curarDatos en el Model.
                onSuccess(obj);
            } catch (err) {
                console.error("Error importando:", err);
                onError(err);
            }
        };
        reader.onerror = () => onError(new Error("Error de lectura del archivo"));
        reader.readAsText(file);
    }
};