"use strict";

export const PDFGenerator = {
    /**
     * Genera y descarga un archivo PDF profesional del Libro Mayor.
     * @param {Array} movimientos - Lista de transacciones ya filtradas y ordenadas por el Modelo.
     * @param {Object} filtros - Objeto con los filtros aplicados (temporalidad y tipo) para mostrar en el membrete.
     */
    exportarLibroMayor(movimientos, filtros) {
        // Validamos la existencia de las librerías inyectadas en el HTML
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error("Las librerías jsPDF no están cargadas.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Configuración de dimensiones de página
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. MEMBRETE / ENCABEZADO (Diseño Neutro y Profesional)
        doc.setFillColor(30, 41, 59); // Color corporativo Slate 800
        doc.rect(0, 0, pageWidth, 28, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE FINANCIERO - LIBRO MAYOR", 14, 18);

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

        // 3. PREPARACIÓN DE DATOS PARA LA TABLA
        const tableColumn = ["Fecha", "Tipo de Operación", "Categoría / Sector", "Detalle Registrado", "Monto"];
        const tableRows = [];

        let totalIngresos = 0;
        let totalEgresos = 0;

        movimientos.forEach(m => {
            // Formateo de Fecha
            const fechaObj = new Date(m.fecha + "T00:00:00");
            const fechaStr = isNaN(fechaObj) ? m.fecha : fechaObj.toLocaleDateString('es-AR');
            
            const tipo = m.tipo || "Desconocido";
            
            // Resolución inteligente de Categoría o Sector según el tipo de registro
            let categoria = "-";
            if (m.categoria) categoria = m.categoria;
            else if (m.sector) categoria = m.sector;

            // Resolución de Detalles adicionales
            let detalle = "-";
            if (m.proveedor) detalle = `Prov: ${m.proveedor}`;
            else if (m.activo) detalle = `Activo: ${m.activo}`;
            else if (m.entidad) detalle = `Entidad: ${m.entidad}`;

            // Formateo de Moneda
            const montoOriginal = parseFloat(m.monto || 0);
            const montoFormat = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(montoOriginal);

            // Clasificación contable para el resumen del documento
            if (['Ingreso Local', 'Rendimiento', 'Dividendo', 'Venta', 'Ajuste Stock Inicial', 'Alta Préstamo'].includes(tipo)) {
                totalIngresos += montoOriginal;
            } else if (['Gasto Local', 'Gasto Familiar', 'Pago Proveedor', 'Compra', 'Pago Préstamo', 'Retiro', 'Reparto Sociedad', 'Ahorro', 'Transferencia Ahorro'].includes(tipo)) {
                totalEgresos += montoOriginal;
            }

            tableRows.push([fechaStr, tipo, categoria, detalle, montoFormat]);
        });

        // 4. GENERACIÓN DE LA TABLA (Usando jspdf-autotable)
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 56,
            styles: { 
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 4,
                textColor: [15, 23, 42]
            },
            headStyles: { 
                fillColor: [51, 65, 85], 
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: { 
                fillColor: [248, 250, 252] // Slate 50 muy tenue
            },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' } // Alinear montos a la derecha
            },
            didDrawPage: function (data) {
                // Pie de página estandarizado en cada hoja
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184); // Slate 400
                doc.text(
                    `Página ${data.pageNumber} de ${pageCount} - Generado por Sistema de Gestión Financiera`,
                    pageWidth / 2, 
                    pageHeight - 10, 
                    { align: 'center' }
                );
            }
        });

        // 5. CUADRO DE RESUMEN DE TOTALES
        const finalY = doc.lastAutoTable.finalY || 56;
        
        // Evitar que el resumen se corte en el final de la página
        if (finalY > pageHeight - 40) {
            doc.addPage();
            doc.setPage(doc.internal.getNumberOfPages());
        }

        doc.setFillColor(241, 245, 249); // Slate 100
        doc.rect(14, finalY + 10, pageWidth - 28, 28, 'F');
        
        doc.setTextColor(15, 23, 42); 
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        
        const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

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