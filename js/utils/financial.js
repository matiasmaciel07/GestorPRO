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
        
        // CORRECCIÓN DE TIPOS: Se retorna 0 como Number, no como String, para que el Worker pueda aplicar .toFixed(2) sin crashear.
        if (len < 2 || diasTranscurridos <= 0) return { sharpe: 0, sortino: 0, volatilidad: 0 };

        let mean = retornosDiarios.reduce((a, b) => a + b, 0) / len;
        let variance = retornosDiarios.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / len;
        let stdDev = Math.sqrt(variance);
        
        // Ajuste maestro: factor de anualización basado en la densidad de transacciones
        let factorAnualizacion = (len / diasTranscurridos) * 365;
        let volAnual = stdDev * Math.sqrt(factorAnualizacion); 
        
        // CORRECCIÓN MATEMÁTICA: Uso de descapitalización geométrica para la Tasa Libre de Riesgo.
        let riskFreePorPeriodo = Math.pow(1 + riskFreeRateAnual, 1 / Math.max(1, factorAnualizacion)) - 1;
        
        let sharpe = stdDev > 0 ? ((mean - riskFreePorPeriodo) / stdDev) * Math.sqrt(factorAnualizacion) : 0;
        
        // REFACTOR ALGORÍTMICO: Cálculo real de Desviación a la Baja (Sortino) utilizando el total de períodos (len) y el RiskFree pivot
        let negReturns = retornosDiarios.filter(r => r < riskFreePorPeriodo);
        let downVar = len > 0 ? negReturns.reduce((a, b) => a + Math.pow(b - riskFreePorPeriodo, 2), 0) / len : 0;
        let sortino = downVar > 0 ? ((mean - riskFreePorPeriodo) / Math.sqrt(downVar)) * Math.sqrt(factorAnualizacion) : 0;

        // RETORNO ESTRICTO NUMÉRICO: Evita TypeError al delegar el formateo a worker.js o UI.
        return { 
            sharpe: sharpe, 
            sortino: sortino, 
            volatilidad: volAnual 
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
        
        const sortedFlows = [...cashFlows].sort((a, b) => a.date - b.date);
        
        let t0 = sortedFlows[0].date;
        let r = guess; 
        let maxIter = 100;
        let tol = 1e-6;

        for (let i = 0; i < maxIter; i++) {
            let f = 0, df = 0;
            for (let j = 0; j < sortedFlows.length; j++) {
                let t = (sortedFlows[j].date - t0) / (1000 * 3600 * 24 * 365.25);
                f += sortedFlows[j].amount / Math.pow(1 + r, t);
                df -= (t * sortedFlows[j].amount) / Math.pow(1 + r, t + 1);
            }
            if (Math.abs(f) < tol) return r;
            if (df === 0) return r; 
            let nextR = r - f / df;
            if (isNaN(nextR) || !isFinite(nextR)) return 0;
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

        return transacciones.filter(t => {
            let rawDate = t.fecha || t.date || t.timestamp;
            if (!rawDate) return false;
            
            // CORRECCIÓN ESTRUCTURAL: Parseo seguro aislando componentes para evitar desfase de Timezone UTC->Local
            let fechaStr = String(rawDate).split('T')[0];
            const partes = fechaStr.split('-');
            if (partes.length !== 3) return false;

            const fechaTx = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
            
            if (isNaN(fechaTx.getTime())) return false;

            if (temporalidad.toLowerCase() === 'anual') {
                return fechaTx.getFullYear() === añoActual;
            }
            if (temporalidad.toLowerCase() === 'mensual') {
                return fechaTx.getFullYear() === añoActual && fechaTx.getMonth() === mesActual;
            }
            if (temporalidad.toLowerCase() === 'semanal') {
                // Cálculo estricto de diferencia en días absolutos (ignorando horas)
                const utcAhora = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
                const utcTx = Date.UTC(fechaTx.getFullYear(), fechaTx.getMonth(), fechaTx.getDate());
                const diasDiferencia = Math.abs((utcAhora - utcTx) / (24 * 60 * 60 * 1000));
                return diasDiferencia <= 7;
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
        let costosProveedoresLogistica = 0;

        transacciones.forEach(t => {
            const monto = Math.abs(parseFloat(t.monto || t.amount || 0));
            if (monto === 0) return;

            const tipoStr = String(t.tipo || "").toLowerCase().trim();
            const catStr = String(t.categoria || "").toLowerCase().trim();

            if (tipoStr === 'ingreso local' || tipoStr === 'ingreso' || tipoStr === 'venta') {
                ingresosBrutos += monto;
            } else {
                // CORRECCIÓN LÓGICA: Ampliación de la matriz de detección y normalización segura
                const patronesLogistica = ['proveedor', 'logística', 'logistica', 'insumo', 'mercadería', 'mercaderia', 'stock'];
                const esGastoLogistica = tipoStr === 'gasto local' && patronesLogistica.some(patron => catStr.includes(patron));
                
                // Blindaje P&L: Evaluación de estado estricto para evitar impactar deudas no pagadas.
                const estadoPagoStr = String(t.estadoPago || "").toLowerCase().trim();
                const esPagoAlContado = (tipoStr.includes('pago proveedor') || tipoStr.includes('pago a proveedor')) && estadoPagoStr !== 'pendiente';
                const esAmortizacion = tipoStr.includes('amortización deuda') || tipoStr.includes('amortizacion deuda');

                if (esGastoLogistica || esPagoAlContado || esAmortizacion) {
                    costosProveedoresLogistica += monto;
                }
            }
        });

        const inventarioBaseCosto = costosProveedoresLogistica;
        const ingresosBrutosNetos = Math.max(0, ingresosBrutos - costosProveedoresLogistica);

        return {
            ingresosBrutosDeclarados: ingresosBrutos,
            ingresosBrutosNetos: ingresosBrutosNetos,
            inventarioBaseCosto: inventarioBaseCosto,
            costoOperativoDeducido: costosProveedoresLogistica
        };
    },

    /**
     * Calcula la distribución sumada de gastos por cada categoría integrando promedios.
     */
    calcularDistribucionGastos(transacciones, tipoGasto, temporalidad) {
        let txsFiltradas = transacciones || [];

        if (tipoGasto) {
            txsFiltradas = txsFiltradas.filter(t => {
                const tipo = t.tipo || t.contexto || "";
                
                // Mapeo estricto para conectar el contexto visual con el tipo de registro real
                if (tipoGasto.toLowerCase() === 'local') return tipo.toLowerCase() === 'gasto local';
                if (tipoGasto.toLowerCase() === 'personal') return tipo.toLowerCase() === 'gasto familiar' || tipo.toLowerCase() === 'gasto personal';
                
                return tipo.toLowerCase() === tipoGasto.toLowerCase();
            });
        }

        txsFiltradas = this.filtrarPorTemporalidad(txsFiltradas, temporalidad);

        const distribucion = {};
        const distribucionPromediada = {};
        
        txsFiltradas.forEach(t => {
            const monto = Math.abs(parseFloat(t.monto || t.amount || 0)); 
            const categoria = t.categoria || t.category || "Sin Categorizar";

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