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
                const diasDiferencia = Math.round(Math.abs((ahora - fechaTx) / unDia));
                return diasDiferencia <= 7;
            }
            return true;
        });
    },

    /**
     * Calcula los promedios desglosados (Mes, Semana, Día, Hora) de un monto total.
     * Implementa el delta real en días desde la primera transacción para precisión absoluta.
     */
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

        if (isHistorico) {
            if (minFecha) {
                // Cálculo del delta real en días desde el primer registro histórico hasta hoy
                const diferenciaMs = ahora - minFecha;
                diasDivisor = Math.max(1, diferenciaMs / (1000 * 3600 * 24));
            } else {
                diasDivisor = 30.41; // Fallback estandarizado
            }
        } else if (temporalidad.toLowerCase() === 'anual') {
            const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
            diasDivisor = Math.max(1, (ahora - inicioAnio) / (1000 * 3600 * 24));
        } else if (temporalidad.toLowerCase() === 'mensual') {
            const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            diasDivisor = Math.max(1, (ahora - inicioMes) / (1000 * 3600 * 24));
        } else if (temporalidad.toLowerCase() === 'semanal') {
            diasDivisor = 7;
        }

        // Obtención del flujo diario purificado
        const montoDiario = montoTotal / diasDivisor;

        // Proyección exacta mediante coeficientes
        return {
            mes: montoDiario * 30.41,
            semana: montoDiario * 7,
            dia: montoDiario,
            hora: montoDiario / 24
        };
    },

    /**
     * Realiza la auditoría comercial corrigiendo el Inventario Base.
     * Deduce pagos a Proveedores, Amortizaciones y Logística de los Ingresos Brutos Declarados.
     */
    calcularAuditoriaComercial(transacciones) {
        let ingresosBrutos = 0;
        let costosProveedoresLogistica = 0;

        transacciones.forEach(t => {
            const monto = Math.abs(parseFloat(t.monto || t.amount || 0));
            if (monto === 0) return;

            const tipoStr = (t.tipo || "").toLowerCase().trim();
            const catStr = (t.categoria || "").toLowerCase().trim();

            if (tipoStr === 'ingreso' || tipoStr === 'venta') {
                ingresosBrutos += monto;
            } else {
                // Validación estricta para inyecciones de costo de inventario
                const esGastoLogistica = tipoStr === 'gasto' && (catStr.includes('proveedor') || catStr.includes('logística') || catStr.includes('logistica') || catStr.includes('insumos'));
                
                const esPagoDirecto = tipoStr === 'pago proveedor' || 
                                      tipoStr === 'pago a proveedor' || 
                                      tipoStr === 'amortización deuda a proveedor' || 
                                      tipoStr === 'amortizacion deuda a proveedor';

                if (esGastoLogistica || esPagoDirecto) {
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
            if (esHistorico) {
                distribucionPromediada[cat] = distribucion[cat];
            } else {
                const promedios = this.calcularPromediosDesglosados(distribucion[cat], temporalidad, txsFiltradas);
                if (temporalidad.toLowerCase() === 'anual') distribucionPromediada[cat] = promedios.mes;
                else if (temporalidad.toLowerCase() === 'mensual') distribucionPromediada[cat] = promedios.semana;
                else if (temporalidad.toLowerCase() === 'semanal') distribucionPromediada[cat] = promedios.dia;
            }
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