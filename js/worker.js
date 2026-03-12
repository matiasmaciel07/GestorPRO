"use strict";
import { FinancialMath } from './utils/financial.js';

let st = {
    movimientos: [],
    portafolio: {},
    stats: getEmptyStats(),
    lotesCompra: {},
    lastDate: null,
    mesesOperativos: new Set(),
    diasOperadosPorDiaSemana: { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set(), 0: new Set() },
    avgInflacionMensual: 0,
    dailyInfRate: 0,
    inflacionAcumuladaAbsoluta: 0,
    firstDateMs: 0
};

// Mapa de pesos pre-calculado para evitar asignación constante de objetos durante el sort
const PESOS_TIPO = { 
    'Ingreso Local': 1, 'Aporte Capital': 1.5, 'Alta Préstamo': 2, 'Ajuste Stock Inicial': 2.5, 'Correccion Stock': 2.6, 'Ahorro': 3, 'Transferencia Ahorro': 4, 'Rescate a Caja': 4.5,
    'Compra': 5, 'Rendimiento': 6, 'Dividendo': 7, 
    'Gasto Local': 8, 'Gasto Familiar': 9, 'Pago Proveedor': 10, 'Amortización Deuda a Proveedor': 10.1, 'Reparto Sociedad': 10.5, 'Pago Préstamo': 11, 
    'Venta': 12, 'Retiro': 13 
};

function safeFloat(num) {
    return Math.round((parseFloat(num) || 0) * 1000000) / 1000000;
}

function getEmptyStats() {
    return {
        billetera: 0, cajaLocal: 0, 
        capInvertido: 0, ganRealizada: 0, rendExtra: 0,
        vTotal: 0, vGanadas: 0, rendimientoPorActivo: {},
        totalAhorradoFisico: 0, totalRetirado: 0, ahorroArsPuro: 0,
        usdComprado: 0, costoUsdArs: 0, atribucionSector: {},
        diasTenenciaTotal: 0, operacionesCerradas: 0,
        precioPromedioDolar: 0,
        
        ingresosLocal: 0, gastosLocal: 0, gastosFamiliar: 0, 
        pagosProveedores: 0, deudaActiva: 0,
        ingresosCapital: 0, entradasCajaNoOperativas: 0, ingresosConsolidadosGlobal: 0,
        
        stockCosto: 0, stockValorVenta: 0, markupPromedio: 1,
        stockCostoHistorico: 0, stockValorVentaHistorico: 0,
        liquidezAcida: 0, liquidezCorriente: 0,
        
        prestamosDetalle: {}, proveedoresMensual: {}, proveedoresDetalle: {},
        deudaProveedoresDetalle: {},
        
        totalPedidoPrestamos: 0, totalDevolverPrestamos: 0, 
        totalCuotaMensualPrestamos: 0, tasaPromedioPrestamos: 0,

        historyPatrimonio: [], historyPatrimonioConStock: [],
        historyLiquidez: [], historyInvertido: [], historyCajaLocal: [], 
        historyIngresosLocal: [], historyFlujoNeto: [], historyFechas: [],
        historyPatrimonioPuro: [], historyInflacion: [],
        historyCostoVida: [], historyMediaVida: [], historyFlujoPatrimonial: [],
        
        gastosPorCategoriaLocal: {}, gastosPorCategoriaFamiliar: {}, gastosPorProveedor: {},
        ahorroHaciaBursatil: 0, flujoMensual: {}, 
        
        numMesesOperativos: 0, tasaAhorroReal: 0, fondoSupervivenciaMeses: 0, cargaFinancieraPct: 0,
        gananciaNetaTotal: 0,
        esfuerzo: { mes: 0, semana: 0, dia: 0, hora: 0 },
        esfuerzoBruto: { mes: 0, semana: 0, dia: 0, hora: 0 },
        gastoPersonalPromedioMes: 0,
        
        flowIngreso: 0, flowOperativo: 0, flowProveedores: 0, flowVida: 0, flowAhorro: 0, flowSociedad: 0,
        sociedadRetiros: 0, fugaCapitalMonto: 0, fugaPersonalPct: 0, sweepSugerido: 0,
        crossoverPct: 0, horasLibresRegaladas: 0,
        ventasPorDiaSemana: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 },
        termometroDias: {}, puntoEquilibrioHistorico: 0,
        ventasMensuales: { labels: [], data: [], dataCostoVida: [] },

        xirr: 0, cagr: 0, riesgoConcentracion: { hhi: 0, label: "Sin Datos" },
        riesgo: { sharpe: "0.00", sortino: "0.00", volatilidad: "0.00" },
        healthScore: 0
    };
}

function sortMovimientos(arr) {
    arr.sort((a, b) => {
        let diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
        if (diff === 0) {
            return (PESOS_TIPO[a.tipo] || 15) - (PESOS_TIPO[b.tipo] || 15);
        }
        return diff;
    });
}

