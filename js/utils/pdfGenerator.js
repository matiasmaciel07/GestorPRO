"use strict";

export const PDFGenerator = {
    /**
     * Genera y descarga un archivo PDF profesional del Libro Mayor o Estado de Proveedores.
     * @param {Array} movimientos - Lista de transacciones.
     * @param {Object} filtros - Filtros aplicados (temporalidad y tipo).
     * @param {Object} statsGlobales - Métricas globales del modelo (necesario para proveedores).
     */
    exportarLibroMayor(movimientos, filtros, statsGlobales) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error("Las librerías jsPDF no están cargadas.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. MEMBRETE / ENCABEZADO
        doc.setFillColor(30, 41, 59); // Color corporativo Slate 800
        doc.rect(0, 0, pageWidth, 28, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE FINANCIERO", 14, 18);

        // 2. METADATOS Y FILTROS APLICADOS
        doc.setTextColor(51, 65, 85); // Slate 700
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        const fechaGeneracion = new Date().toLocaleDateString('es-AR', { 
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        
        doc.text(`Fecha de Emisión: ${fechaGeneracion}`, 14, 38);
        doc.text(`Filtro Temporal: ${filtros.temporalidad}`, 14, 44);
        doc.text(`Filtro de Transacción: ${filtros.tipo}`, 14, 50);

        const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

        // =========================================================================
        // BIFURCACIÓN LÓGICA: REPORTE DE DEUDAS A PROVEEDORES
        // =========================================================================
        if (filtros.tipo === "Deuda Proveedores") {
            const tableColumn = ["Proveedor", "Estado", "Capital Servido", "Total Exigible", "Deuda Pendiente Neta"];
            const tableRows = [];
            let totalDeuda = 0;
            let totalPagado = 0;

            const deudas = statsGlobales?.deudaProveedoresDetalle || {};
            
            // Ordenamiento: Deudas activas arriba (más recientes primero), luego Saldadas (más recientes primero)
            const dArray = Object.values(deudas).sort((a, b) => {
                if (a.activo && !b.activo) return -1;
                if (!a.activo && b.activo) return 1;
                return b.fecha.localeCompare(a.fecha);
            });

            dArray.forEach(d => {
                let pendiente = Math.max(0, d.capitalExigibleTotal - d.capitalServido);
                if (d.activo) {
                    totalDeuda += pendiente;
                }
                totalPagado += d.capitalServido;
                let estadoStr = d.activo ? "Pendiente" : "Saldado";
                tableRows.push([d.proveedor, estadoStr, formatCurrency(d.capitalServido), formatCurrency(d.capitalExigibleTotal), formatCurrency(pendiente)]);
            });

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 56,
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
                headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: { 
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' } 
                }, 
                didDrawPage: function (data) {
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                }
            });
            
            const finalY = doc.lastAutoTable.finalY || 56;
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(51, 65, 85);
            doc.text(`TOTAL HISTÓRICO ABONADO / SALDADO: ${formatCurrency(totalPagado)}`, 14, finalY + 15);
            doc.setTextColor(220, 38, 38); // Rojo oscuro para deuda activa
            doc.text(`TOTAL DEUDA EXIGIBLE (PENDIENTE): ${formatCurrency(totalDeuda)}`, 14, finalY + 22);

            const sufijo = filtros.tipo.replace(/\s+/g, '_');
            doc.save(`Reporte_Auditoria_${sufijo}.pdf`);
            
            return; 
        }

        // =========================================================================
        // LÓGICA ORIGINAL: REPORTE DE MOVIMIENTOS / LIBRO MAYOR
        // =========================================================================

        // 3. PREPARACIÓN DE DATOS PARA LA TABLA
        const tableColumn = ["Fecha", "Tipo de Operación", "Categoría / Sector", "Detalle Registrado", "Monto"];
        const tableRows = [];

        let totalIngresos = 0;
        let totalEgresos = 0;

        movimientos.forEach(m => {
            const fechaObj = new Date(m.fecha + "T00:00:00");
            const fechaStr = isNaN(fechaObj) ? m.fecha : fechaObj.toLocaleDateString('es-AR');
            
            const tipo = m.tipo || "Desconocido";
            
            let categoria = "-";
            if (m.categoria) categoria = m.categoria;
            else if (m.sector) categoria = m.sector;

            let detalle = "-";
            if (m.proveedor) detalle = `Prov: ${m.proveedor}`;
            else if (m.activo) detalle = `Activo: ${m.activo}`;
            else if (m.entidad) detalle = `Entidad: ${m.entidad}`;

            const montoOriginal = parseFloat(m.monto || 0);
            const montoFormat = formatCurrency(montoOriginal);

            if (['Ingreso Local', 'Rendimiento', 'Dividendo', 'Venta', 'Ajuste Stock Inicial', 'Alta Préstamo'].includes(tipo)) {
                totalIngresos += montoOriginal;
            } else if (['Gasto Local', 'Gasto Familiar', 'Pago Proveedor', 'Compra', 'Pago Préstamo', 'Retiro', 'Reparto Sociedad', 'Ahorro', 'Transferencia Ahorro'].includes(tipo)) {
                totalEgresos += montoOriginal;
            }

            tableRows.push([fechaStr, tipo, categoria, detalle, montoFormat]);
        });

        // 4. GENERACIÓN DE LA TABLA
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 56,
            styles: { 
                font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: [15, 23, 42]
            },
            headStyles: { 
                fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold'
            },
            alternateRowStyles: { 
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' } 
            },
            didDrawPage: function (data) {
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Página ${data.pageNumber} de ${pageCount} - Generado por Sistema de Gestión Financiera`,
                    pageWidth / 2, pageHeight - 10, { align: 'center' }
                );
            }
        });

        // 5. CUADRO DE RESUMEN DE TOTALES
        const finalY = doc.lastAutoTable.finalY || 56;
        
        if (finalY > pageHeight - 40) {
            doc.addPage();
            doc.setPage(doc.internal.getNumberOfPages());
        }

        doc.setFillColor(241, 245, 249); 
        doc.rect(14, finalY + 10, pageWidth - 28, 28, 'F');
        
        doc.setTextColor(15, 23, 42); 
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        
        doc.text("Resumen Contable del Período Filtrado", 20, finalY + 18);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Flujo Total de Entradas (Ingresos): ${formatCurrency(totalIngresos)}`, 20, finalY + 26);
        doc.text(`Flujo Total de Salidas (Egresos): ${formatCurrency(totalEgresos)}`, 20, finalY + 32);

        // 6. DESCARGA DEL ARCHIVO
        const sufijoTipo = filtros.tipo.replace(/\s+/g, '_');
        const nombreArchivo = `Reporte_LibroMayor_${filtros.temporalidad}_${sufijoTipo}.pdf`;
        doc.save(nombreArchivo);
    }
};