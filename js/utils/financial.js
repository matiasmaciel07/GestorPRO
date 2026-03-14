"use strict";

export const FinancialMath = {
    /**
     * Calcula la Tasa de Crecimiento Anual Compuesta (CAGR).
     */
    calcularCAGR(valorInicial, valorFinal, anios) {
        if (valorInicial <= 0 || anios <= 0) return 0;
        return (Math.pow(valorFinal / valorInicial, 1 / anios) - 1) * 100;
    },

    /**
     * Calcula los Drawdowns (caídas desde el máximo histórico).
     */
    calcularDrawdowns(valores) {
        if (!valores || valores.length === 0) return { maxDD: 0, currentDD: 0, ddSerie: [] };
        
        let peak = 0;
        let ddSerie = [];
        
        valores.forEach(val => {
            if (val > peak) peak = val;
            let dd = peak > 0 ? ((val - peak) / peak) * 100 : 0;
            ddSerie.push(dd);
        });

        let maxDD = Math.min(...ddSerie); 
        if (!isFinite(maxDD)) maxDD = 0;
        
        return {
            maxDD,
            currentDD: ddSerie[ddSerie.length - 1] || 0,
            ddSerie,
            peak
        };
    },

    /**
     * Calcula Métricas de Riesgo usando el Retorno Ponderado en el Tiempo (TWR)
     */
    calcularRiesgoTWR(retornosDiarios, riskFreeRateAnual = 0.05, diasTranscurridos = 365) {
        let len = retornosDiarios.length;
        
        if (len < 2 || diasTranscurridos <= 0) return { sharpe: 0, sortino: 0, volatilidad: 0 };

        let mean = retornosDiarios.reduce((a, b) => a + b, 0) / len;
        
        // CORRECCIÓN MATEMÁTICA: Uso de Corrección de Bessel (len - 1) para varianza muestral no sesgada
        let variance = retornosDiarios.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (len - 1);
        let stdDev = Math.sqrt(variance);
        
        let factorAnualizacion = (len / diasTranscurridos) * 365;
        let volAnual = stdDev * Math.sqrt(factorAnualizacion); 
        
        let riskFreePorPeriodo = Math.pow(1 + riskFreeRateAnual, 1 / Math.max(1, factorAnualizacion)) - 1;
        
        let sharpe = stdDev > 0 ? ((mean - riskFreePorPeriodo) / stdDev) * Math.sqrt(factorAnualizacion) : 0;
        
        // REFACTOR ALGORÍTMICO: Cálculo real de Desviación a la Baja (Downside Deviation)
        let negReturns = retornosDiarios.filter(r => r < riskFreePorPeriodo);
        let downVar = negReturns.length > 0 ? negReturns.reduce((a, b) => a + Math.pow(b - riskFreePorPeriodo, 2), 0) / len : 0;
        
        // Manejo de escenario ideal (sin retornos negativos por debajo del Risk-Free)
        let sortino;
        if (downVar > 0) {
            sortino = ((mean - riskFreePorPeriodo) / Math.sqrt(downVar)) * Math.sqrt(factorAnualizacion);
        } else {
            sortino = mean > riskFreePorPeriodo ? 99.99 : 0; // Techo lógico
        }

        // Parseo estricto para evitar propagación de NaN o desbordamientos al hilo principal
        return { 
            sharpe: isFinite(sharpe) ? Number(sharpe.toFixed(4)) : 0, 
            sortino: isFinite(sortino) ? Number(sortino.toFixed(4)) : 0, 
            volatilidad: isFinite(volAnual) ? Number(volAnual.toFixed(4)) : 0 
        };
    },

    proyectarInflacion(inflacionINDEC) {
        let inflacionKeys = Object.keys(inflacionINDEC).sort();
        let last12 = inflacionKeys.slice(-12);
        
        // CORRECCIÓN MATEMÁTICA: La inflación es un fenómeno multiplicativo (geométrico), no aditivo.
        let inflacionAcumuladaGeometrica = 1;
        
        if (last12.length > 0) {
            last12.forEach(k => {
                let tasaMensual = parseFloat(inflacionINDEC[k]) / 100;
                if (!isNaN(tasaMensual)) {
                    inflacionAcumuladaGeometrica *= (1 + tasaMensual);
                }
            });
        }

        // Se extrae la media geométrica mensual exacta que llevó al capital al estado actual
        let avgInflacionMensual = last12.length > 0 
            ? (Math.pow(inflacionAcumuladaGeometrica, 1 / last12.length) - 1) * 100 
            : 0;

        return {
            avgMensual: avgInflacionMensual,
            tasaDiaria: avgInflacionMensual > 0 ? (Math.pow(1 + (avgInflacionMensual / 100), 12 / 365) - 1) : 0
        };
    },

    /**
     * Calcula el valor neto del Esfuerzo Físico
     * Parametrizado para soportar iteraciones de optimización de tiempo laboral.
     */
    calcularEsfuerzoFisico(gananciaNetaMensual, parametros = { semanasPorMes: 4.3333, diasPorSemana: 6, horasPorDia: 9 }) {
        let neto = gananciaNetaMensual > 0 ? gananciaNetaMensual : 0;
        let semana = neto / parametros.semanasPorMes; 
        let dia = semana / parametros.diasPorSemana;       
        let hora = dia / parametros.horasPorDia; // Equivalente matemático limpio de semana/(dias*horas)

        return {
            mes: neto,
            semana: semana,
            dia: dia,
            hora: hora
        };
    },

    /**
     * Riesgo de Concentración de Portafolio (Índice HHI)
     */
    calcularConcentrationRisk(atribucionValues) {
        let total = atribucionValues.reduce((a, b) => a + Math.abs(b), 0);
        if (total === 0) return { hhi: 0, label: "Sin Datos" };
        let hhi = 0;
        for (let i = 0; i < atribucionValues.length; i++) {
            let pct = (Math.abs(atribucionValues[i]) / total) * 100;
            hhi += Math.pow(pct, 2);
        }
        let label = hhi < 1500 ? "Excelente (Bajo Riesgo)" : (hhi < 2500 ? "Moderado (Atención)" : "Peligro (Altamente Concentrado)");
        return { hhi: hhi, label: label };
    },

    /**
     * Tasa Interna de Retorno (XIRR)
     */
    calculateXIRR(cashFlows, guess = 0.1) {
        if (!cashFlows || cashFlows.length < 2) return 0;
        
        // CORRECCIÓN ESTRUCTURAL: Pre-validación de convergencia O(N). 
        // Se requiere obligatoriamente un flujo positivo y uno negativo para que exista una TIR matemática.
        let tienePositivo = false;
        let tieneNegativo = false;
        
        for (let i = 0; i < cashFlows.length; i++) {
            if (cashFlows[i].amount > 0) tienePositivo = true;
            else if (cashFlows[i].amount < 0) tieneNegativo = true;
            
            if (tienePositivo && tieneNegativo) break; // Early exit de optimización
        }
        
        if (!tienePositivo || !tieneNegativo) return 0;
        
        const sortedFlows = [...cashFlows].sort((a, b) => a.date - b.date);
        
        let t0 = sortedFlows[0].date;
        const len = sortedFlows.length;
        
        // OPTIMIZACIÓN EXTREMA: Pre-cálculo de constantes temporales para el algoritmo de Newton-Raphson
        // Evita recalcular fracciones de milisegundos en cada una de las hasta 1000 iteraciones.
        const timeFractions = new Float64Array(len);
        const amounts = new Float64Array(len);
        
        for (let j = 0; j < len; j++) {
            timeFractions[j] = (sortedFlows[j].date - t0) / (1000 * 3600 * 24 * 365.25);
            amounts[j] = sortedFlows[j].amount;
        }

        let r = guess; 
        let maxIter = 1000; // Incrementado para asegurar convergencia en flujos complejos
        let tol = 1e-6;

        for (let i = 0; i < maxIter; i++) {
            let f = 0, df = 0;
            for (let j = 0; j < len; j++) {
                let t = timeFractions[j];
                let discountFactor = Math.pow(1 + r, t);
                
                // Prevención de desbordamiento (Overflow) si discountFactor es asintótico
                if (!isFinite(discountFactor) || discountFactor === 0) break;

                f += amounts[j] / discountFactor;
                df -= (t * amounts[j]) / Math.pow(1 + r, t + 1);
            }
            
            if (Math.abs(f) < tol) return r;
            if (df === 0) return r; // Fallback extremo para evitar división por cero
            
            let nextR = r - f / df;
            if (isNaN(nextR) || !isFinite(nextR)) return 0;
            
            // CORRECCIÓN MATEMÁTICA: Amortiguación de oscilaciones para flujos alternantes.
            // Impide saltos irrazonables limitando el delta en cada iteración.
            if (nextR > r + 1.5) nextR = r + 1.5;
            if (nextR < r - 1.5) nextR = r - 1.5;

            if (Math.abs(nextR - r) < tol) return nextR;
            r = nextR;
            
            if (r <= -1) r = -0.9999; 
        }
        return r;
    },

    /**
     * Filtra un conjunto de transacciones basándose en la temporalidad seleccionada.
     */
    filtrarPorTemporalidad(transacciones, temporalidad) {
        if (!transacciones || transacciones.length === 0) return [];
        if (!temporalidad || temporalidad.toLowerCase() === 'histórico' || temporalidad.toLowerCase() === 'historico') {
            return transacciones;
        }

        const ahora = new Date();
        const añoActual = ahora.getFullYear();
        const mesActual = ahora.getMonth();

        // CORRECCIÓN ESTRUCTURAL: Cálculo de límites de la semana actual (Lunes a Domingo) en Zona Horaria Local.
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const diaSemana = hoy.getDay();
        // Ajuste para forzar el inicio de semana en Lunes (1) y final en Domingo (0)
        const diffLunes = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
        
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(diffLunes);
        inicioSemana.setHours(0, 0, 0, 0);
        
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        finSemana.setHours(23, 59, 59, 999);

        return transacciones.filter(t => {
            let rawDate = t.fecha || t.date || t.timestamp;
            if (!rawDate) return false;
            
            // Parseo seguro aislando componentes para anclarlos a la hora local exacta
            let fechaStr = String(rawDate).split('T')[0];
            const partes = fechaStr.split('-');
            if (partes.length !== 3) return false;

            const fechaTx = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
            fechaTx.setHours(0, 0, 0, 0);
            
            if (isNaN(fechaTx.getTime())) return false;

            if (temporalidad.toLowerCase() === 'anual') {
                return fechaTx.getFullYear() === añoActual;
            }
            if (temporalidad.toLowerCase() === 'mensual') {
                return fechaTx.getFullYear() === añoActual && fechaTx.getMonth() === mesActual;
            }
            if (temporalidad.toLowerCase() === 'semanal') {
                // Validación robusta dentro de la matriz local de la semana actual
                return fechaTx.getTime() >= inicioSemana.getTime() && fechaTx.getTime() <= finSemana.getTime();
            }
            return true;
        });
    },

    calcularPromediosDesglosados(montoTotal, temporalidad, transacciones = []) {
        if (montoTotal === 0) return { mes: 0, semana: 0, dia: 0, hora: 0 };
        
        let diasDivisor = 1;
        const ahora = new Date();
        
        let minFecha = null;
        if (transacciones && transacciones.length > 0) {
            const fechas = transacciones
                .map(t => new Date(t.fecha || t.date || t.timestamp).getTime())
                .filter(f => !isNaN(f));
                
            if (fechas.length > 0) {
                minFecha = new Date(Math.min(...fechas));
            }
        }

        const isHistorico = !temporalidad || temporalidad.toLowerCase() === 'histórico' || temporalidad.toLowerCase() === 'historico';

        // Cálculo exacto vía motor de Timestamp en UTC
        const getExactDays = (d1, d2) => {
            const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
            return Math.max(1, (utc2 - utc1) / (1000 * 3600 * 24));
        };

        if (isHistorico) {
            if (minFecha) {
                diasDivisor = getExactDays(minFecha, ahora);
            } else {
                diasDivisor = 30.4166; // Fallback extremo
            }
        } else if (temporalidad.toLowerCase() === 'anual') {
            const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
            diasDivisor = getExactDays(inicioAnio, ahora);
        } else if (temporalidad.toLowerCase() === 'mensual') {
            const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            diasDivisor = getExactDays(inicioMes, ahora);
        } else if (temporalidad.toLowerCase() === 'semanal') {
            diasDivisor = 7;
        }

        const montoDiario = montoTotal / diasDivisor;

        // Estandarización de métricas
        return {
            mes: montoDiario * (365.25 / 12),
            semana: montoDiario * 7,
            dia: montoDiario,
            hora: montoDiario / 24
        };
    },

    calcularAuditoriaComercial(transacciones) {
        let ingresosBrutos = 0;
        let costosProveedoresLogistica = 0; // COGS: Costo de Mercadería Vendida (Afecta Inventario)
        let costosOperativosEstructurales = 0; // OPEX: Gastos de mantener el local
        let amortizacionesFinancieras = 0; // Fuga de capital por deuda

        // Matrices Regex precompiladas
        const rxIngreso = /ingreso|venta|cobro/i;
        const rxLogistica = /logística|logistica|insumo|mercadería|mercaderia|stock|compra merca/i;

        transacciones.forEach(t => {
            const monto = Math.abs(parseFloat(t.monto || t.amount || 0));
            if (monto === 0 || isNaN(monto)) return;

            const tipoStr = String(t.tipo || "").trim();
            const catStr = String(t.categoria || "").trim();

            if (rxIngreso.test(tipoStr)) {
                ingresosBrutos += monto;
            } else {
                // CORRECCIÓN MATEMÁTICA: Aislar operaciones que tocan inventario real.
                const esPagoProveedorDirecto = tipoStr === 'Pago Proveedor';
                const esGastoLogistica = tipoStr.toLowerCase().includes('gasto') && rxLogistica.test(catStr);
                
                // Las deudas y préstamos son obligaciones, no mercadería.
                const esAmortizacionDeuda = tipoStr === 'Amortización Deuda a Proveedor' || tipoStr === 'Pago Préstamo';

                if (esPagoProveedorDirecto || esGastoLogistica) {
                    costosProveedoresLogistica += monto;
                } else if (esAmortizacionDeuda) {
                    amortizacionesFinancieras += monto;
                } else if (tipoStr.toLowerCase().includes('gasto local') || tipoStr.toLowerCase().includes('operativo')) {
                    costosOperativosEstructurales += monto;
                }
            }
        });

        // El inventario solo debe reflejar los costos directos de inyección de mercadería
        const inventarioBaseCosto = costosProveedoresLogistica;
        const ingresosBrutosNetos = Math.max(0, ingresosBrutos - costosProveedoresLogistica);

        return {
            ingresosBrutosDeclarados: ingresosBrutos,
            ingresosBrutosNetos: ingresosBrutosNetos,
            inventarioBaseCosto: inventarioBaseCosto,
            costoOperativoDeducido: costosProveedoresLogistica,
            costoOperativoEstructural: costosOperativosEstructurales,
            amortizacionesFinancieras: amortizacionesFinancieras // Métrica saneada
        };
    },

    /**
     * Calcula la distribución sumada de gastos por cada categoría integrando promedios.
     */
    calcularDistribucionGastos(transacciones, tipoGasto, temporalidad) {
        let txsFiltradas = transacciones || [];

        if (tipoGasto) {
            txsFiltradas = txsFiltradas.filter(t => {
                const tipoStr = String(t.tipo || t.contexto || "").toLowerCase();
                
                // Mapeo estricto para conectar el contexto visual con el tipo de registro real
                if (tipoGasto.toLowerCase() === 'local') {
                    return tipoStr === 'gasto local' || tipoStr === 'pago proveedor' || tipoStr === 'amortización deuda a proveedor';
                }
                if (tipoGasto.toLowerCase() === 'personal') {
                    return tipoStr === 'gasto familiar' || tipoStr === 'gasto personal' || tipoStr === 'pago préstamo';
                }
                
                return tipoStr === tipoGasto.toLowerCase();
            });
        }

        txsFiltradas = this.filtrarPorTemporalidad(txsFiltradas, temporalidad);

        const distribucion = {};
        const distribucionPromediada = {};
        
        txsFiltradas.forEach(t => {
            const monto = Math.abs(parseFloat(t.monto || t.amount || 0)); 
            
            // Inyección algorítmica: Transformamos el proveedor/entidad en una categoría gráfica
            let categoria = t.categoria || t.category || "Sin Categorizar";
            if (t.tipo === 'Pago Proveedor' || t.tipo === 'Amortización Deuda a Proveedor') {
                categoria = t.proveedor ? `Proveedor: ${t.proveedor}` : 'Pago a Proveedores';
            } else if (t.tipo === 'Pago Préstamo') {
                categoria = t.entidad ? `Préstamo: ${t.entidad}` : 'Amortización de Préstamo';
            }

            if (monto > 0) {
                if (!distribucion[categoria]) distribucion[categoria] = 0;
                distribucion[categoria] += monto;
            }
        });

        const esHistorico = !temporalidad || temporalidad.toLowerCase() === 'histórico' || temporalidad.toLowerCase() === 'historico';

        Object.keys(distribucion).forEach(cat => {
            distribucionPromediada[cat] = distribucion[cat];
        });

        const labels = Object.keys(distribucionPromediada);
        const dataValues = Object.values(distribucionPromediada);
        const sumaTotal = dataValues.reduce((acc, val) => acc + val, 0);

        return {
            distribucionBruta: distribucionPromediada,
            labels: labels,
            data: dataValues,
            total: sumaTotal
        };
    }
};