function processSingle(m) {
    let montoNum = safeFloat(m.monto);
    let cantNum = safeFloat(m.cantidad);
    let mesStr = m.fecha.substring(0, 7);
    let flujoExternoHoy = 0;
    
    st.mesesOperativos.add(mesStr);
    
    if (!st.stats.flujoMensual[mesStr]) {
        st.stats.flujoMensual[mesStr] = { ingresos: 0, cuotas: 0, costoVida: 0 };
    }

    if (m.tipo === 'Ahorro') {
        st.stats.billetera = safeFloat(st.stats.billetera + montoNum);
        st.stats.totalAhorradoFisico = safeFloat(st.stats.totalAhorradoFisico + montoNum);
        st.stats.ahorroArsPuro = safeFloat(st.stats.ahorroArsPuro + montoNum);
        st.stats.ahorroHaciaBursatil = safeFloat(st.stats.ahorroHaciaBursatil + montoNum); 
        st.stats.flowAhorro = safeFloat(st.stats.flowAhorro + montoNum);
        flujoExternoHoy = montoNum; 
        
        if (m.usd > 0) { 
            st.stats.usdComprado = safeFloat(st.stats.usdComprado + parseFloat(m.usd));
            st.stats.costoUsdArs = safeFloat(st.stats.costoUsdArs + montoNum); 
        }

        st.stats.ingresosCapital = safeFloat((st.stats.ingresosCapital || 0) + montoNum);
        st.stats.entradasCajaNoOperativas = safeFloat(st.stats.entradasCajaNoOperativas + montoNum);
        st.stats.ingresosConsolidadosGlobal = safeFloat(st.stats.ingresosConsolidadosGlobal + montoNum);
    } 
    else if (m.tipo === 'Transferencia Ahorro') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
        st.stats.billetera = safeFloat(st.stats.billetera + montoNum);
        
        st.stats.totalAhorradoFisico = safeFloat(st.stats.totalAhorradoFisico + montoNum);
        st.stats.ahorroArsPuro = safeFloat(st.stats.ahorroArsPuro + montoNum);
        st.stats.ahorroHaciaBursatil = safeFloat(st.stats.ahorroHaciaBursatil + montoNum); 
        st.stats.flowAhorro = safeFloat(st.stats.flowAhorro + montoNum);
        
        if (m.usd > 0) { 
            st.stats.usdComprado = safeFloat(st.stats.usdComprado + parseFloat(m.usd));
            st.stats.costoUsdArs = safeFloat(st.stats.costoUsdArs + montoNum); 
        }
    }
    else if (m.tipo === 'Rescate a Caja') {
        st.stats.billetera = safeFloat(st.stats.billetera - montoNum);
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal + montoNum);
        
        st.stats.totalAhorradoFisico = safeFloat(st.stats.totalAhorradoFisico - montoNum);
        st.stats.ahorroArsPuro = safeFloat(st.stats.ahorroArsPuro - montoNum);
        st.stats.ahorroHaciaBursatil = safeFloat(st.stats.ahorroHaciaBursatil - montoNum);
        st.stats.flowAhorro = safeFloat(st.stats.flowAhorro - montoNum);

        if (m.usd > 0) {
            st.stats.usdComprado = safeFloat(st.stats.usdComprado - parseFloat(m.usd));
            st.stats.costoUsdArs = safeFloat(st.stats.costoUsdArs - montoNum);
        }
    }
    else if (m.tipo === 'Aporte Capital') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal + montoNum);
        flujoExternoHoy = montoNum;

        st.stats.ingresosCapital = safeFloat((st.stats.ingresosCapital || 0) + montoNum);
        st.stats.entradasCajaNoOperativas = safeFloat(st.stats.entradasCajaNoOperativas + montoNum);
        st.stats.ingresosConsolidadosGlobal = safeFloat(st.stats.ingresosConsolidadosGlobal + montoNum);
    }
    else if (m.tipo === 'Retiro') {
        st.stats.billetera = safeFloat(st.stats.billetera - montoNum);
        st.stats.totalRetirado = safeFloat(st.stats.totalRetirado + montoNum);
        st.stats.ahorroArsPuro = safeFloat(st.stats.ahorroArsPuro - montoNum);
        flujoExternoHoy = -montoNum;
    } 
    else if (m.tipo === 'Compra') {
        st.stats.billetera = safeFloat(st.stats.billetera - montoNum); 
        st.stats.capInvertido = safeFloat(st.stats.capInvertido + montoNum);

        if (!st.portafolio[m.activo]) st.portafolio[m.activo] = { cant: 0, costo: 0, sector: m.sector || 'Otro' };
        st.portafolio[m.activo].cant = safeFloat(st.portafolio[m.activo].cant + cantNum);
        st.portafolio[m.activo].costo = safeFloat(st.portafolio[m.activo].costo + montoNum);
        
        if (!st.lotesCompra[m.activo]) st.lotesCompra[m.activo] = [];
        st.lotesCompra[m.activo].push({ cant: cantNum, fecha: new Date(m.fecha).getTime() });
    } 
    else if (m.tipo === 'Venta') {
        st.stats.billetera = safeFloat(st.stats.billetera + montoNum); 
        st.stats.flujoMensual[mesStr].ingresos = safeFloat(st.stats.flujoMensual[mesStr].ingresos + montoNum);
        let p = st.portafolio[m.activo];
        
        if (p && p.cant > 0.000001) {
            let operadoNum = Math.min(cantNum, p.cant); 
            
            let ppp = safeFloat(p.costo / p.cant);
            let costoDeVenta = safeFloat(operadoNum * ppp);
            let resultado = safeFloat(montoNum - costoDeVenta);
            
            let cantRestante = operadoNum;
            let lotes = st.lotesCompra[m.activo];
            let fechaVentaMs = new Date(m.fecha).getTime();
            
            while (cantRestante > 0 && lotes && lotes.length > 0) {
                let lote = lotes[0];
                let operadoLote = Math.min(cantRestante, lote.cant);
                let diasMantenido = (fechaVentaMs - lote.fecha) / 86400000; 
                
                st.stats.diasTenenciaTotal = safeFloat(st.stats.diasTenenciaTotal + (diasMantenido * operadoLote));
                st.stats.operacionesCerradas = safeFloat(st.stats.operacionesCerradas + operadoLote);

                lote.cant = safeFloat(lote.cant - operadoLote);
                cantRestante = safeFloat(cantRestante - operadoLote);
                
                if (lote.cant <= 0.0001) lotes.shift();
            }

            p.cant = safeFloat(p.cant - operadoNum); 
            p.costo = safeFloat(p.costo - costoDeVenta); 
            
            st.stats.capInvertido = safeFloat(st.stats.capInvertido - costoDeVenta);
            
            if (p.cant <= 0.0001) {
                st.stats.capInvertido = safeFloat(st.stats.capInvertido - p.costo); 
                p.cant = 0;
                p.costo = 0;
            }
            
            m.resultadoCalculado = resultado; 
            st.stats.ganRealizada = safeFloat(st.stats.ganRealizada + resultado); 
            st.stats.vTotal++; 
            if(resultado > 0) st.stats.vGanadas++;
            
            st.stats.rendimientoPorActivo[m.activo] = safeFloat((st.stats.rendimientoPorActivo[m.activo] || 0) + resultado);
            let sector = p.sector || 'Otro';
            st.stats.atribucionSector[sector] = safeFloat((st.stats.atribucionSector[sector] || 0) + resultado);
        }
    } 
    else if (m.tipo === 'Rendimiento' || m.tipo === 'Dividendo') {
        st.stats.billetera = safeFloat(st.stats.billetera + montoNum);
        st.stats.rendExtra = safeFloat(st.stats.rendExtra + montoNum);
    }
    else if (m.tipo === 'Ingreso Local') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal + montoNum);
        st.stats.ingresosLocal = safeFloat(st.stats.ingresosLocal + montoNum);
        st.stats.ingresosConsolidadosGlobal = safeFloat(st.stats.ingresosConsolidadosGlobal + montoNum);
        st.stats.flowIngreso = safeFloat(st.stats.flowIngreso + montoNum); 
        st.stats.flujoMensual[mesStr].ingresos = safeFloat(st.stats.flujoMensual[mesStr].ingresos + montoNum); 
        
        let costoVendidoEstimado = montoNum; 
        
        if (st.stats.stockValorVentaHistorico > 0 && st.stats.stockCostoHistorico > 0) {
            let ratioCostoHistorico = safeFloat(st.stats.stockCostoHistorico / st.stats.stockValorVentaHistorico);
            costoVendidoEstimado = safeFloat(montoNum * ratioCostoHistorico);
            st.stats.markupPromedio = safeFloat(st.stats.stockValorVentaHistorico / st.stats.stockCostoHistorico);
        }
        
        costoVendidoEstimado = Math.min(costoVendidoEstimado, st.stats.stockCosto);
        
        st.stats.stockCosto = safeFloat(Math.max(0, st.stats.stockCosto - costoVendidoEstimado));
        st.stats.stockValorVenta = safeFloat(Math.max(0, st.stats.stockValorVenta - montoNum));
        
        let [y, mo, da] = m.fecha.split('-');
        let d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(da, 10));
        let dayOfWeek = d.getDay();
        st.stats.ventasPorDiaSemana[dayOfWeek] = safeFloat((st.stats.ventasPorDiaSemana[dayOfWeek] || 0) + montoNum);
        st.diasOperadosPorDiaSemana[dayOfWeek].add(m.fecha);
    }
    else if (m.tipo === 'Gasto Local') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
        st.stats.gastosLocal = safeFloat(st.stats.gastosLocal + montoNum);
        st.stats.flowOperativo = safeFloat(st.stats.flowOperativo + montoNum);
        st.stats.gastosPorCategoriaLocal[m.categoria || 'Varios'] = safeFloat((st.stats.gastosPorCategoriaLocal[m.categoria || 'Varios'] || 0) + montoNum);
        st.stats.flujoMensual[mesStr].costoVida = safeFloat((st.stats.flujoMensual[mesStr].costoVida || 0) + montoNum);
    } 
    else if (m.tipo === 'Gasto Familiar') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
        st.stats.gastosFamiliar = safeFloat(st.stats.gastosFamiliar + montoNum);
        st.stats.flowVida = safeFloat(st.stats.flowVida + montoNum);
        st.stats.gastosPorCategoriaFamiliar[m.categoria || 'Varios'] = safeFloat((st.stats.gastosPorCategoriaFamiliar[m.categoria || 'Varios'] || 0) + montoNum);
        st.stats.flujoMensual[mesStr].costoVida = safeFloat((st.stats.flujoMensual[mesStr].costoVida || 0) + montoNum);
    } 
    else if (m.tipo === 'Pago Proveedor') {
        let prov = m.proveedor || 'Desconocido';
        let valorVentaInput = m.valorVentaEstimado ? safeFloat(m.valorVentaEstimado) : montoNum;
        
        st.stats.stockCosto = safeFloat(st.stats.stockCosto + montoNum);
        st.stats.stockValorVenta = safeFloat(st.stats.stockValorVenta + valorVentaInput);
        
        st.stats.stockCostoHistorico = safeFloat((st.stats.stockCostoHistorico || 0) + montoNum);
        st.stats.stockValorVentaHistorico = safeFloat((st.stats.stockValorVentaHistorico || 0) + valorVentaInput);
        
        if (!st.stats.proveedoresDetalle[prov]) st.stats.proveedoresDetalle[prov] = { total: 0, meses: {} };
        st.stats.proveedoresDetalle[prov].total = safeFloat(st.stats.proveedoresDetalle[prov].total + montoNum);
        st.stats.proveedoresDetalle[prov].meses[mesStr] = safeFloat((st.stats.proveedoresDetalle[prov].meses[mesStr] || 0) + montoNum);

        if (m.estadoPago === 'Pendiente') {
            let deudaId = m.deudaAsociadaId || ('PROV-' + m.id);
            st.stats.deudaProveedoresDetalle[deudaId] = {
                id: deudaId, proveedor: prov, fecha: m.fecha, capitalExigibleTotal: montoNum,
                capitalServido: 0, amortizacionPct: 0, activo: true
            };
        } else {
            st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
            st.stats.pagosProveedores = safeFloat(st.stats.pagosProveedores + montoNum);
            st.stats.flowProveedores = safeFloat(st.stats.flowProveedores + montoNum);
            st.stats.gastosPorProveedor[prov] = safeFloat((st.stats.gastosPorProveedor[prov] || 0) + montoNum);
            if (!st.stats.proveedoresMensual[prov]) st.stats.proveedoresMensual[prov] = {};
            st.stats.proveedoresMensual[prov][mesStr] = safeFloat((st.stats.proveedoresMensual[prov][mesStr] || 0) + montoNum);
        }
    } 
    else if (m.tipo === 'Amortización Deuda a Proveedor') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
        st.stats.pagosProveedores = safeFloat(st.stats.pagosProveedores + montoNum);
        st.stats.flowProveedores = safeFloat(st.stats.flowProveedores + montoNum);
        
        let prov = m.proveedor || 'Desconocido';
        st.stats.gastosPorProveedor[prov] = safeFloat((st.stats.gastosPorProveedor[prov] || 0) + montoNum);
        if (!st.stats.proveedoresMensual[prov]) st.stats.proveedoresMensual[prov] = {};
        st.stats.proveedoresMensual[prov][mesStr] = safeFloat((st.stats.proveedoresMensual[prov][mesStr] || 0) + montoNum);
        
        if (m.deudaAsociadaId && st.stats.deudaProveedoresDetalle[m.deudaAsociadaId]) {
            let deuda = st.stats.deudaProveedoresDetalle[m.deudaAsociadaId];
            deuda.capitalServido = safeFloat(deuda.capitalServido + montoNum);
            deuda.amortizacionPct = safeFloat((deuda.capitalServido / deuda.capitalExigibleTotal) * 100);
            if (deuda.capitalServido >= deuda.capitalExigibleTotal) {
                deuda.activo = false;
            }
        }
    }
    else if (m.tipo === 'Ajuste Stock Inicial') {
        let valorVentaInput = m.valorVentaEstimado ? safeFloat(m.valorVentaEstimado) : montoNum;
        
        st.stats.stockCosto = safeFloat(st.stats.stockCosto + montoNum);
        st.stats.stockValorVenta = safeFloat(st.stats.stockValorVenta + valorVentaInput);

        st.stats.stockCostoHistorico = safeFloat((st.stats.stockCostoHistorico || 0) + montoNum);
        st.stats.stockValorVentaHistorico = safeFloat((st.stats.stockValorVentaHistorico || 0) + valorVentaInput);
    }
    else if (m.tipo === 'Correccion Stock') {
        let valorVentaInput = m.valorVentaEstimado ? safeFloat(m.valorVentaEstimado) : montoNum;
        
        let deltaCosto = montoNum - st.stats.stockCosto;
        let deltaVenta = valorVentaInput - st.stats.stockValorVenta;

        st.stats.stockCosto = safeFloat(montoNum);
        st.stats.stockValorVenta = safeFloat(valorVentaInput);

        st.stats.stockCostoHistorico = safeFloat(Math.max(0, (st.stats.stockCostoHistorico || 0) + deltaCosto));
        st.stats.stockValorVentaHistorico = safeFloat(Math.max(0, (st.stats.stockValorVentaHistorico || 0) + deltaVenta));
    }
    else if (m.tipo === 'Reparto Sociedad') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
        st.stats.sociedadRetiros = safeFloat(st.stats.sociedadRetiros + montoNum);
        st.stats.flowSociedad = safeFloat(st.stats.flowSociedad + montoNum);
    }
    else if (m.tipo === 'Alta Préstamo') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal + montoNum);
        let capitalSolicitado = safeFloat(m.capital || montoNum);
        let totalDevolver = safeFloat(m.montoTotalDevolver || montoNum);
        st.stats.deudaActiva = safeFloat(st.stats.deudaActiva + totalDevolver);
        st.stats.prestamosDetalle[m.id] = {
            id: m.id, fecha: m.fecha, entidad: m.entidad || 'Entidad',
            capital: capitalSolicitado, totalDevolver: totalDevolver, pagado: 0, 
            cuotasTotales: parseInt(m.cuotas) || 1, cuotasPagadas: 0, 
            tasaInteres: capitalSolicitado > 0 ? ((totalDevolver - capitalSolicitado) / capitalSolicitado) * 100 : 0, 
            activo: true
        };
    } 
    else if (m.tipo === 'Pago Préstamo') {
        st.stats.cajaLocal = safeFloat(st.stats.cajaLocal - montoNum);
        st.stats.deudaActiva = Math.max(0, safeFloat(st.stats.deudaActiva - montoNum));
        st.stats.flujoMensual[mesStr].cuotas = safeFloat(st.stats.flujoMensual[mesStr].cuotas + montoNum);
        
        if (m.prestamoAsociado && st.stats.prestamosDetalle[m.prestamoAsociado]) {
            let prestamo = st.stats.prestamosDetalle[m.prestamoAsociado];
            prestamo.pagado = safeFloat(prestamo.pagado + montoNum);
            prestamo.cuotasPagadas += 1; 
            if (prestamo.pagado >= prestamo.totalDevolver) prestamo.activo = false;
        }
    }

    let currentPatrimonioTotal = safeFloat(st.stats.cajaLocal + st.stats.stockCosto + st.stats.billetera + st.stats.capInvertido);
    
    if (!st.firstDateMs) {
        st.firstDateMs = new Date(m.fecha).getTime();
        st.inflacionAcumuladaAbsoluta = flujoExternoHoy > 0 ? flujoExternoHoy : 0;
    } else {
        let daysElapsed = (new Date(m.fecha).getTime() - new Date(st.lastDate).getTime()) / 86400000;
        if (daysElapsed > 0 && st.dailyInfRate > 0) {
            st.inflacionAcumuladaAbsoluta = st.inflacionAcumuladaAbsoluta * Math.pow(1 + st.dailyInfRate, daysElapsed);
        }
        if (flujoExternoHoy !== 0) {
            st.inflacionAcumuladaAbsoluta += flujoExternoHoy;
            if (st.inflacionAcumuladaAbsoluta < 0) st.inflacionAcumuladaAbsoluta = 0;
        }
    }

    let msElapsedTotal = new Date(m.fecha).getTime() - st.firstDateMs;
    let monthsElapsedTotal = msElapsedTotal / 2629920000; 
    let avgVida = monthsElapsedTotal >= 1 ? (st.stats.gastosFamiliar + st.stats.gastosLocal) / monthsElapsedTotal : (st.stats.gastosFamiliar + st.stats.gastosLocal);

    if (m.fecha !== st.lastDate) {
        st.stats.historyPatrimonio.push(currentPatrimonioTotal);
        st.stats.historyPatrimonioConStock.push(currentPatrimonioTotal); 
        st.stats.historyLiquidez.push(safeFloat(st.stats.billetera + st.stats.cajaLocal));
        st.stats.historyInvertido.push(st.stats.capInvertido);
        st.stats.historyCajaLocal.push(st.stats.cajaLocal);
        st.stats.historyIngresosLocal.push(st.stats.ingresosLocal); 
        st.stats.historyFlujoNeto.push(safeFloat(st.stats.ingresosLocal - st.stats.gastosLocal - st.stats.pagosProveedores - st.stats.gastosFamiliar - st.stats.sociedadRetiros));
        st.stats.historyFechas.push(m.fecha);
        st.stats.historyPatrimonioPuro.push(safeFloat(st.stats.totalAhorradoFisico - st.stats.totalRetirado));
        st.stats.historyCostoVida.push(safeFloat(st.stats.gastosFamiliar + st.stats.gastosLocal));
        st.stats.historyInflacion.push(safeFloat(st.inflacionAcumuladaAbsoluta));
        st.stats.historyMediaVida.push(safeFloat(avgVida));
        st.stats.historyFlujoPatrimonial.push(safeFloat(flujoExternoHoy));
        st.lastDate = m.fecha;
    } else {
        let idx = st.stats.historyPatrimonio.length - 1;
        st.stats.historyPatrimonio[idx] = currentPatrimonioTotal;
        st.stats.historyPatrimonioConStock[idx] = currentPatrimonioTotal;
        st.stats.historyLiquidez[idx] = safeFloat(st.stats.billetera + st.stats.cajaLocal);
        st.stats.historyInvertido[idx] = st.stats.capInvertido;
        st.stats.historyCajaLocal[idx] = st.stats.cajaLocal;
        st.stats.historyIngresosLocal[idx] = st.stats.ingresosLocal;
        st.stats.historyFlujoNeto[idx] = safeFloat(st.stats.ingresosLocal - st.stats.gastosLocal - st.stats.pagosProveedores - st.stats.gastosFamiliar - st.stats.sociedadRetiros);
        st.stats.historyPatrimonioPuro[idx] = safeFloat(st.stats.totalAhorradoFisico - st.stats.totalRetirado);
        st.stats.historyCostoVida[idx] = safeFloat(st.stats.gastosFamiliar + st.stats.gastosLocal);
        st.stats.historyInflacion[idx] = safeFloat(st.inflacionAcumuladaAbsoluta);
        st.stats.historyMediaVida[idx] = safeFloat(avgVida);
        st.stats.historyFlujoPatrimonial[idx] = safeFloat(st.stats.historyFlujoPatrimonial[idx] + flujoExternoHoy);
    }
}

