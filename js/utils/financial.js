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
    calcularRiesgoTWR(retornosDiarios, riskFreeRateAnual = 0.05) {
        let len = retornosDiarios.length;
        if (len < 2) return { sharpe: 0, sortino: 0, volatilidad: 0 };

        let mean = retornosDiarios.reduce((a, b) => a + b, 0) / len;
        let variance = retornosDiarios.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / len;
        let stdDev = Math.sqrt(variance);
        
        let volAnual = stdDev * Math.sqrt(252); 
        
        let riskFreeDiario = riskFreeRateAnual / 252;
        let sharpe = stdDev > 0 ? ((mean - riskFreeDiario) / stdDev) * Math.sqrt(252) : 0;
        
        let negReturns = retornosDiarios.filter(r => r < 0);
        let downVar = negReturns.length > 0 ? negReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / negReturns.length : 0;
        let sortino = downVar > 0 ? ((mean - riskFreeDiario) / Math.sqrt(downVar)) * Math.sqrt(252) : 0;

        return { sharpe, sortino, volatilidad: volAnual };
    },

    /**
     * Calcula la tendencia inflacionaria estadística.
     */
    proyectarInflacion(inflacionINDEC) {
        let inflacionKeys = Object.keys(inflacionINDEC).sort();
        let last12 = inflacionKeys.slice(-12);
        let avgInflacionMensual = 0;
        
        if (last12.length > 0) {
            let totalInf = last12.reduce((a, k) => a + parseFloat(inflacionINDEC[k]), 0);
            avgInflacionMensual = totalInf / last12.length;
        }

        return {
            avgMensual: avgInflacionMensual,
            tasaDiaria: avgInflacionMensual > 0 ? (Math.pow(1 + (avgInflacionMensual / 100), 12 / 365) - 1) : 0
        };
    },

    /**
     * Calcula el valor neto del Esfuerzo Físico
     * Basado en la jornada comercial estandarizada.
     */
    calcularEsfuerzoFisico(gananciaNetaMensual) {
        let neto = gananciaNetaMensual > 0 ? gananciaNetaMensual : 0;
        let semana = neto / 4.3333; 
        let dia = semana / 6;       
        let hora = semana / 54;     

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
        if (cashFlows.length < 2) return 0;
        let t0 = cashFlows[0].date;
        let r = guess; 
        let maxIter = 100;
        let tol = 1e-6;

        for (let i = 0; i < maxIter; i++) {
            let f = 0, df = 0;
            for (let j = 0; j < cashFlows.length; j++) {
                let t = (cashFlows[j].date - t0) / (1000 * 3600 * 24 * 365.25);
                f += cashFlows[j].amount / Math.pow(1 + r, t);
                df -= (t * cashFlows[j].amount) / Math.pow(1 + r, t + 1);
            }
            if (Math.abs(f) < tol) return r;
            if (df === 0) return r; 
            let nextR = r - f / df;
            if (Math.abs(nextR - r) < tol) return nextR;
            r = nextR;
            if (r <= -1) r = -0.9999; 
        }
        return r;
    },

    /**
     * Filtra un conjunto de transacciones basándose en la temporalidad seleccionada.
     * @param {Array} transacciones - Lista de objetos de transacción.
     * @param {String} temporalidad - 'Histórico', 'Anual', 'Mensual', 'Semanal'.
     * @returns {Array} - Array de transacciones que cumplen el criterio de fecha.
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
            // Soporta distintos nombres de propiedad para la fecha dependiendo de cómo se guarden en el Model
            const fechaStr = t.fecha || t.date || t.timestamp; 
            const fechaTx = new Date(fechaStr);
            
            if (isNaN(fechaTx.getTime())) return false;

            if (temporalidad.toLowerCase() === 'anual') {
                return fechaTx.getFullYear() === añoActual;
            }
            if (temporalidad.toLowerCase() === 'mensual') {
                return fechaTx.getFullYear() === añoActual && fechaTx.getMonth() === mesActual;
            }
            if (temporalidad.toLowerCase() === 'semanal') {
                const unDia = 24 * 60 * 60 * 1000;
                // Diferencia en días redondos
                const diasDiferencia = Math.round(Math.abs((ahora - fechaTx) / unDia));
                return diasDiferencia <= 7;
            }
            return true;
        });
    },

    /**
     * Calcula la distribución sumada de gastos por cada categoría.
     * Diseñado para generar rápidamente la estructura de datos requerida por Chart.js.
     * * @param {Array} transacciones - Array completo de gastos.
     * @param {String} tipoGasto - Filtrar contexto ('Local' o 'Personal'). Puede ser null si el array ya está pre-filtrado.
     * @param {String} temporalidad - Rango de tiempo ('Histórico', 'Anual', 'Mensual', 'Semanal').
     * @returns {Object} - Objeto estructurado con labels, data (montos) y el total acumulado.
     */
    calcularDistribucionGastos(transacciones, tipoGasto, temporalidad) {
        let txsFiltradas = transacciones || [];

        // 1. Filtrado por tipo/contexto de gasto (si se provee el parámetro)
        if (tipoGasto) {
            txsFiltradas = txsFiltradas.filter(t => {
                const tipo = t.tipo || t.contexto || "";
                return tipo.toLowerCase() === tipoGasto.toLowerCase();
            });
        }

        // 2. Filtrado por temporalidad delegando en la función especializada
        txsFiltradas = this.filtrarPorTemporalidad(txsFiltradas, temporalidad);

        // 3. Agrupación y sumatoria matemática
        const distribucion = {};
        
        txsFiltradas.forEach(t => {
            // Aseguramos que el monto sea un valor numérico positivo para el gráfico
            const monto = Math.abs(parseFloat(t.monto || t.amount || 0)); 
            const categoria = t.categoria || t.category || "Sin Categorizar";

            if (monto > 0) {
                if (!distribucion[categoria]) {
                    distribucion[categoria] = 0;
                }
                distribucion[categoria] += monto;
            }
        });

        // 4. Estructuración para exportación visual
        const labels = Object.keys(distribucion);
        const dataValues = Object.values(distribucion);
        const sumaTotal = dataValues.reduce((acc, val) => acc + val, 0);

        return {
            distribucionBruta: distribucion,
            labels: labels,
            data: dataValues,
            total: sumaTotal
        };
    }
};