function finalizeMetrics() {
    st.stats.holdingPeriodDias = st.stats.operacionesCerradas > 0 ? (st.stats.diasTenenciaTotal / st.stats.operacionesCerradas) : 0;
    st.stats.ratioEfectivoInvertido = st.stats.capInvertido > 0 ? (st.stats.billetera / st.stats.capInvertido) : 0;
    st.stats.precioPromedioDolar = st.stats.usdComprado > 0 ? safeFloat(st.stats.costoUsdArs / st.stats.usdComprado) : 0;

    let cashFlowsTIR = [];
    st.movimientos.forEach(m => {
        if (m.tipo === 'Ahorro' || m.tipo === 'Transferencia Ahorro') cashFlowsTIR.push({ date: new Date(m.fecha + "T00:00:00").getTime(), amount: -safeFloat(m.monto) });
        else if (m.tipo === 'Retiro') cashFlowsTIR.push({ date: new Date(m.fecha + "T00:00:00").getTime(), amount: safeFloat(m.monto) });
    });
    
    if (cashFlowsTIR.length > 0) {
        let lastVal = st.stats.historyPatrimonioPuro[st.stats.historyPatrimonioPuro.length - 1] || 0;
        cashFlowsTIR.push({ date: new Date().getTime(), amount: lastVal });
        
        let firstDate = cashFlowsTIR[0].date;
        let lastDate = cashFlowsTIR[cashFlowsTIR.length - 1].date;
        let daysDiff = (lastDate - firstDate) / 86400000;
        
        if (daysDiff < 365) {
            let totalInvested = cashFlowsTIR.filter(c => c.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
            if (totalInvested > 0) { 
                let totalRetrieved = cashFlowsTIR.filter(c => c.amount > 0 && c.date !== lastDate).reduce((a, b) => a + b.amount, 0);
                st.stats.cagr = safeFloat(((lastVal + totalRetrieved - totalInvested) / totalInvested) * 100);
            } else {
                st.stats.cagr = 0;
            }
        } else {
            st.stats.cagr = safeFloat(FinancialMath.calculateXIRR(cashFlowsTIR, 0.1) * 100); 
        }
    } else {
        st.stats.cagr = 0;
    }

    let hhiMetrics = FinancialMath.calcularConcentrationRisk(Object.values(st.stats.atribucionSector));
    st.stats.riesgoConcentracion = { hhi: safeFloat(hhiMetrics.hhi), label: hhiMetrics.label };

    let len = st.stats.historyPatrimonio.length;
    if (len > 2) {
        let retornosDiarios = [];
        for (let i = 1; i < len; i++) {
            let prev = st.stats.historyPatrimonio[i - 1];
            let current = st.stats.historyPatrimonio[i];
            let flujo = st.stats.historyFlujoPatrimonial[i] || 0;
            let base = prev + flujo;
            retornosDiarios.push(base > 0 ? (current - base) / base : 0);
        }
        
        let daysDiff = st.firstDateMs ? (new Date(st.lastDate).getTime() - st.firstDateMs) / 86400000 : 365;
        let riskMetrics = FinancialMath.calcularRiesgoTWR(retornosDiarios, 0.05, Math.max(1, daysDiff));
        
        st.stats.riesgo = { sharpe: riskMetrics.sharpe.toFixed(2), sortino: riskMetrics.sortino.toFixed(2), volatilidad: (riskMetrics.volatilidad * 100).toFixed(2) };
    }

    st.stats.totalPedidoPrestamos = 0;
    st.stats.totalDevolverPrestamos = 0;
    st.stats.totalCuotaMensualPrestamos = 0;
    let sumTasaActiva = 0;
    let countPrestamosActivos = 0;

    for (let key in st.stats.prestamosDetalle) {
        let p = st.stats.prestamosDetalle[key];
        if (p.activo) {
            st.stats.totalPedidoPrestamos += safeFloat(p.capital);
            st.stats.totalDevolverPrestamos += safeFloat(p.totalDevolver - p.pagado);
            st.stats.totalCuotaMensualPrestamos += safeFloat(p.totalDevolver / (p.cuotasTotales || 1));
            sumTasaActiva += safeFloat(p.tasaInteres);
            countPrestamosActivos++;
        }
    }
    st.stats.tasaPromedioPrestamos = countPrestamosActivos > 0 ? safeFloat(sumTasaActiva / countPrestamosActivos) : 0;
    
    let numMeses = st.mesesOperativos.size || 1;
    st.stats.numMesesOperativos = numMeses;
    st.stats.gastoPersonalPromedioMes = safeFloat((st.stats.gastosFamiliar / numMeses) || 0);
    st.stats.tasaAhorroReal = st.stats.ingresosLocal > 0 ? ((st.stats.ahorroHaciaBursatil / st.stats.ingresosLocal) * 100) : 0;

    let egresoComercialPuro = safeFloat(st.stats.gastosLocal + st.stats.pagosProveedores);
    let gastosTotalesPromedioMensual = safeFloat((egresoComercialPuro + st.stats.sociedadRetiros + st.stats.gastosFamiliar) / numMeses);
    
    st.stats.fondoSupervivenciaMeses = gastosTotalesPromedioMensual > 0 ? (st.stats.cajaLocal / gastosTotalesPromedioMensual) : 0;
    
    let pasivosCortoPlazoEstimados = gastosTotalesPromedioMensual > 0 ? gastosTotalesPromedioMensual : 1; 
    let liquidezDisponibleCaja = Math.max(0, st.stats.cajaLocal + st.stats.billetera);
    st.stats.liquidezAcida = safeFloat(liquidezDisponibleCaja / pasivosCortoPlazoEstimados);
    st.stats.liquidezCorriente = safeFloat((liquidezDisponibleCaja + st.stats.stockCosto) / pasivosCortoPlazoEstimados);
    
    st.stats.cargaFinancieraPct = 0;
    let totalCuotasPagadas = 0;
    for (let mes in st.stats.flujoMensual) totalCuotasPagadas += st.stats.flujoMensual[mes].cuotas;
    if (st.stats.ingresosLocal > 0) st.stats.cargaFinancieraPct = (totalCuotasPagadas / st.stats.ingresosLocal) * 100;

    st.stats.gananciaNetaTotal = safeFloat(st.stats.ingresosLocal - egresoComercialPuro - st.stats.sociedadRetiros);
    let gananciaNetaMensualPromedio = safeFloat(st.stats.gananciaNetaTotal / numMeses);
    st.stats.esfuerzo = FinancialMath.calcularEsfuerzoFisico(gananciaNetaMensualPromedio);

    let gananciaBrutaMensualPromedio = safeFloat(st.stats.ingresosLocal / numMeses);
    st.stats.esfuerzoBruto = FinancialMath.calcularEsfuerzoFisico(gananciaBrutaMensualPromedio);

    st.stats.fugaCapitalMonto = safeFloat(st.stats.gastosFamiliar); 
    if (st.stats.gananciaNetaTotal > 0) {
        st.stats.fugaPersonalPct = safeFloat((st.stats.gastosFamiliar / st.stats.gananciaNetaTotal) * 100);
    } else {
        st.stats.fugaPersonalPct = 0; 
    }
    
    let gastoOperativoMensualPuro = egresoComercialPuro / numMeses;
    let ingresosDiariosPromedio = st.stats.ingresosLocal / (numMeses * 30.44); 
    st.stats.puntoEquilibrioHistorico = ingresosDiariosPromedio > 0 ? Math.min(30, Math.ceil(gastoOperativoMensualPuro / ingresosDiariosPromedio)) : 0;

    let cajaMinimaSegura = gastoOperativoMensualPuro * 1.5; 
    if (st.stats.cajaLocal > cajaMinimaSegura) {
        st.stats.sweepSugerido = safeFloat(st.stats.cajaLocal - cajaMinimaSegura);
    } else {
        st.stats.sweepSugerido = 0; 
    }
    
    let ingresosPasivosMensual = safeFloat(st.stats.rendExtra / numMeses);
    st.stats.crossoverPct = st.stats.gastoPersonalPromedioMes > 0 ? safeFloat((ingresosPasivosMensual / st.stats.gastoPersonalPromedioMes) * 100) : 0;
    st.stats.horasLibresRegaladas = st.stats.esfuerzo.hora > 0 ? safeFloat(ingresosPasivosMensual / st.stats.esfuerzo.hora) : 0;

    for(let i=0; i<=6; i++) {
        let total = st.stats.ventasPorDiaSemana[i];
        let dias = st.diasOperadosPorDiaSemana[i].size;
        st.stats.termometroDias[i] = dias > 0 ? safeFloat(total / dias) : 0;
    }

    let labelsVentas = [];
    let dataVentas = [];
    let dataCostoVida = [];
    let mesesOrdenados = Object.keys(st.stats.flujoMensual).sort();
    
    let cumulativeVida = 0;
    let countMeses = 0;

    for (let mes of mesesOrdenados) {
        labelsVentas.push(mes);
        dataVentas.push(safeFloat(st.stats.flujoMensual[mes].ingresos));
        
        cumulativeVida += safeFloat(st.stats.flujoMensual[mes].costoVida || 0);
        countMeses++;
        let promedioVidaHistorico = cumulativeVida / countMeses;
        dataCostoVida.push(safeFloat(promedioVidaHistorico));
    }
    st.stats.ventasMensuales = { labels: labelsVentas, data: dataVentas, dataCostoVida: dataCostoVida };

    let score = 0;
    score += Math.min(300, (st.stats.fondoSupervivenciaMeses / 6) * 300);
    score += Math.max(0, 300 - (st.stats.cargaFinancieraPct / 50) * 300);
    score += Math.min(200, (st.stats.tasaAhorroReal / 20) * 200);
    score += st.stats.riesgoConcentracion.hhi === 0 ? 0 : Math.max(0, 200 - ((Math.max(0, st.stats.riesgoConcentracion.hhi - 1000)) / 2500) * 200);
    st.stats.healthScore = Math.round(score);
}

function runFullProcess(movimientosArray, inflacionINDEC = {}) {
    st.stats = getEmptyStats();
    st.portafolio = {}; st.lotesCompra = {};
    st.lastDate = null; st.firstDateMs = 0; st.inflacionAcumuladaAbsoluta = 0;
    st.mesesOperativos = new Set();
    st.diasOperadosPorDiaSemana = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set(), 0: new Set() };
    st.movimientos = movimientosArray;
    
    let infData = FinancialMath.proyectarInflacion(inflacionINDEC);
    st.avgInflacionMensual = infData.avgMensual;
    st.dailyInfRate = infData.tasaDiaria;
    
    sortMovimientos(st.movimientos);
    st.movimientos.forEach(processSingle);
    
    if (st.lastDate) {
        let todayDateStr = new Date().toISOString().split('T')[0];
        
        if (st.lastDate < todayDateStr) {
            let lastIdx = st.stats.historyPatrimonio.length - 1;
            
            let daysElapsed = (new Date(todayDateStr).getTime() - new Date(st.lastDate).getTime()) / 86400000;
            let finalInf = st.inflacionAcumuladaAbsoluta;
            if (daysElapsed > 0 && st.dailyInfRate > 0) {
                finalInf = finalInf * Math.pow(1 + st.dailyInfRate, daysElapsed);
            }

            st.stats.historyFechas.push(todayDateStr);
            st.stats.historyInflacion.push(safeFloat(finalInf));
            
            st.stats.historyMediaVida.push(st.stats.historyMediaVida[lastIdx]);
            st.stats.historyPatrimonio.push(st.stats.historyPatrimonio[lastIdx]);
            st.stats.historyPatrimonioConStock.push(st.stats.historyPatrimonioConStock[lastIdx]);
            st.stats.historyLiquidez.push(st.stats.historyLiquidez[lastIdx]);
            st.stats.historyInvertido.push(st.stats.historyInvertido[lastIdx]);
            st.stats.historyCajaLocal.push(st.stats.historyCajaLocal[lastIdx]);
            st.stats.historyIngresosLocal.push(st.stats.historyIngresosLocal[lastIdx]);
            st.stats.historyFlujoNeto.push(st.stats.historyFlujoNeto[lastIdx]);
            st.stats.historyPatrimonioPuro.push(st.stats.historyPatrimonioPuro[lastIdx]);
            st.stats.historyCostoVida.push(st.stats.historyCostoVida[lastIdx]);
            st.stats.historyFlujoPatrimonial.push(st.stats.historyFlujoPatrimonial[lastIdx]);
        }
    }

    finalizeMetrics();
    self.postMessage({ type: 'ENGINE_RESULT', payload: { stats: st.stats, portafolio: st.portafolio, movimientosOrdenados: st.movimientos } });
}

self.onmessage = function(e) {
    const { type, ...data } = e.data;
    
    if (type === 'FULL_PROCESS') {
        runFullProcess(data.movimientos, data.inflacionINDEC);
    } 
    else if (type === 'ADD_DELTA') {
        const mov = data.movimiento;
        st.movimientos.push(mov);
        
        runFullProcess(st.movimientos, data.inflacionINDEC);
    } 
    else if (type === 'PROCESS_WATCHLIST') {
        let result = data.watchlist.map(w => {
            let apiDataObj = data.precios[w.activo];
            let pActual = apiDataObj && apiDataObj.data ? apiDataObj.data.price : null;
            return { activo: w.activo, precioObjetivo: w.precioObjetivo, precioActual: pActual, distancia: pActual ? ((w.precioObjetivo - pActual) / pActual) * 100 : null };
        });
        self.postMessage({ type: 'WATCHLIST_RESULT', payload: result });
    }
};