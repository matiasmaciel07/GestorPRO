"use strict";
import { ToastManager } from './views/ToastManager.js';
import { UIMetrics } from './views/UIMetrics.js';
import { ChartRenderer } from './views/ChartRenderer.js';
import { events } from './utils/events.js';
import { debounce } from './utils/helpers.js';
import { ErrorHandler } from './utils/ErrorHandler.js';

export const view = {
    DOM: {}, calMes: new Date().getMonth(), calAno: new Date().getFullYear(),
    currentModelData: null, activeTab: 'dashboard', activeFilter: 'MAX',
    historialData: [], historialFiltros: null, vsRowHeight: 45, 
    sectorColors: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f97316', '#6366f1'],
    chartTermometro: null,
    zenMode: false,

    toast: (msg, tipo) => ToastManager.show(msg, tipo),
    parseNumber: (str) => UIMetrics.parseNumber(str),
    fmtStr: (num, db, v) => UIMetrics.fmtStr(num, db, v),
    fmt: (num, db, v) => UIMetrics.fmt(num, db, v),
    
    cleanNum: (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = String(val).replace(/[^0-9,-]/g, ''); 
        str = str.replace(/,/g, '.');
        return parseFloat(str) || 0;
    },

    getBadgeClass(tipo) {
        switch (tipo) {
            case 'Ingreso Local': return 'bg-ingreso-local';
            case 'Transferencia Ahorro':
            case 'Ahorro': return 'bg-ahorro-transf';
            case 'Compra': return 'bg-compra';
            case 'Venta': return 'bg-venta';
            case 'Rendimiento':
            case 'Dividendo': return 'bg-rendimiento';
            case 'Gasto Local': return 'bg-gasto-local';
            case 'Gasto Familiar': return 'bg-gasto-vida';
            case 'Pago Proveedor': return 'bg-proveedor';
            case 'Amortización Deuda a Proveedor': return 'bg-proveedor';
            case 'Reparto Sociedad': return 'bg-sociedad';
            case 'Ajuste Stock Inicial': return 'bg-ahorro-transf';
            case 'Alta Préstamo': return 'bg-prestamo-alta';
            case 'Pago Préstamo': return 'bg-prestamo-pago';
            case 'Retiro': return 'bg-retiro';
            default: return 'bg-rendimiento';
        }
    },
    
    initUI() {
        this.cacheDOM();
        this.bindUIEvents();
        this.bindBusinessEvents();
        this.setupSystemListeners();
        this.initFiltrosGastos(); 
        this.initExportacionPDF(); 
        
        this.DOM.opFecha.value = new Date().toISOString().split('T')[0];
        if(this.DOM.ecoFecha) this.DOM.ecoFecha.value = new Date().toISOString().split('T')[0];
        
        if(this.DOM.dashRatioEI) this.DOM.dashRatioEI.style.display = 'none';

        const iconSvg = document.getElementById('icon-privacy-toggle');
        if (iconSvg) {
            iconSvg.innerHTML = document.body.classList.contains('privacy-active') ? `<use href="#icon-privacy-off"></use>` : `<use href="#icon-privacy"></use>`;
        }

        document.querySelectorAll('.format-number').forEach(input => {
            input.addEventListener('input', function() {
                let clean = this.value.replace(/[^0-9,]/g, '');
                let parts = clean.split(',');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                if(parts.length > 2) parts.pop();
                this.value = parts.join(',');
            });
        });
    },

    cacheDOM() {
        this.DOM = {
            tituloOperarBursatil: document.getElementById('titulo-operar-bursatil'),
            tituloOperarEco: document.getElementById('titulo-operar-eco'),
            tituloConfirmar: document.getElementById('titulo-confirmar'),
            btnGuardarOp: document.getElementById('btn-guardar-op'),
            btnCancelarEdicion: document.getElementById('btn-cancelar-edicion'),
            lblDolar: document.getElementById('lbl-dolar'),
            btnToggleMoneda: document.getElementById('btn-toggle-moneda'),
            dashTotal: document.getElementById('dash-total'),
            dashLiquidez: document.getElementById('dash-liquidez'),
            dashLiquidezSub: document.getElementById('dash-liquidez-sub'),
            dashInvertido: document.getElementById('dash-invertido'),
            dashGanancia: document.getElementById('dash-ganancia'),
            dashPasivos: document.getElementById('dash-pasivos'),
            dashWinrate: document.getElementById('dash-winrate'),
            dashTop: document.getElementById('dash-top'),
            dashHealthScore: document.getElementById('dash-health-score'),
            dashHealthLabel: document.getElementById('dash-health-label'),
            dashRatioEI: document.getElementById('dash-ratio-ei'),
            infoHoldingPeriod: document.getElementById('info-holding-period'),
            infoAtribucionSector: document.getElementById('info-atribucion-sector'),
            lblPatSub1: document.getElementById('lbl-pat-sub1'),
            valPatSub1: document.getElementById('val-pat-sub1'),
            lblPatSub2: document.getElementById('lbl-pat-sub2'),
            valPatSub2: document.getElementById('val-pat-sub2'),
            lblLiqSub1: document.getElementById('lbl-liq-sub1'),
            valLiqSub1: document.getElementById('val-liq-sub1'),
            lblLiqSub2: document.getElementById('lbl-liq-sub2'),
            valLiqSub2: document.getElementById('val-liq-sub2'),
            lblInvSub1: document.getElementById('lbl-inv-sub1'),
            valInvSub1: document.getElementById('val-inv-sub1'),
            lblInvSub2: document.getElementById('lbl-inv-sub2'),
            valInvSub2: document.getElementById('val-inv-sub2'),
            btnToggleBursatil: document.getElementById('btn-toggle-bursatil'),
            btnToggleEconomia: document.getElementById('btn-toggle-economia'),
            wrapBursatil: document.getElementById('wrap-bursatil'),
            wrapEconomia: document.getElementById('wrap-economia'),
            opTipo: document.getElementById('op-tipo'),
            opFecha: document.getElementById('op-fecha'),
            opActivo: document.getElementById('op-activo'),
            opSector: document.getElementById('op-sector'),
            opCantidad: document.getElementById('op-cantidad'),
            opMonto: document.getElementById('op-monto'),
            opUsd: document.getElementById('op-usd'),
            opNotas: document.getElementById('op-notas'),
            bloqueActivo: document.getElementById('bloque-activo'),
            grupoSector: document.getElementById('grupo-sector'),
            bloqueDolares: document.getElementById('bloque-dolares'),
            lblMonto: document.getElementById('lbl-monto'),
            hintCantidad: document.getElementById('hint-cantidad'),
            ecoTipo: document.getElementById('eco-tipo'),
            ecoFecha: document.getElementById('eco-fecha'),
            bloqueCategoriasEco: document.getElementById('bloque-categorias-eco'),
            grupoEcoCategoria: document.getElementById('grupo-eco-categoria'),
            ecoCategoria: document.getElementById('eco-categoria'),
            grupoEcoProveedor: document.getElementById('grupo-eco-proveedor'),
            ecoProveedor: document.getElementById('eco-proveedor'),
            ecoNotas: document.getElementById('eco-notas'),
            rowEcoEstadoPago: document.getElementById('row-eco-estado-pago'),
            ecoEstadoPago: document.getElementById('eco-estado-pago'),
            rowEcoValorVenta: document.getElementById('row-eco-valor-venta'),
            ecoValorVenta: document.getElementById('eco-valor-venta'),
            bloquePagoDeudaProveedor: document.getElementById('bloque-pago-deuda-proveedor'),
            ecoDeudaProveedorId: document.getElementById('eco-deuda-proveedor-id'),
            bloquePrestamosAlta: document.getElementById('bloque-prestamos-alta'),
            bloquePrestamosPago: document.getElementById('bloque-prestamos-pago'),
            ecoPrestamoEntidad: document.getElementById('eco-prestamo-entidad'),
            ecoPrestamoTotal: document.getElementById('eco-prestamo-total'),
            ecoPrestamoId: document.getElementById('eco-prestamo-id'),
            tbodyProveedores: document.getElementById('tbody-proveedores'),
            tbodyDeudasProveedores: document.getElementById('tbody-deudas-proveedores'),
            tbodyPrestamos: document.getElementById('tbody-prestamos'),
            ecoMonto: document.getElementById('eco-monto'),
            lblMontoEco: document.getElementById('lbl-monto-eco'),
            tbodyPortafolio: document.getElementById('tbody-portafolio'),
            tplPortafolio: document.getElementById('tpl-portafolio-row'),
            tbodyWatchlist: document.getElementById('tbody-watchlist'),
            divBar: document.getElementById('div-bar'),
            divLabels: document.getElementById('div-labels'),
            calcInicial: document.getElementById('calc-inicial'),
            calcMensual: document.getElementById('calc-mensual'),
            calcAnos: document.getElementById('calc-anos'),
            calcTasa: document.getElementById('calc-tasa'),
            calcResAportado: document.getElementById('calc-res-aportado'),
            calcResInteres: document.getElementById('calc-res-interes'),
            calcResFinal: document.getElementById('calc-res-final'),
            wrapCalc: document.getElementById('wrap-calc'), 
            histAhorroTotal: document.getElementById('hist-ahorro-total'),
            histRetiroTotal: document.getElementById('hist-retiro-total'),
            histNeto: document.getElementById('hist-neto'),
            vsViewport: document.getElementById('vs-viewport'),
            vsSpacer: document.getElementById('vs-spacer'),
            vsTable: document.getElementById('vs-table'),
            vsTbody: document.getElementById('vs-tbody'),
            tplHistorial: document.getElementById('tpl-historial-row'),
            histEmpty: document.getElementById('historial-empty'),
            calMesAno: document.getElementById('cal-mes-ano'),
            calDias: document.getElementById('cal-dias'),
            calDetalle: document.getElementById('cal-detalle'),
            tplCalDay: document.getElementById('tpl-calendar-day'),
            infoSharpe: document.getElementById('info-sharpe'),
            infoSortino: document.getElementById('info-sortino'),
            infoVolatilidad: document.getElementById('info-volatilidad'),
            valCorrelacion: document.getElementById('val-correlacion'),
            descCorrelacion: document.getElementById('desc-correlacion'),
            metStockCosto: document.getElementById('met-stock-costo'),
            metStockRetail: document.getElementById('met-stock-retail'),
            metRatioLiquidez: document.getElementById('met-ratio-liquidez'),
            metHedgeStock: document.getElementById('met-hedge-stock'),
            metFugaMonto: document.getElementById('met-fuga-monto'),
            metFugaPct: document.getElementById('met-fuga-pct'),
            metSweepMonto: document.getElementById('met-sweep-monto'),
            metEquilibrioDia: document.getElementById('met-equilibrio-dia'),
            barEquilibrio: document.getElementById('bar-equilibrio'),
            metCrossoverPct: document.getElementById('met-crossover-pct'),
            barCrossover: document.getElementById('bar-crossover'),
            lblCrossoverDetalles: document.getElementById('lbl-crossover-detalles'),
            wrapTermometroDias: document.getElementById('wrap-termometro-dias'),
            flowValIngreso: document.getElementById('flow-val-ingreso'),
            flowValOperativo: document.getElementById('flow-val-operativo'),
            flowPctOperativo: document.getElementById('flow-pct-operativo'),
            flowValProveedores: document.getElementById('flow-val-proveedores'),
            flowPctProveedores: document.getElementById('flow-pct-proveedores'),
            flowValSociedad: document.getElementById('flow-val-sociedad'),
            flowPctSociedad: document.getElementById('flow-pct-sociedad'),
            flowValVida: document.getElementById('flow-val-vida'),
            flowPctVida: document.getElementById('flow-pct-vida'),
            flowValAhorro: document.getElementById('flow-val-ahorro'),
            flowPctAhorro: document.getElementById('flow-pct-ahorro'),
            metIngresoLocal: document.getElementById('met-ingreso-local'),
            metEgresoLocal: document.getElementById('met-egreso-local'),
            metTasaAhorro: document.getElementById('met-tasa-ahorro'),
            metSupervivencia: document.getElementById('met-supervivencia'),
            metCargaPct: document.getElementById('met-carga-pct'),
            barCarga: document.getElementById('bar-carga'),
            lblCargaEstado: document.getElementById('lbl-carga-estado'),
            esfuerzoMes: document.getElementById('esfuerzo-mes'),
            esfuerzoSemana: document.getElementById('esfuerzo-semana'),
            esfuerzoDia: document.getElementById('esfuerzo-dia'),
            esfuerzoHora: document.getElementById('esfuerzo-hora'),
            simVentas: document.getElementById('sim-ventas'),
            simBolsa: document.getElementById('sim-bolsa'),
            valSimVentas: document.getElementById('val-sim-ventas'),
            valSimBolsa: document.getElementById('val-sim-bolsa'),
            resSimMeses: document.getElementById('res-sim-meses')
        };
    },

    bindUIEvents() {
        this.DOM.btnToggleBursatil?.addEventListener('click', () => {
            this.DOM.btnToggleBursatil.classList.add('active');
            this.DOM.btnToggleEconomia.classList.remove('active');
            this.DOM.wrapBursatil.classList.remove('is-hidden');
            this.DOM.wrapEconomia.classList.add('is-hidden');
            this.adaptarFormularioOperar();
        });

        this.DOM.btnToggleEconomia?.addEventListener('click', () => {
            this.DOM.btnToggleEconomia.classList.add('active');
            this.DOM.btnToggleBursatil.classList.remove('active');
            this.DOM.wrapEconomia.classList.remove('is-hidden');
            this.DOM.wrapBursatil.classList.add('is-hidden');
            this.adaptarFormularioEconomia();
        });

        this.DOM.opTipo?.addEventListener('change', () => this.adaptarFormularioOperar());
        this.DOM.ecoTipo?.addEventListener('change', () => this.adaptarFormularioEconomia());

        this.DOM.opActivo?.addEventListener('input', () => this.validarVentaRestrictiva());
        this.DOM.opCantidad?.addEventListener('input', () => this.validarVentaRestrictiva());

        if(this.DOM.simVentas) this.DOM.simVentas.addEventListener('input', () => this.renderSimuladorWhatIf());
        if(this.DOM.simBolsa) this.DOM.simBolsa.addEventListener('input', () => this.renderSimuladorWhatIf());

        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const btnNav = target.closest('.nav__item');
            const btnFilter = target.closest('.btn--filter');
            
            if (btnNav) events.emit('ui:cambiar-pestana', btnNav.getAttribute('aria-controls'));
            
            if (btnFilter && !target.closest('.gastos-filter-group')) {
                events.emit('ui:set-filtro', btnFilter.dataset.filter);
            }
            
            if (target.id === 'btn-toggle-moneda') events.emit('ui:toggle-moneda');
            if (target.closest('#btn-sidebar-toggle')) document.getElementById('sidebar').classList.toggle('sidebar--collapsed');
            if (target.closest('#btn-privacy')) this.togglePrivacy();
            if (target.closest('#btn-save-manual')) events.emit('ui:guardar-manual');
            if (target.closest('#btn-zen')) events.emit('ui:toggle-zen');
            
            if (target.closest('#btn-theme')) {
                const htmlEl = document.documentElement;
                const newTheme = htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                htmlEl.setAttribute('data-theme', newTheme);
                document.getElementById('icon-theme-toggle').innerHTML = newTheme === 'dark' ? `<use href="#icon-sun"></use>` : `<use href="#icon-moon"></use>`;
            }
        });

        const debouncedCalc = debounce(() => this.calcularInteres(), 300);
        document.querySelectorAll('.calc-input').forEach(input => input.addEventListener('input', debouncedCalc));

        const debouncedFire = debounce(() => this.calcularFIRE(), 300);
        document.querySelectorAll('.fire-input').forEach(input => input.addEventListener('input', debouncedFire));

        let isVirtualScrolling = false;
        this.DOM.vsViewport.addEventListener('scroll', () => {
            if (this.activeTab === 'historial') {
                if (!isVirtualScrolling) {
                    window.requestAnimationFrame(() => {
                        this.renderVirtualScroll();
                        isVirtualScrolling = false;
                    });
                    isVirtualScrolling = true;
                }
            }
        }, { passive: true });
    },

    bindBusinessEvents() {
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const actionBtn = target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                if (action === 'guardar-operacion') events.emit('ui:guardar-operacion', this.getOperacionFormData());
                if (action === 'editar-operacion') events.emit('ui:editar-operacion', actionBtn.dataset.id);
                if (action === 'cancelar-edicion') events.emit('ui:cancelar-edicion');
                if (action === 'borrar-operacion' && confirm("¿Borrar este registro permanentemente?")) events.emit('ui:borrar-operacion', actionBtn.dataset.id);
                if (action === 'add-watchlist') events.emit('ui:add-watchlist', { activo: DOMPurify.sanitize(document.getElementById('wl-activo').value.trim().toUpperCase()), precio: parseFloat(document.getElementById('wl-precio').value) });
                if (action === 'del-watchlist') events.emit('ui:del-watchlist', actionBtn.dataset.id);
                if (action === 'filtrar-historial') events.emit('ui:filtrar-historial', { desde: document.getElementById('filtro-desde').value, hasta: document.getElementById('filtro-hasta').value, tipo: document.getElementById('filtro-tipo').value });
                
                if (action === 'limpiar-filtros') {
                    document.getElementById('filtro-desde').value = '';
                    document.getElementById('filtro-hasta').value = '';
                    document.getElementById('filtro-tipo').value = 'Todos';
                    events.emit('ui:filtrar-historial', null);
                }
                
                if (action === 'guardar-inflacion') {
                    let inputVal = document.getElementById('inf-val').value;
                    let valParsed = parseFloat(inputVal.replace(',', '.'));
                    events.emit('ui:guardar-inflacion', { mes: DOMPurify.sanitize(document.getElementById('inf-mes').value), val: valParsed });
                }
                if (action === 'borrar-inflacion' && confirm(`¿Borrar dato de ${actionBtn.dataset.mes}?`)) events.emit('ui:borrar-inflacion', actionBtn.dataset.mes);
                
                if (action === 'verificar-pin') events.emit('ui:verificar-pin', document.getElementById('input-pin-login').value);
                if (action === 'guardar-pin') events.emit('ui:guardar-pin', document.getElementById('nuevo-pin').value);
                if (action === 'eliminar-pin') {
                    let p = prompt("Ingresa tu PIN actual:");
                    if(p !== null) events.emit('ui:eliminar-pin', p);
                }
                
                if (action === 'exportar') events.emit('ui:exportar');
                if (action === 'borrar-todo' && prompt("Escribe BORRAR") === 'BORRAR') events.emit('ui:borrar-todo');
                if (action === 'cambiar-mes') this.cambiarMesCalendario(parseInt(actionBtn.dataset.dir));
            }
        });

        document.getElementById('file-import')?.addEventListener('change', (e) => {
            if(e.target.files.length > 0) events.emit('ui:importar-backup', e.target.files[0]);
        });
    },

    initFiltrosGastos() {
        const attachFilters = (containerId, contexto, targetDomId) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn--filter');
                if (!btn) return;

                container.querySelectorAll('.btn--filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                events.emit('ui:actualizar-distribucion-gastos', {
                    contexto: contexto,
                    temporalidad: btn.dataset.filter,
                    domId: targetDomId
                });
            });
        };

        attachFilters('filtros-gastos-local', 'Local', 'wrap-gastos-local');
        attachFilters('filtros-gastos-personal', 'Personal', 'wrap-gastos-personal');
    },

    initExportacionPDF() {
        const btnExportarPdf = document.getElementById('btn-exportar-pdf');
        if (btnExportarPdf) {
            btnExportarPdf.addEventListener('click', () => {
                const filtroTemporalidad = document.getElementById('pdf-filtro-temporalidad')?.value || 'Histórico';
                const filtroTipo = document.getElementById('pdf-filtro-tipo')?.value || 'Todos';

                events.emit('ui:exportar-pdf', {
                    temporalidad: filtroTemporalidad,
                    tipo: filtroTipo
                });
            });
        }
    },

    getOperacionFormData() {
        const isBursatil = document.getElementById('btn-toggle-bursatil')?.classList.contains('active') !== false;
        let formData = {};
        
        if (isBursatil) {
            formData = {
                tipo: DOMPurify.sanitize(this.DOM.opTipo.value),
                fecha: DOMPurify.sanitize(this.DOM.opFecha.value),
                activo: DOMPurify.sanitize(this.DOM.opActivo.value.trim().toUpperCase()),
                sector: DOMPurify.sanitize(this.DOM.opSector.value.trim()),
                cant: parseFloat(this.DOM.opCantidad.value) || 0,
                monto: this.parseNumber(this.DOM.opMonto.value),
                usd: parseFloat(this.DOM.opUsd.value) || 0
            };
        } else {
            let t = this.DOM.ecoTipo.value;
            formData = {
                tipo: DOMPurify.sanitize(t),
                fecha: DOMPurify.sanitize(this.DOM.ecoFecha.value),
                monto: this.parseNumber(this.DOM.ecoMonto.value)
            };

            if (t === 'Gasto Local' || t === 'Gasto Familiar') {
                formData.categoria = DOMPurify.sanitize(this.DOM.ecoCategoria.value);
            }
            if (t === 'Pago Proveedor') {
                formData.proveedor = DOMPurify.sanitize(this.DOM.ecoProveedor.value.trim());
                let valVenta = this.parseNumber(this.DOM.ecoValorVenta?.value);
                if (valVenta > 0) formData.valorVentaEstimado = valVenta;
                if (this.DOM.ecoEstadoPago) formData.estadoPago = DOMPurify.sanitize(this.DOM.ecoEstadoPago.value);
            }
            if (t === 'Amortización Deuda a Proveedor') {
                formData.deudaAsociadaId = DOMPurify.sanitize(this.DOM.ecoDeudaProveedorId.value);
                let deudas = this.currentModelData?.stats?.deudaProveedoresDetalle || {};
                if (deudas[formData.deudaAsociadaId]) {
                    formData.proveedor = deudas[formData.deudaAsociadaId].proveedor;
                } else {
                    formData.proveedor = 'Desconocido';
                }
            }
            if (t === 'Reparto Sociedad') {
                formData.proveedor = DOMPurify.sanitize(this.DOM.ecoProveedor.value.trim());
            }
            if (t === 'Ajuste Stock Inicial') {
                let valVenta = this.parseNumber(this.DOM.ecoValorVenta?.value);
                if (valVenta > 0) formData.valorVentaEstimado = valVenta;
            }
            if (t === 'Alta Préstamo') {
                formData.entidad = DOMPurify.sanitize(this.DOM.ecoPrestamoEntidad.value.trim());
                formData.montoTotalDevolver = this.parseNumber(this.DOM.ecoPrestamoTotal.value);
            }
            if (t === 'Pago Préstamo') {
                formData.prestamoAsociado = parseInt(this.DOM.ecoPrestamoId.value) || 0;
            }
        }
        
        let notasVal = isBursatil ? this.DOM.opNotas?.value : this.DOM.ecoNotas?.value;
        if (notasVal && notasVal.trim() !== '') {
            formData.notas = DOMPurify.sanitize(notasVal.trim());
        }
        
        return formData;
    },

    poblarFormularioEdicion(mov) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (this.DOM.tituloOperarBursatil) this.DOM.tituloOperarBursatil.innerText = "Editar Inversión";
        if (this.DOM.tituloOperarEco) this.DOM.tituloOperarEco.innerText = "Editar Movimiento Local";
        if (this.DOM.tituloConfirmar) this.DOM.tituloConfirmar.innerText = "Guardar Cambios";
        if (this.DOM.btnGuardarOp) {
            this.DOM.btnGuardarOp.innerHTML = `<svg width="18" height="18"><use href="#icon-edit"></use></svg> Sobrescribir Registro`;
            this.DOM.btnGuardarOp.classList.add('btn--warning');
        }
        if (this.DOM.btnCancelarEdicion) this.DOM.btnCancelarEdicion.classList.remove('is-hidden');
        
        const tiposBursatiles = ['Transferencia Ahorro', 'Compra', 'Venta', 'Rendimiento', 'Dividendo', 'Retiro'];
        const isBursatil = tiposBursatiles.includes(mov.tipo);
        
        if (isBursatil) {
            this.DOM.btnToggleBursatil.click();
            this.DOM.opTipo.value = mov.tipo;
            this.DOM.opFecha.value = mov.fecha;
            if (mov.activo) this.DOM.opActivo.value = mov.activo;
            if (mov.sector) this.DOM.opSector.value = mov.sector;
            if (mov.cantidad) this.DOM.opCantidad.value = mov.cantidad;
            if (mov.usd) this.DOM.opUsd.value = mov.usd;
            this.DOM.opMonto.value = this.fmtStr(mov.monto, 1, false);
            if (this.DOM.opNotas) this.DOM.opNotas.value = mov.notas || '';
            this.adaptarFormularioOperar();
        } else {
            this.DOM.btnToggleEconomia.click();
            this.DOM.ecoTipo.value = mov.tipo;
            this.DOM.ecoFecha.value = mov.fecha;
            setTimeout(() => {
                if (mov.categoria) this.DOM.ecoCategoria.value = mov.categoria;
                if (mov.proveedor) this.DOM.ecoProveedor.value = mov.proveedor;
                if (mov.socio) this.DOM.ecoProveedor.value = mov.socio;
                if (mov.entidad) this.DOM.ecoPrestamoEntidad.value = mov.entidad;
                if (mov.montoTotalDevolver) this.DOM.ecoPrestamoTotal.value = this.fmtStr(mov.montoTotalDevolver, 1, false);
                if (mov.cuotas) {
                    const cuotasInp = document.getElementById('eco-prestamo-cuotas');
                    if (cuotasInp) cuotasInp.value = mov.cuotas;
                }
                if (mov.prestamoAsociado) this.DOM.ecoPrestamoId.value = mov.prestamoAsociado;
                
                if (mov.valorVentaEstimado && this.DOM.ecoValorVenta) {
                    this.DOM.ecoValorVenta.value = this.fmtStr(mov.valorVentaEstimado, 1, false);
                }
                
                if (mov.estadoPago && this.DOM.ecoEstadoPago) this.DOM.ecoEstadoPago.value = mov.estadoPago;
                if (mov.deudaAsociadaId && this.DOM.ecoDeudaProveedorId) this.DOM.ecoDeudaProveedorId.value = mov.deudaAsociadaId;

                if (mov.tipo === 'Alta Préstamo' && mov.capital) {
                    const capInput = document.getElementById('eco-prestamo-capital');
                    if (capInput) capInput.value = this.fmtStr(mov.capital, 1, false);
                } else {
                    this.DOM.ecoMonto.value = this.fmtStr(mov.monto, 1, false);
                }
                
                if (this.DOM.ecoNotas) this.DOM.ecoNotas.value = mov.notas || '';
            }, 50);
            this.adaptarFormularioEconomia();
        }
    },

    setupSystemListeners() {
        events.on('app:toast', (data) => this.toast(data.msg, data.type));
        events.on('ui:poblar-formulario-edicion', (mov) => this.poblarFormularioEdicion(mov));

        events.on('ui:restaurar-estado-formulario', (estado) => {
            if (estado.tipo === 'Gasto Local' || estado.tipo === 'Gasto Familiar') {
                if (this.DOM.ecoCategoria) {
                    this.DOM.ecoCategoria.value = estado.categoria;
                }
            }
        });

        events.on('app:zenMode', (status) => {
            this.zenMode = status;
            let btnZen = document.getElementById('btn-zen');
            if (btnZen) {
                if (this.zenMode) btnZen.style.color = 'var(--color-primary)';
                else btnZen.style.color = 'var(--text-muted)';
            }
            this.ejecutarRendersActivos();
            this.toast(this.zenMode ? "Modo Zen Activado (%)" : "Modo Absoluto Activado ($)", "success");
        });

        events.on('model:updated', (data) => {
            this.currentModelData = data;
            this.DOM.btnToggleMoneda.innerText = data.vistaUSD ? 'Ver en ARS' : 'Ver Todo en USD';
            this.ejecutarRendersActivos();
        });

        events.on('model:inflacionUpdated', (inf) => {
            if(this.currentModelData) {
                this.currentModelData.inflacion = inf;
                if(this.activeTab === 'ajustes') this.renderAjustesInflacion();
                if(this.activeTab === 'dashboard') this.renderEvolucion();
            }
        });

        events.on('model:preciosUpdated', (nuevosPrecios) => {
            if(this.currentModelData) this.currentModelData.cachePrecios = nuevosPrecios;
            if(this.activeTab === 'portafolio') this.renderPortafolioVivo(this.currentModelData);
        });

        events.on('model:watchlistUpdated', (wlData) => {
            if(this.activeTab === 'portafolio') this.renderWatchlist(wlData);
        });

        events.on('state:tabChanged', (tabId) => {
            this.activeTab = tabId;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('tab-content--active'));
            document.querySelectorAll('.nav__item').forEach(b => { 
                b.classList.remove('nav__item--active');
                b.setAttribute('aria-selected', 'false');
            });
            document.getElementById(tabId)?.classList.add('tab-content--active');
            let btnNav = document.querySelector(`.nav__item[aria-controls="${tabId}"]`);
            if(btnNav) { 
                btnNav.classList.add('nav__item--active');
                btnNav.setAttribute('aria-selected', 'true');
            }
            
            if(tabId === 'finanza-general') {
                events.emit('ui:actualizar-distribucion-gastos', { contexto: 'Local', temporalidad: 'Histórico', domId: 'wrap-gastos-local' });
                events.emit('ui:actualizar-distribucion-gastos', { contexto: 'Personal', temporalidad: 'Histórico', domId: 'wrap-gastos-personal' });
            }

            this.ejecutarRendersActivos();
        });

        events.on('state:filtroChanged', (filtro) => {
            this.activeFilter = filtro;
            document.querySelectorAll('.btn--filter:not(.gastos-filter-btn)').forEach(b => b.classList.remove('active'));
            document.querySelector(`.btn--filter:not(.gastos-filter-btn)[data-filter="${filtro}"]`)?.classList.add('active');
            if(this.currentModelData) this.renderEvolucion();
        });

        events.on('app:marketStatus', (isOpen) => {
            let dot = document.getElementById('market-dot');
            let text = document.getElementById('market-text');
            if(dot && text) {
                dot.className = isOpen ? 'market-dot market-dot--open' : 'market-dot market-dot--closed';
                text.innerText = isOpen ? 'Mercado Abierto' : 'Mercado Cerrado';
            }
        });

        events.on('ui:reset-form-operacion', () => {
            this.DOM.opMonto.value = '';
            this.DOM.opCantidad.value = '';
            if (this.DOM.opNotas) this.DOM.opNotas.value = '';
            
            if(this.DOM.ecoMonto) {
                this.DOM.ecoMonto.value = '';
                if(this.DOM.ecoValorVenta) this.DOM.ecoValorVenta.value = '';
                if(this.DOM.ecoPrestamoTotal) this.DOM.ecoPrestamoTotal.value = '';
                if(this.DOM.ecoPrestamoEntidad) this.DOM.ecoPrestamoEntidad.value = '';
                if(this.DOM.ecoProveedor) this.DOM.ecoProveedor.value = '';
                if(this.DOM.ecoNotas) this.DOM.ecoNotas.value = '';
                
                const capInput = document.getElementById('eco-prestamo-capital');
                if(capInput) capInput.value = '';
            }

            if (this.DOM.tituloOperarBursatil) this.DOM.tituloOperarBursatil.innerText = "Operar Inversiones";
            if (this.DOM.tituloOperarEco) this.DOM.tituloOperarEco.innerText = "Flujo de Caja (Local/Vida)";
            if (this.DOM.tituloConfirmar) this.DOM.tituloConfirmar.innerText = "Confirmar Transacción";
            
            if (this.DOM.btnGuardarOp) {
                this.DOM.btnGuardarOp.innerHTML = "Registrar en Base de Datos";
                this.DOM.btnGuardarOp.classList.remove('btn--warning');
            }
            if (this.DOM.btnCancelarEdicion) this.DOM.btnCancelarEdicion.classList.add('is-hidden');
            
            this.adaptarFormularioEconomia();
            this.adaptarFormularioOperar();
        });

        events.on('app:pinStatus', (status) => {
            const overlay = document.getElementById('pin-overlay');
            const btnActivar = document.getElementById('btn-activar-pin');
            const btnBorrar = document.getElementById('btn-borrar-pin');
            const inputNuevo = document.getElementById('nuevo-pin');
            
            if(status === 'LOCKED') {
                overlay.classList.remove('is-hidden');
                overlay.classList.add('is-visible-flex');
                btnActivar.classList.add('is-hidden');
                btnBorrar.classList.remove('is-hidden');
                inputNuevo.classList.add('is-hidden');
            } else if(status === 'UNLOCKED') {
                overlay.classList.add('is-hidden');
                overlay.classList.remove('is-visible-flex');
                document.getElementById('input-pin-login').value = '';
            } else if (status === 'ERROR') {
                document.getElementById('input-pin-login').value = '';
            } else if (status === 'NO_PIN') {
                btnActivar.classList.remove('is-hidden');
                btnBorrar.classList.add('is-hidden');
                inputNuevo.classList.remove('is-hidden');
            }
        });
    },

    ejecutarRendersActivos() {
        if(!this.currentModelData) return;
        this.renderDashboardBase(this.currentModelData);
        if(this.activeTab === 'dashboard') this.renderEvolucion();
        if(this.activeTab === 'finanza-general') this.renderFinanzaGeneral(this.currentModelData);
        if(this.activeTab === 'historial') this.renderHistorial(this.currentModelData);
        if(this.activeTab === 'informes') {
            this.renderInformesPro(this.currentModelData);
            this.renderSimuladorWhatIf(this.currentModelData);
        }
        if(this.activeTab === 'portafolio') this.renderPortafolioVivo(this.currentModelData);
        if(this.activeTab === 'calendario') this.renderCalendario(this.currentModelData);
        if(this.activeTab === 'herramientas') this.calcularInteres();
        if(this.activeTab === 'ajustes') this.renderAjustesInflacion();
        if(this.activeTab === 'fire') this.initFIRE(this.currentModelData);
        
        if(this.activeTab === 'operar') {
            if (!this.DOM.btnCancelarEdicion || this.DOM.btnCancelarEdicion.classList.contains('is-hidden')) {
                this.adaptarFormularioEconomia();
            }
        }
    },

    togglePrivacy() {
        document.body.classList.toggle('privacy-active');
        const iconSvg = document.getElementById('icon-privacy-toggle');
        iconSvg.innerHTML = document.body.classList.contains('privacy-active') ? `<use href="#icon-privacy-off"></use>` : `<use href="#icon-privacy"></use>`;
    },

    validarVentaRestrictiva() {
        if(this.DOM.opTipo.value !== 'Venta' || !this.currentModelData) return;
        const ticker = this.DOM.opActivo.value.trim().toUpperCase();
        const tenencia = this.currentModelData.portafolio[ticker]?.cant || 0;
        const inputCant = parseFloat(this.DOM.opCantidad.value) || 0;
        
        if (ticker !== '') {
            this.DOM.hintCantidad.classList.remove('is-hidden');
            this.DOM.hintCantidad.innerText = `Tenencia actual: ${tenencia}`;
            const isEditing = !this.DOM.btnCancelarEdicion.classList.contains('is-hidden');
            if (!isEditing && inputCant > tenencia) {
                this.DOM.opCantidad.value = tenencia;
                this.DOM.hintCantidad.innerText = `Máximo alcanzado. Tenencia: ${tenencia}`;
            }
        } else {
            this.DOM.hintCantidad.classList.add('is-hidden');
        }
    },

    adaptarFormularioOperar() {
        let t = this.DOM.opTipo.value;
        if(this.DOM.hintCantidad) this.DOM.hintCantidad.classList.add('is-hidden');
        
        if (['Compra','Venta','Dividendo'].includes(t)) {
            this.DOM.bloqueActivo.classList.remove('is-hidden');
        } else {
            this.DOM.bloqueActivo.classList.add('is-hidden');
        }
        
        if (t === 'Compra') {
            this.DOM.grupoSector.classList.remove('is-hidden');
        } else {
            this.DOM.grupoSector.classList.add('is-hidden');
        }
        
        if (t === 'Transferencia Ahorro' || t === 'Ahorro') {
            this.DOM.bloqueDolares.classList.remove('is-hidden');
        } else {
            this.DOM.bloqueDolares.classList.add('is-hidden');
        }

        this.DOM.lblMonto.innerText = t === 'Dividendo' ? 'Dividendo Cobrado (ARS)' : 'Monto Total Operado (ARS)';
    },

    adaptarFormularioEconomia() {
        let t = this.DOM.ecoTipo.value;
        let cats = this.currentModelData?.categorias || {};
        
        this.DOM.bloqueCategoriasEco.classList.add('is-hidden');
        this.DOM.bloquePrestamosAlta.classList.add('is-hidden');
        this.DOM.bloquePrestamosPago.classList.add('is-hidden');
        this.DOM.grupoEcoCategoria.classList.add('is-hidden');
        this.DOM.grupoEcoProveedor.classList.add('is-hidden');
        
        if (this.DOM.rowEcoValorVenta) this.DOM.rowEcoValorVenta.classList.add('is-hidden');
        if (this.DOM.rowEcoEstadoPago) this.DOM.rowEcoEstadoPago.classList.add('is-hidden');
        if (this.DOM.bloquePagoDeudaProveedor) this.DOM.bloquePagoDeudaProveedor.classList.add('is-hidden');
        
        if (t === 'Gasto Local' || t === 'Gasto Familiar') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoCategoria.classList.remove('is-hidden');
            
            let catType = t === 'Gasto Local' ? 'Local' : 'Personal';
            let listData = cats[catType] || [];
            
            let datalistHtml = '<datalist id="lista-categorias-eco">';
            listData.forEach(c => { datalistHtml += `<option value="${DOMPurify.sanitize(c)}">`; });
            datalistHtml += '</datalist>';
            
            this.DOM.ecoCategoria.outerHTML = `<input type="text" id="eco-categoria" list="lista-categorias-eco" placeholder="Selecciona de la lista o escribe una nueva...">` + datalistHtml;
            this.DOM.ecoCategoria = document.getElementById('eco-categoria');
        } 
        else if (t === 'Pago Proveedor') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoProveedor.classList.remove('is-hidden');
            
            if (this.DOM.rowEcoEstadoPago) {
                this.DOM.rowEcoEstadoPago.classList.remove('is-hidden');
            }
            if (this.DOM.rowEcoValorVenta) {
                this.DOM.rowEcoValorVenta.classList.remove('is-hidden');
                let hint = document.getElementById('hint-valor-venta');
                if (hint) hint.innerText = "Si se deja en blanco, se suma al costo sin proyectar ganancia.";
            }
            
            let provs = this.currentModelData?.proveedores || [];
            let datalistHtml = '<datalist id="lista-proveedores">';
            provs.forEach(p => { datalistHtml += `<option value="${p.nombre}">`; });
            datalistHtml += '</datalist>';
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" list="lista-proveedores" placeholder="Ej: Proveedor ABC">` + datalistHtml;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor'); 
        } 
        else if (t === 'Amortización Deuda a Proveedor') {
            if (this.DOM.bloquePagoDeudaProveedor) this.DOM.bloquePagoDeudaProveedor.classList.remove('is-hidden');
            
            let deudas = this.currentModelData?.stats?.deudaProveedoresDetalle || {};
            let optionsHtml = '<option value="">-- Seleccionar Deuda Pendiente --</option>';
            
            for(let key in deudas) {
                let d = deudas[key];
                if(d.activo) {
                    let pendiente = d.capitalExigibleTotal - d.capitalServido;
                    optionsHtml += `<option value="${d.id}">${DOMPurify.sanitize(d.proveedor)} (Resta $${this.fmtStr(pendiente, 1, false)}) - ${d.fecha}</option>`;
                }
            }
            if (this.DOM.ecoDeudaProveedorId) this.DOM.ecoDeudaProveedorId.innerHTML = optionsHtml;
        }
        else if (t === 'Reparto Sociedad') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoProveedor.classList.remove('is-hidden');
            this.DOM.ecoProveedor.placeholder = "Ej: Nombre del Socio";
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" placeholder="Ej: Nombre del Socio">`;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor');
        }
        else if (t === 'Ajuste Stock Inicial') {
            if (this.DOM.rowEcoValorVenta) {
                this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
                this.DOM.rowEcoValorVenta.classList.remove('is-hidden');
                let hint = document.getElementById('hint-valor-venta');
                if (hint) hint.innerText = "Ingresa cuánto dinero obtendrías si vendieras todo este stock histórico al público.";
            }
        }
        else if (t === 'Alta Préstamo') {
            this.DOM.bloquePrestamosAlta.classList.remove('is-hidden');
        }
        else if (t === 'Pago Préstamo') {
            this.DOM.bloquePrestamosPago.classList.remove('is-hidden');
            let prestamos = this.currentModelData?.stats?.prestamosDetalle || {};
            let optionsHtml = '<option value="">-- Seleccionar Préstamo --</option>';
            
            for(let key in prestamos) {
                let p = prestamos[key];
                if(p.activo) {
                    let deudaPendiente = p.totalDevolver - p.pagado;
                    optionsHtml += `<option value="${p.id}">${DOMPurify.sanitize(p.entidad)} (Resta $${this.fmtStr(deudaPendiente, 1, false)})</option>`;
                }
            }
            this.DOM.ecoPrestamoId.innerHTML = optionsHtml;
        }
    },
    initExportacionPDF() {
        const btnExportarPdf = document.getElementById('btn-exportar-pdf');
        if (btnExportarPdf) {
            btnExportarPdf.addEventListener('click', () => {
                const filtroTemporalidad = document.getElementById('pdf-filtro-temporalidad')?.value || 'Histórico';
                const filtroTipo = document.getElementById('pdf-filtro-tipo')?.value || 'Todos';

                events.emit('ui:exportar-pdf', {
                    temporalidad: filtroTemporalidad,
                    tipo: filtroTipo
                });
            });
        }
    },

    getOperacionFormData() {
        const isBursatil = document.getElementById('btn-toggle-bursatil')?.classList.contains('active') !== false;
        let formData = {};
        
        if (isBursatil) {
            formData = {
                tipo: DOMPurify.sanitize(this.DOM.opTipo.value),
                fecha: DOMPurify.sanitize(this.DOM.opFecha.value),
                activo: DOMPurify.sanitize(this.DOM.opActivo.value.trim().toUpperCase()),
                sector: DOMPurify.sanitize(this.DOM.opSector.value.trim()),
                cant: parseFloat(this.DOM.opCantidad.value) || 0,
                monto: this.parseNumber(this.DOM.opMonto.value),
                usd: parseFloat(this.DOM.opUsd.value) || 0
            };
        } else {
            let t = this.DOM.ecoTipo.value;
            formData = {
                tipo: DOMPurify.sanitize(t),
                fecha: DOMPurify.sanitize(this.DOM.ecoFecha.value),
                monto: this.parseNumber(this.DOM.ecoMonto.value)
            };

            if (t === 'Gasto Local' || t === 'Gasto Familiar') {
                formData.categoria = DOMPurify.sanitize(this.DOM.ecoCategoria.value);
            }
            if (t === 'Pago Proveedor') {
                formData.proveedor = DOMPurify.sanitize(this.DOM.ecoProveedor.value.trim());
                let valVenta = this.parseNumber(this.DOM.ecoValorVenta?.value);
                if (valVenta > 0) formData.valorVentaEstimado = valVenta;
                if (this.DOM.ecoEstadoPago) formData.estadoPago = DOMPurify.sanitize(this.DOM.ecoEstadoPago.value);
            }
            if (t === 'Amortización Deuda a Proveedor') {
                formData.deudaAsociadaId = DOMPurify.sanitize(this.DOM.ecoDeudaProveedorId.value);
                let deudas = this.currentModelData?.stats?.deudaProveedoresDetalle || {};
                if (deudas[formData.deudaAsociadaId]) {
                    formData.proveedor = deudas[formData.deudaAsociadaId].proveedor;
                } else {
                    formData.proveedor = 'Desconocido';
                }
            }
            if (t === 'Reparto Sociedad') {
                formData.proveedor = DOMPurify.sanitize(this.DOM.ecoProveedor.value.trim());
            }
            if (t === 'Ajuste Stock Inicial') {
                let valVenta = this.parseNumber(this.DOM.ecoValorVenta?.value);
                if (valVenta > 0) formData.valorVentaEstimado = valVenta;
            }
            if (t === 'Alta Préstamo') {
                formData.entidad = DOMPurify.sanitize(this.DOM.ecoPrestamoEntidad.value.trim());
                formData.montoTotalDevolver = this.parseNumber(this.DOM.ecoPrestamoTotal.value);
            }
            if (t === 'Pago Préstamo') {
                formData.prestamoAsociado = parseInt(this.DOM.ecoPrestamoId.value) || 0;
            }
        }
        
        let notasVal = isBursatil ? this.DOM.opNotas?.value : this.DOM.ecoNotas?.value;
        if (notasVal && notasVal.trim() !== '') {
            formData.notas = DOMPurify.sanitize(notasVal.trim());
        }
        
        return formData;
    },

    poblarFormularioEdicion(mov) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (this.DOM.tituloOperarBursatil) this.DOM.tituloOperarBursatil.innerText = "Editar Inversión";
        if (this.DOM.tituloOperarEco) this.DOM.tituloOperarEco.innerText = "Editar Movimiento Local";
        if (this.DOM.tituloConfirmar) this.DOM.tituloConfirmar.innerText = "Guardar Cambios";
        if (this.DOM.btnGuardarOp) {
            this.DOM.btnGuardarOp.innerHTML = `<svg width="18" height="18"><use href="#icon-edit"></use></svg> Sobrescribir Registro`;
            this.DOM.btnGuardarOp.classList.add('btn--warning');
        }
        if (this.DOM.btnCancelarEdicion) this.DOM.btnCancelarEdicion.classList.remove('is-hidden');
        
        const tiposBursatiles = ['Transferencia Ahorro', 'Compra', 'Venta', 'Rendimiento', 'Dividendo', 'Retiro'];
        const isBursatil = tiposBursatiles.includes(mov.tipo);
        
        if (isBursatil) {
            this.DOM.btnToggleBursatil.click();
            this.DOM.opTipo.value = mov.tipo;
            this.DOM.opFecha.value = mov.fecha;
            if (mov.activo) this.DOM.opActivo.value = mov.activo;
            if (mov.sector) this.DOM.opSector.value = mov.sector;
            if (mov.cantidad) this.DOM.opCantidad.value = mov.cantidad;
            if (mov.usd) this.DOM.opUsd.value = mov.usd;
            this.DOM.opMonto.value = this.fmtStr(mov.monto, 1, false);
            if (this.DOM.opNotas) this.DOM.opNotas.value = mov.notas || '';
            this.adaptarFormularioOperar();
        } else {
            this.DOM.btnToggleEconomia.click();
            this.DOM.ecoTipo.value = mov.tipo;
            this.DOM.ecoFecha.value = mov.fecha;
            setTimeout(() => {
                if (mov.categoria) this.DOM.ecoCategoria.value = mov.categoria;
                if (mov.proveedor) this.DOM.ecoProveedor.value = mov.proveedor;
                if (mov.socio) this.DOM.ecoProveedor.value = mov.socio;
                if (mov.entidad) this.DOM.ecoPrestamoEntidad.value = mov.entidad;
                if (mov.montoTotalDevolver) this.DOM.ecoPrestamoTotal.value = this.fmtStr(mov.montoTotalDevolver, 1, false);
                if (mov.cuotas) {
                    const cuotasInp = document.getElementById('eco-prestamo-cuotas');
                    if (cuotasInp) cuotasInp.value = mov.cuotas;
                }
                if (mov.prestamoAsociado) this.DOM.ecoPrestamoId.value = mov.prestamoAsociado;
                
                if (mov.valorVentaEstimado && this.DOM.ecoValorVenta) {
                    this.DOM.ecoValorVenta.value = this.fmtStr(mov.valorVentaEstimado, 1, false);
                }
                
                if (mov.estadoPago && this.DOM.ecoEstadoPago) this.DOM.ecoEstadoPago.value = mov.estadoPago;
                if (mov.deudaAsociadaId && this.DOM.ecoDeudaProveedorId) this.DOM.ecoDeudaProveedorId.value = mov.deudaAsociadaId;

                if (mov.tipo === 'Alta Préstamo' && mov.capital) {
                    const capInput = document.getElementById('eco-prestamo-capital');
                    if (capInput) capInput.value = this.fmtStr(mov.capital, 1, false);
                } else {
                    this.DOM.ecoMonto.value = this.fmtStr(mov.monto, 1, false);
                }
                
                if (this.DOM.ecoNotas) this.DOM.ecoNotas.value = mov.notas || '';
            }, 50);
            this.adaptarFormularioEconomia();
        }
    },

    setupSystemListeners() {
        events.on('app:toast', (data) => this.toast(data.msg, data.type));
        events.on('ui:poblar-formulario-edicion', (mov) => this.poblarFormularioEdicion(mov));

        events.on('ui:restaurar-estado-formulario', (estado) => {
            if (estado.tipo === 'Gasto Local' || estado.tipo === 'Gasto Familiar') {
                if (this.DOM.ecoCategoria) {
                    this.DOM.ecoCategoria.value = estado.categoria;
                }
            }
        });

        events.on('app:zenMode', (status) => {
            this.zenMode = status;
            let btnZen = document.getElementById('btn-zen');
            if (btnZen) {
                if (this.zenMode) btnZen.style.color = 'var(--color-primary)';
                else btnZen.style.color = 'var(--text-muted)';
            }
            this.ejecutarRendersActivos();
            this.toast(this.zenMode ? "Modo Zen Activado (%)" : "Modo Absoluto Activado ($)", "success");
        });

        events.on('model:updated', (data) => {
            this.currentModelData = data;
            this.DOM.btnToggleMoneda.innerText = data.vistaUSD ? 'Ver en ARS' : 'Ver Todo en USD';
            this.ejecutarRendersActivos();
        });

        events.on('model:inflacionUpdated', (inf) => {
            if(this.currentModelData) {
                this.currentModelData.inflacion = inf;
                if(this.activeTab === 'ajustes') this.renderAjustesInflacion();
                if(this.activeTab === 'dashboard') this.renderEvolucion();
            }
        });

        events.on('model:preciosUpdated', (nuevosPrecios) => {
            if(this.currentModelData) this.currentModelData.cachePrecios = nuevosPrecios;
            if(this.activeTab === 'portafolio') this.renderPortafolioVivo(this.currentModelData);
        });

        events.on('model:watchlistUpdated', (wlData) => {
            if(this.activeTab === 'portafolio') this.renderWatchlist(wlData);
        });

        events.on('state:tabChanged', (tabId) => {
            this.activeTab = tabId;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('tab-content--active'));
            document.querySelectorAll('.nav__item').forEach(b => { 
                b.classList.remove('nav__item--active');
                b.setAttribute('aria-selected', 'false');
            });
            document.getElementById(tabId)?.classList.add('tab-content--active');
            let btnNav = document.querySelector(`.nav__item[aria-controls="${tabId}"]`);
            if(btnNav) { 
                btnNav.classList.add('nav__item--active');
                btnNav.setAttribute('aria-selected', 'true');
            }
            
            if(tabId === 'finanza-general') {
                events.emit('ui:actualizar-distribucion-gastos', { contexto: 'Local', temporalidad: 'Histórico', domId: 'wrap-gastos-local' });
                events.emit('ui:actualizar-distribucion-gastos', { contexto: 'Personal', temporalidad: 'Histórico', domId: 'wrap-gastos-personal' });
            }

            this.ejecutarRendersActivos();
        });

        events.on('state:filtroChanged', (filtro) => {
            this.activeFilter = filtro;
            document.querySelectorAll('.btn--filter:not(.gastos-filter-btn)').forEach(b => b.classList.remove('active'));
            document.querySelector(`.btn--filter:not(.gastos-filter-btn)[data-filter="${filtro}"]`)?.classList.add('active');
            if(this.currentModelData) this.renderEvolucion();
        });

        events.on('app:marketStatus', (isOpen) => {
            let dot = document.getElementById('market-dot');
            let text = document.getElementById('market-text');
            if(dot && text) {
                dot.className = isOpen ? 'market-dot market-dot--open' : 'market-dot market-dot--closed';
                text.innerText = isOpen ? 'Mercado Abierto' : 'Mercado Cerrado';
            }
        });

        events.on('ui:reset-form-operacion', () => {
            this.DOM.opMonto.value = '';
            this.DOM.opCantidad.value = '';
            if (this.DOM.opNotas) this.DOM.opNotas.value = '';
            
            if(this.DOM.ecoMonto) {
                this.DOM.ecoMonto.value = '';
                if(this.DOM.ecoValorVenta) this.DOM.ecoValorVenta.value = '';
                if(this.DOM.ecoPrestamoTotal) this.DOM.ecoPrestamoTotal.value = '';
                if(this.DOM.ecoPrestamoEntidad) this.DOM.ecoPrestamoEntidad.value = '';
                if(this.DOM.ecoProveedor) this.DOM.ecoProveedor.value = '';
                if(this.DOM.ecoNotas) this.DOM.ecoNotas.value = '';
                
                const capInput = document.getElementById('eco-prestamo-capital');
                if(capInput) capInput.value = '';
            }

            if (this.DOM.tituloOperarBursatil) this.DOM.tituloOperarBursatil.innerText = "Operar Inversiones";
            if (this.DOM.tituloOperarEco) this.DOM.tituloOperarEco.innerText = "Flujo de Caja (Local/Vida)";
            if (this.DOM.tituloConfirmar) this.DOM.tituloConfirmar.innerText = "Confirmar Transacción";
            
            if (this.DOM.btnGuardarOp) {
                this.DOM.btnGuardarOp.innerHTML = "Registrar en Base de Datos";
                this.DOM.btnGuardarOp.classList.remove('btn--warning');
            }
            if (this.DOM.btnCancelarEdicion) this.DOM.btnCancelarEdicion.classList.add('is-hidden');
            
            this.adaptarFormularioEconomia();
            this.adaptarFormularioOperar();
        });

        events.on('app:pinStatus', (status) => {
            const overlay = document.getElementById('pin-overlay');
            const btnActivar = document.getElementById('btn-activar-pin');
            const btnBorrar = document.getElementById('btn-borrar-pin');
            const inputNuevo = document.getElementById('nuevo-pin');
            
            if(status === 'LOCKED') {
                overlay.classList.remove('is-hidden');
                overlay.classList.add('is-visible-flex');
                btnActivar.classList.add('is-hidden');
                btnBorrar.classList.remove('is-hidden');
                inputNuevo.classList.add('is-hidden');
            } else if(status === 'UNLOCKED') {
                overlay.classList.add('is-hidden');
                overlay.classList.remove('is-visible-flex');
                document.getElementById('input-pin-login').value = '';
            } else if (status === 'ERROR') {
                document.getElementById('input-pin-login').value = '';
            } else if (status === 'NO_PIN') {
                btnActivar.classList.remove('is-hidden');
                btnBorrar.classList.add('is-hidden');
                inputNuevo.classList.remove('is-hidden');
            }
        });
    },

    ejecutarRendersActivos() {
        if(!this.currentModelData) return;
        this.renderDashboardBase(this.currentModelData);
        if(this.activeTab === 'dashboard') this.renderEvolucion();
        if(this.activeTab === 'finanza-general') this.renderFinanzaGeneral(this.currentModelData);
        if(this.activeTab === 'historial') this.renderHistorial(this.currentModelData);
        if(this.activeTab === 'informes') {
            this.renderInformesPro(this.currentModelData);
            this.renderSimuladorWhatIf(this.currentModelData);
        }
        if(this.activeTab === 'portafolio') this.renderPortafolioVivo(this.currentModelData);
        if(this.activeTab === 'calendario') this.renderCalendario(this.currentModelData);
        if(this.activeTab === 'herramientas') this.calcularInteres();
        if(this.activeTab === 'ajustes') this.renderAjustesInflacion();
        if(this.activeTab === 'fire') this.initFIRE(this.currentModelData);
        
        if(this.activeTab === 'operar') {
            if (!this.DOM.btnCancelarEdicion || this.DOM.btnCancelarEdicion.classList.contains('is-hidden')) {
                this.adaptarFormularioEconomia();
            }
        }
    },

    togglePrivacy() {
        document.body.classList.toggle('privacy-active');
        const iconSvg = document.getElementById('icon-privacy-toggle');
        iconSvg.innerHTML = document.body.classList.contains('privacy-active') ? `<use href="#icon-privacy-off"></use>` : `<use href="#icon-privacy"></use>`;
    },

    validarVentaRestrictiva() {
        if(this.DOM.opTipo.value !== 'Venta' || !this.currentModelData) return;
        const ticker = this.DOM.opActivo.value.trim().toUpperCase();
        const tenencia = this.currentModelData.portafolio[ticker]?.cant || 0;
        const inputCant = parseFloat(this.DOM.opCantidad.value) || 0;
        
        if (ticker !== '') {
            this.DOM.hintCantidad.classList.remove('is-hidden');
            this.DOM.hintCantidad.innerText = `Tenencia actual: ${tenencia}`;
            const isEditing = !this.DOM.btnCancelarEdicion.classList.contains('is-hidden');
            if (!isEditing && inputCant > tenencia) {
                this.DOM.opCantidad.value = tenencia;
                this.DOM.hintCantidad.innerText = `Máximo alcanzado. Tenencia: ${tenencia}`;
            }
        } else {
            this.DOM.hintCantidad.classList.add('is-hidden');
        }
    },

    adaptarFormularioOperar() {
        let t = this.DOM.opTipo.value;
        if(this.DOM.hintCantidad) this.DOM.hintCantidad.classList.add('is-hidden');
        
        if (['Compra','Venta','Dividendo'].includes(t)) {
            this.DOM.bloqueActivo.classList.remove('is-hidden');
        } else {
            this.DOM.bloqueActivo.classList.add('is-hidden');
        }
        
        if (t === 'Compra') {
            this.DOM.grupoSector.classList.remove('is-hidden');
        } else {
            this.DOM.grupoSector.classList.add('is-hidden');
        }
        
        if (t === 'Transferencia Ahorro' || t === 'Ahorro') {
            this.DOM.bloqueDolares.classList.remove('is-hidden');
        } else {
            this.DOM.bloqueDolares.classList.add('is-hidden');
        }

        this.DOM.lblMonto.innerText = t === 'Dividendo' ? 'Dividendo Cobrado (ARS)' : 'Monto Total Operado (ARS)';
    },

    adaptarFormularioEconomia() {
        let t = this.DOM.ecoTipo.value;
        let cats = this.currentModelData?.categorias || {};
        
        this.DOM.bloqueCategoriasEco.classList.add('is-hidden');
        this.DOM.bloquePrestamosAlta.classList.add('is-hidden');
        this.DOM.bloquePrestamosPago.classList.add('is-hidden');
        this.DOM.grupoEcoCategoria.classList.add('is-hidden');
        this.DOM.grupoEcoProveedor.classList.add('is-hidden');
        
        if (this.DOM.rowEcoValorVenta) this.DOM.rowEcoValorVenta.classList.add('is-hidden');
        if (this.DOM.rowEcoEstadoPago) this.DOM.rowEcoEstadoPago.classList.add('is-hidden');
        if (this.DOM.bloquePagoDeudaProveedor) this.DOM.bloquePagoDeudaProveedor.classList.add('is-hidden');
        
        if (t === 'Gasto Local' || t === 'Gasto Familiar') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoCategoria.classList.remove('is-hidden');
            
            let catType = t === 'Gasto Local' ? 'Local' : 'Personal';
            let listData = cats[catType] || [];
            
            let datalistHtml = '<datalist id="lista-categorias-eco">';
            listData.forEach(c => { datalistHtml += `<option value="${DOMPurify.sanitize(c)}">`; });
            datalistHtml += '</datalist>';
            
            this.DOM.ecoCategoria.outerHTML = `<input type="text" id="eco-categoria" list="lista-categorias-eco" placeholder="Selecciona de la lista o escribe una nueva...">` + datalistHtml;
            this.DOM.ecoCategoria = document.getElementById('eco-categoria');
        } 
        else if (t === 'Pago Proveedor') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoProveedor.classList.remove('is-hidden');
            
            if (this.DOM.rowEcoEstadoPago) {
                this.DOM.rowEcoEstadoPago.classList.remove('is-hidden');
            }
            if (this.DOM.rowEcoValorVenta) {
                this.DOM.rowEcoValorVenta.classList.remove('is-hidden');
                let hint = document.getElementById('hint-valor-venta');
                if (hint) hint.innerText = "Si se deja en blanco, se suma al costo sin proyectar ganancia.";
            }
            
            let provs = this.currentModelData?.proveedores || [];
            let datalistHtml = '<datalist id="lista-proveedores">';
            provs.forEach(p => { datalistHtml += `<option value="${p.nombre}">`; });
            datalistHtml += '</datalist>';
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" list="lista-proveedores" placeholder="Ej: Proveedor ABC">` + datalistHtml;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor'); 
        } 
        else if (t === 'Amortización Deuda a Proveedor') {
            if (this.DOM.bloquePagoDeudaProveedor) this.DOM.bloquePagoDeudaProveedor.classList.remove('is-hidden');
            
            let deudas = this.currentModelData?.stats?.deudaProveedoresDetalle || {};
            let optionsHtml = '<option value="">-- Seleccionar Deuda Pendiente --</option>';
            
            for(let key in deudas) {
                let d = deudas[key];
                if(d.activo) {
                    let pendiente = d.capitalExigibleTotal - d.capitalServido;
                    optionsHtml += `<option value="${d.id}">${DOMPurify.sanitize(d.proveedor)} (Resta $${this.fmtStr(pendiente, 1, false)}) - ${d.fecha}</option>`;
                }
            }
            if (this.DOM.ecoDeudaProveedorId) this.DOM.ecoDeudaProveedorId.innerHTML = optionsHtml;
        }
        else if (t === 'Reparto Sociedad') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoProveedor.classList.remove('is-hidden');
            this.DOM.ecoProveedor.placeholder = "Ej: Nombre del Socio";
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" placeholder="Ej: Nombre del Socio">`;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor');
        }
        else if (t === 'Ajuste Stock Inicial') {
            if (this.DOM.rowEcoValorVenta) {
                this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
                this.DOM.rowEcoValorVenta.classList.remove('is-hidden');
                let hint = document.getElementById('hint-valor-venta');
                if (hint) hint.innerText = "Ingresa cuánto dinero obtendrías si vendieras todo este stock histórico al público.";
            }
        }
        else if (t === 'Alta Préstamo') {
            this.DOM.bloquePrestamosAlta.classList.remove('is-hidden');
        }
        else if (t === 'Pago Préstamo') {
            this.DOM.bloquePrestamosPago.classList.remove('is-hidden');
            let prestamos = this.currentModelData?.stats?.prestamosDetalle || {};
            let optionsHtml = '<option value="">-- Seleccionar Préstamo --</option>';
            
            for(let key in prestamos) {
                let p = prestamos[key];
                if(p.activo) {
                    let deudaPendiente = p.totalDevolver - p.pagado;
                    optionsHtml += `<option value="${p.id}">${DOMPurify.sanitize(p.entidad)} (Resta $${this.fmtStr(deudaPendiente, 1, false)})</option>`;
                }
            }
            this.DOM.ecoPrestamoId.innerHTML = optionsHtml;
        }
    },

    renderSimuladorWhatIf(modelData = this.currentModelData) {
        if (!modelData || !modelData.stats) return;
        const s = modelData.stats;
        
        if (!this.DOM.simVentas || !this.DOM.simBolsa || !this.DOM.resSimMeses) return;

        let pctVentas = parseFloat(this.DOM.simVentas.value) / 100;
        let pctBolsa = parseFloat(this.DOM.simBolsa.value) / 100;

        this.DOM.valSimVentas.innerText = `-${(pctVentas * 100).toFixed(0)}%`;
        this.DOM.valSimBolsa.innerText = `-${(pctBolsa * 100).toFixed(0)}%`;

        let numMeses = s.numMesesOperativos || 1; 
        let ingresoOperativoMensual = s.ingresosLocal / numMeses;
        let egresoTotalMensual = (s.gastosLocal + (s.pagosProveedores || 0) + s.gastosFamiliar + (s.sociedadRetiros || 0)) / numMeses;

        let ingresoEstresado = ingresoOperativoMensual * (1 - pctVentas);
        let deficitMensualEstresado = egresoTotalMensual - ingresoEstresado;

        if (deficitMensualEstresado <= 0) {
            this.DOM.resSimMeses.innerText = "Sustentable";
            this.DOM.resSimMeses.className = "data-font texto-verde";
        } else {
            let liquidezBolsaEstresada = s.capInvertido * (1 - pctBolsa);
            let liquidezDefensivaTotal = s.billetera + s.cajaLocal + liquidezBolsaEstresada;
            let mesesSobrevida = liquidezDefensivaTotal / deficitMensualEstresado;
            
            this.DOM.resSimMeses.innerText = `${mesesSobrevida.toFixed(1)} Meses`;
            this.DOM.resSimMeses.className = `data-font ${mesesSobrevida > 6 ? 'texto-verde' : (mesesSobrevida > 3 ? 'texto-warning' : 'texto-rojo')}`;
        }
    },

    renderDashboardBase(modelData) {
        ErrorHandler.catchBoundary('Dashboard Principal', 'dashboard', () => {
            let s = modelData.stats;
            
            if (this.DOM.dashHealthScore && this.DOM.dashHealthLabel) {
                let sc = s.healthScore || 0;
                this.DOM.dashHealthScore.innerText = sc;
                
                let scLabel = "Peligro Crítico";
                let scColor = "var(--color-down)";
                if (sc >= 700) { scLabel = "Sólido"; scColor = "var(--color-up)"; }
                else if (sc >= 400) { scLabel = "Estable"; scColor = "var(--color-warning)"; }
                
                this.DOM.dashHealthScore.style.color = scColor;
                this.DOM.dashHealthLabel.innerText = scLabel;
                this.DOM.dashHealthLabel.style.color = scColor;
                this.DOM.dashHealthScore.closest('.card').style.borderColor = scColor;
                this.DOM.dashHealthScore.closest('.card').style.boxShadow = `0 0 15px rgba(${scColor === 'var(--color-up)' ? '0, 245, 160' : (scColor === 'var(--color-warning)' ? '255, 211, 0' : '255, 0, 92')}, 0.15)`;
            }

            if(this.DOM.lblDolar) this.DOM.lblDolar.innerText = modelData.dolarBlue;
            UIMetrics.actualizarFavicon(s.ganRealizada);

            let totalComercial = s.billetera + s.capInvertido + (s.stockCosto || 0) + (s.cajaLocal || 0);

            if (this.zenMode) {
                this.DOM.dashTotal.innerText = "100.0%";
                this.DOM.dashLiquidez.innerText = totalComercial > 0 ? ((s.billetera / totalComercial) * 100).toFixed(1) + "%" : "0%";
                this.DOM.dashInvertido.innerText = totalComercial > 0 ? ((s.capInvertido / totalComercial) * 100).toFixed(1) + "%" : "0%";
            } else {
                UIMetrics.animateValue(this.DOM.dashTotal, totalComercial, (val) => this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
                UIMetrics.animateValue(this.DOM.dashLiquidez, s.billetera, (val) => this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
                UIMetrics.animateValue(this.DOM.dashInvertido, s.capInvertido, (val) => this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
            }

            let histLength = 30;
            let arrPatrimonio = (s.historyPatrimonioConStock || s.historyPatrimonio || []).slice(-histLength);
            let arrLiquidez = (s.historyLiquidez || []).slice(-histLength);
            let arrInvertido = (s.historyInvertido || []).slice(-histLength);
            
            ChartRenderer.drawDashboardSparkline('spark-dash-total', arrPatrimonio, '#00D1FF');
            ChartRenderer.drawDashboardSparkline('spark-dash-liquidez', arrLiquidez, '#00F5A0');
            ChartRenderer.drawDashboardSparkline('spark-dash-invertido', arrInvertido, '#B500FF');

            if (this.DOM.lblPatSub1) {
                let cagrStr = `<span class="${s.cagr >= 0 ? 'texto-verde' : 'texto-rojo'} privacy-mask">${(s.cagr || 0).toFixed(2)}%</span>`;
                this.DOM.lblPatSub1.innerText = "TIR Proyectada (XIRR)";
                this.DOM.valPatSub1.innerHTML = cagrStr;
                
                let tagHtml = modelData.vistaUSD ? 'USD' : '$';
                this.DOM.lblPatSub2.innerText = "Ahorro de Bolsillo Total";
                this.DOM.valPatSub2.innerHTML = this.zenMode ? `<strong>-</strong>` : `<strong>${tagHtml} <span class="privacy-mask">${this.fmtStr(s.ahorroArsPuro, modelData.dolarBlue, modelData.vistaUSD)}</span></strong>`;
                
                let supStr = `<strong>${(s.fondoSupervivenciaMeses || 0).toFixed(1)} Meses</strong>`;
                let tasaAhStr = `<span class="texto-verde privacy-mask">${(s.tasaAhorroReal || 0).toFixed(1)}%</span>`;
                
                this.DOM.lblLiqSub1.innerText = "Fondo Supervivencia Local";
                this.DOM.valLiqSub1.innerHTML = supStr;
                
                this.DOM.lblLiqSub2.innerText = "Tasa de Retención Real";
                this.DOM.valLiqSub2.innerHTML = tasaAhStr;
                
                this.DOM.lblInvSub1.innerText = "Dólar Promedio Histórico";
                this.DOM.valInvSub1.innerHTML = `<strong>$ <span class="privacy-mask">${this.fmtStr(s.precioPromedioDolar || 0, 1, false)}</span></strong>`;
                
                this.DOM.lblInvSub2.innerText = "Trades Realizados";
                this.DOM.valInvSub2.innerHTML = `<strong>${s.vTotal || 0}</strong>`;
            }

            let ganColor = s.ganRealizada >= 0 ? 'texto-verde' : 'texto-rojo';
            let ganSign = s.ganRealizada > 0 ? '+' : (s.ganRealizada < 0 ? '-' : '');
            
            let tagHtm = modelData.vistaUSD ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
            let displayGanancia = this.zenMode ? 
                `${ganSign}${(s.capInvertido > 0 ? (Math.abs(s.ganRealizada) / s.capInvertido * 100).toFixed(1) : 0)}%` : 
                this.fmtStr(Math.abs(s.ganRealizada), modelData.dolarBlue, modelData.vistaUSD);
                
            let displayPasivos = this.zenMode ? 
                `${(s.capInvertido > 0 ? (s.rendExtra / s.capInvertido * 100).toFixed(1) : 0)}%` : 
                this.fmtStr(s.rendExtra, modelData.dolarBlue, modelData.vistaUSD);
            
            this.DOM.dashGanancia.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; width:100%; overflow:hidden;">
                    <span class="${ganColor}" style="font-size:1.4rem;">${ganSign}</span>
                    ${this.zenMode ? '' : tagHtm}
                    <span class="${ganColor} data-font privacy-mask" style="font-size:1.6rem; font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${displayGanancia}</span>
                </div>
            `;
            
            this.DOM.dashPasivos.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; width:100%; overflow:hidden;">
                    <span class="texto-primario" style="font-size:1.4rem;">+</span>
                    ${this.zenMode ? '' : tagHtm}
                    <span class="texto-primario data-font privacy-mask" style="font-size:1.6rem; font-weight:bold; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${displayPasivos}</span>
                </div>
            `;

            let wr = s.vTotal > 0 ? (s.vGanadas/s.vTotal*100).toFixed(1) : 0;
            this.DOM.dashWinrate.innerHTML = `
                <div style="display:flex; align-items:baseline; gap:8px; width:100%; overflow:hidden;">
                    <span class="data-font" style="font-size:1.6rem; font-weight:bold;">${wr}%</span>
                    <span style="font-size:0.9rem; color:var(--text-muted); white-space:nowrap;">(${s.vGanadas}/${s.vTotal})</span>
                </div>
            `;

            let topAct = '-', maxR = -Infinity;
            for(let k in s.rendimientoPorActivo) {
                if(s.rendimientoPorActivo[k] > maxR) { maxR = s.rendimientoPorActivo[k]; topAct = k; }
            }
            
            this.DOM.dashTop.innerHTML = `
                <div style="display:flex; align-items:center; width:100%; overflow:hidden;">
                    <span class="data-font" style="font-size:1.6rem; font-weight:bold; color:var(--text-main); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${DOMPurify.sanitize(topAct !== '-' ? topAct : '-')}</span>
                </div>
            `;
        });
    },

    renderEvolucion() {
        ErrorHandler.catchBoundary('Gráfico de Evolución', 'wrap-evolucion', () => {
            if(!this.currentModelData) return;
            ChartRenderer.renderEvolucion(this.currentModelData, this.activeFilter);
        });
    },

    actualizarRentabilidadFisica(stats, esBruta = false) {
        if(!this.DOM.esfuerzoMes || !this.DOM.esfuerzoSemana || !this.DOM.esfuerzoDia || !this.DOM.esfuerzoHora) return;
        
        let fuenteDatos = esBruta && stats.esfuerzoBruto ? stats.esfuerzoBruto : stats.esfuerzo;
        
        if(fuenteDatos) {
            this.DOM.esfuerzoMes.innerHTML = this.zenMode ? "100.0%" : this.fmt(fuenteDatos.mes, this.currentModelData?.dolarBlue, this.currentModelData?.vistaUSD);
            this.DOM.esfuerzoSemana.innerHTML = this.zenMode ? "25.0%" : this.fmt(fuenteDatos.semana, this.currentModelData?.dolarBlue, this.currentModelData?.vistaUSD);
            this.DOM.esfuerzoDia.innerHTML = this.zenMode ? "4.1%" : this.fmt(fuenteDatos.dia, this.currentModelData?.dolarBlue, this.currentModelData?.vistaUSD);
            this.DOM.esfuerzoHora.innerHTML = this.zenMode ? "0.3%" : this.fmt(fuenteDatos.hora, this.currentModelData?.dolarBlue, this.currentModelData?.vistaUSD);
        }
    },

    renderFinanzaGeneral(modelData) {
        ErrorHandler.catchBoundary('Finanzas Generales', 'finanza-general', () => {
            let s = modelData.stats;

            if (this.DOM.metFugaMonto) this.DOM.metFugaMonto.innerHTML = this.zenMode ? "- %" : this.fmt(s.fugaCapitalMonto, modelData.dolarBlue, modelData.vistaUSD);
            if (this.DOM.metFugaPct) this.DOM.metFugaPct.innerText = (s.fugaPersonalPct || 0).toFixed(1) + "%";
            
            if (this.DOM.metSweepMonto) this.DOM.metSweepMonto.innerHTML = this.zenMode ? "- %" : this.fmt(s.sweepSugerido, modelData.dolarBlue, modelData.vistaUSD);

            if (this.DOM.metEquilibrioDia && this.DOM.barEquilibrio) {
                let diaEq = s.puntoEquilibrioHistorico || 30;
                this.DOM.metEquilibrioDia.innerText = `Día ${diaEq}`;
                let pctEq = (diaEq / 30) * 100;
                this.DOM.barEquilibrio.style.width = Math.min(100, pctEq) + "%";
                
                if (diaEq >= 30) this.DOM.barEquilibrio.style.backgroundColor = "var(--color-down)";
                else if(diaEq <= 10) this.DOM.barEquilibrio.style.backgroundColor = "var(--color-up)";
                else if(diaEq <= 20) this.DOM.barEquilibrio.style.backgroundColor = "var(--color-warning)";
                else this.DOM.barEquilibrio.style.backgroundColor = "var(--color-down)";
            }

            if (this.DOM.metCrossoverPct) {
                let cross = s.crossoverPct || 0;
                this.DOM.metCrossoverPct.innerText = cross.toFixed(1) + "%";
                if (this.DOM.barCrossover) this.DOM.barCrossover.style.width = Math.min(100, cross) + "%";
                
                if (this.DOM.lblCrossoverDetalles) {
                    this.DOM.lblCrossoverDetalles.innerText = `Tus inversiones te regalan ${(s.horasLibresRegaladas || 0).toFixed(1)} hs/mes libres.`;
                }
            }

            if (this.DOM.wrapTermometroDias) {
                let canvas = this.DOM.wrapTermometroDias.querySelector('canvas');
                if (!canvas) {
                    this.DOM.wrapTermometroDias.innerHTML = '<canvas id="chartTermometro"></canvas>';
                    canvas = this.DOM.wrapTermometroDias.querySelector('canvas');
                }
                let diasLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                let dataArr = [];
                for(let i=0; i<=6; i++) { dataArr.push(s.termometroDias[i] || 0); }
                
                if (this.chartTermometro) {
                    this.chartTermometro.data.datasets[0].data = dataArr;
                    this.chartTermometro.update('none');
                } else {
                    this.chartTermometro = new Chart(canvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: diasLabels,
                            datasets: [{
                                label: 'Promedio Bruto (ARS)',
                                data: dataArr,
                                backgroundColor: 'rgba(0, 245, 160, 0.4)',
                                borderColor: '#00F5A0',
                                borderWidth: 1,
                                borderRadius: 4
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, grid: { color: 'rgba(136, 146, 176, 0.15)' }, ticks: { color: '#8892b0' } },
                                x: { grid: { display: false }, ticks: { color: '#8892b0' } }
                            }
                        }
                    });
                }
            }

            if (this.DOM.metStockCosto) this.DOM.metStockCosto.innerHTML = this.zenMode ? "- %" : this.fmt(s.stockCosto, modelData.dolarBlue, modelData.vistaUSD);
            if (this.DOM.metStockRetail) this.DOM.metStockRetail.innerHTML = this.zenMode ? "- %" : this.fmt(s.stockValorVenta, modelData.dolarBlue, modelData.vistaUSD);
            if (this.DOM.metRatioLiquidez) this.DOM.metRatioLiquidez.innerText = `${s.liquidezAcida.toFixed(2)}x / ${s.liquidezCorriente.toFixed(2)}x`;
            
            if (this.DOM.metHedgeStock) {
                let inflacionTotal = 0;
                for(let k in modelData.inflacion) inflacionTotal += modelData.inflacion[k];
                
                let markupReal = s.stockCosto > 0 ? ((s.stockValorVenta - s.stockCosto) / s.stockCosto) * 100 : 0;
                let spread = markupReal - inflacionTotal;
                
                this.DOM.metHedgeStock.innerText = `${spread > 0 ? '+' : ''}${spread.toFixed(1)}%`;
                this.DOM.metHedgeStock.className = `stat__value data-font ${spread >= 0 ? 'texto-verde' : 'texto-rojo'}`;
            }

            if(this.DOM.metIngresoLocal) this.DOM.metIngresoLocal.innerHTML = this.zenMode ? "100.0%" : this.fmt(s.flowIngreso, modelData.dolarBlue, modelData.vistaUSD);
            
            let egresoTotalYRepartos = s.flowOperativo + s.flowProveedores + s.flowVida + (s.flowSociedad || 0);
            let pctEgreso = s.flowIngreso > 0 ? ((egresoTotalYRepartos / s.flowIngreso) * 100).toFixed(1) + "%" : "0%";
            
            if(this.DOM.metEgresoLocal) this.DOM.metEgresoLocal.innerHTML = this.zenMode ? pctEgreso : this.fmt(egresoTotalYRepartos, modelData.dolarBlue, modelData.vistaUSD);

            if (s.ventasMensuales && s.ventasMensuales.labels && s.ventasMensuales.labels.length > 0) {
                let div = modelData.vistaUSD ? modelData.dolarBlue : 1;
                let dataIngresos = s.ventasMensuales.data.map(v => v / div);
                let dataCostoVida = (s.ventasMensuales.dataCostoVida || []).map(v => v / div);
                ChartRenderer.renderVentasMensuales(s.ventasMensuales.labels, dataIngresos, dataCostoVida, 'wrap-ventas-mensuales');
            }

            const isBrutaActiva = document.getElementById('btn-rentabilidad-bruta')?.classList.contains('active') || false;
            this.actualizarRentabilidadFisica(s, isBrutaActiva);

            if(this.DOM.flowValIngreso) {
                this.DOM.flowValIngreso.innerHTML = this.zenMode ? "100%" : this.fmt(s.flowIngreso, modelData.dolarBlue, modelData.vistaUSD);
                
                let iTotal = s.flowIngreso > 0 ? s.flowIngreso : 1;
                
                this.DOM.flowValOperativo.innerHTML = this.zenMode ? ((s.flowOperativo / iTotal) * 100).toFixed(1) + "%" : this.fmt(s.flowOperativo, modelData.dolarBlue, modelData.vistaUSD);
                this.DOM.flowPctOperativo.innerText = ((s.flowOperativo / iTotal) * 100).toFixed(1) + "%";
                
                this.DOM.flowValProveedores.innerHTML = this.zenMode ? ((s.flowProveedores / iTotal) * 100).toFixed(1) + "%" : this.fmt(s.flowProveedores, modelData.dolarBlue, modelData.vistaUSD);
                this.DOM.flowPctProveedores.innerText = ((s.flowProveedores / iTotal) * 100).toFixed(1) + "%";
                
                if(this.DOM.flowValSociedad) {
                    this.DOM.flowValSociedad.innerHTML = this.zenMode ? (((s.flowSociedad || 0) / iTotal) * 100).toFixed(1) + "%" : this.fmt(s.flowSociedad || 0, modelData.dolarBlue, modelData.vistaUSD);
                    this.DOM.flowPctSociedad.innerText = (((s.flowSociedad || 0) / iTotal) * 100).toFixed(1) + "%";
                }
                
                this.DOM.flowValVida.innerHTML = this.zenMode ? ((s.flowVida / iTotal) * 100).toFixed(1) + "%" : this.fmt(s.flowVida, modelData.dolarBlue, modelData.vistaUSD);
                this.DOM.flowPctVida.innerText = ((s.flowVida / iTotal) * 100).toFixed(1) + "%";
                
                this.DOM.flowValAhorro.innerHTML = this.zenMode ? ((s.flowAhorro / iTotal) * 100).toFixed(1) + "%" : this.fmt(s.flowAhorro, modelData.dolarBlue, modelData.vistaUSD);
                this.DOM.flowPctAhorro.innerText = ((s.flowAhorro / iTotal) * 100).toFixed(1) + "%";
            }

            if (this.DOM.metTasaAhorro) {
                this.DOM.metTasaAhorro.innerText = s.tasaAhorroReal.toFixed(2) + "%";
                this.DOM.metTasaAhorro.className = `stat__value data-font ${s.tasaAhorroReal > 0 ? 'texto-verde' : ''}`;
            }
            
            if (this.DOM.metSupervivencia) {
                this.DOM.metSupervivencia.innerText = s.fondoSupervivenciaMeses.toFixed(1) + " Meses";
                if (s.fondoSupervivenciaMeses >= 6) this.DOM.metSupervivencia.className = "stat__value data-font texto-verde";
                else if (s.fondoSupervivenciaMeses >= 3) this.DOM.metSupervivencia.className = "stat__value data-font";
                else this.DOM.metSupervivencia.className = "stat__value data-font texto-rojo";
            }

            if (this.DOM.metCargaPct && this.DOM.barCarga && this.DOM.lblCargaEstado) {
                let carga = s.cargaFinancieraPct || 0;
                this.DOM.metCargaPct.innerText = carga.toFixed(1) + "%";
                this.DOM.barCarga.style.width = Math.min(carga, 100) + "%";
                
                if (carga === 0) {
                    this.DOM.barCarga.style.backgroundColor = "var(--color-up)";
                    this.DOM.lblCargaEstado.innerText = "Sin deudas activas este mes";
                    this.DOM.metCargaPct.style.color = "var(--color-up)";
                } else if (carga <= 15) {
                    this.DOM.barCarga.style.backgroundColor = "var(--color-up)";
                    this.DOM.lblCargaEstado.innerText = "Saludable (Bajo control)";
                    this.DOM.metCargaPct.style.color = "var(--color-up)";
                } else if (carga <= 30) {
                    this.DOM.barCarga.style.backgroundColor = "#f59e0b";
                    this.DOM.lblCargaEstado.innerText = "Precaución (Carga elevada)";
                    this.DOM.metCargaPct.style.color = "#f59e0b";
                } else {
                    this.DOM.barCarga.style.backgroundColor = "var(--color-down)";
                    this.DOM.lblCargaEstado.innerText = "Peligro Crítico (Sobrendeudamiento)";
                    this.DOM.metCargaPct.style.color = "var(--color-down)";
                }
            }

            if (this.DOM.tbodyProveedores) {
                let statsProvs = s.proveedoresDetalle || {};
                let provArray = [];
                
                for (let pNombre in statsProvs) {
                    provArray.push({ 
                        nombre: pNombre, 
                        total: statsProvs[pNombre].total
                    });
                }
                
                provArray.sort((a,b) => b.total - a.total);
                
                let provHtml = [];
                if (provArray.length === 0) {
                    provHtml.push('<tr><td colspan="2" style="text-align:center; padding: 40px; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin compras registradas</td></tr>');
                } else {
                    provArray.forEach(p => {
                        provHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 12px 0;"><strong>${DOMPurify.sanitize(p.nombre)}</strong></td>
                                <td class="data-font" style="text-align:right; padding: 12px 0; color:var(--text-main);"><strong class="privacy-mask">${this.zenMode ? '---' : '$' + this.fmtStr(p.total, 1, false)}</strong></td>
                            </tr>`
                        );
                    });
                }
                this.DOM.tbodyProveedores.innerHTML = provHtml.join('');
            }

            // CORRECCIÓN APLICADA: Inyección del Sub-Dashboard Global de Pasivos
            if (this.DOM.tbodyPrestamos) {
                let prestamos = s.prestamosDetalle || {};
                let prestamosHtml = [];
                let pArray = Object.values(prestamos).sort((a,b) => b.fecha.localeCompare(a.fecha));
                
                let headerElement = this.DOM.tbodyPrestamos.closest('.card').querySelector('h2');
                if (headerElement) {
                    headerElement.innerHTML = `Auditoría de Pasivos Activos (Bancarios/Préstamos)`;
                    
                    let oldSubDash = headerElement.nextElementSibling;
                    if(oldSubDash && oldSubDash.classList.contains('pasivos-subdash')) {
                        oldSubDash.remove();
                    }

                    let subDash = document.createElement('div');
                    subDash.className = 'pasivos-subdash grid-4';
                    subDash.style.gap = '10px';
                    subDash.style.marginBottom = '15px';
                    subDash.innerHTML = `
                        <div style="background:var(--bg-input); padding:10px; border-radius:6px; text-align:center;">
                            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Total Pedido (Capital)</div>
                            <div class="data-font privacy-mask" style="font-size:1.1rem; color:var(--text-main); font-weight:bold;">${this.zenMode ? '---' : '$' + this.fmtStr(s.totalPedidoPrestamos || 0, 1, false)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:10px; border-radius:6px; text-align:center; border: 1px solid var(--color-down);">
                            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Total Exigible (Deuda)</div>
                            <div class="data-font texto-rojo privacy-mask" style="font-size:1.1rem; font-weight:bold;">${this.zenMode ? '---' : '$' + this.fmtStr(s.totalDevolverPrestamos || 0, 1, false)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:10px; border-radius:6px; text-align:center;">
                            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Cuota Mensual Global</div>
                            <div class="data-font texto-warning privacy-mask" style="font-size:1.1rem; font-weight:bold;">${this.zenMode ? '---' : '$' + this.fmtStr(s.totalCuotaMensualPrestamos || 0, 1, false)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:10px; border-radius:6px; text-align:center;">
                            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Tasa de Interés Promedio</div>
                            <div class="data-font texto-primario privacy-mask" style="font-size:1.1rem; font-weight:bold;">${(s.tasaPromedioPrestamos || 0).toFixed(1)}%</div>
                        </div>
                    `;
                    headerElement.parentNode.insertBefore(subDash, headerElement.nextSibling);
                }

                if (pArray.length === 0) {
                    prestamosHtml.push('<tr><td colspan="7" style="text-align:center; padding: 40px; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Libre de deudas</td></tr>');
                } else {
                    pArray.forEach(p => {
                        let pct = Math.min(100, (p.pagado / p.totalDevolver) * 100);
                        let statusColor = p.activo ? 'var(--color-primary)' : 'var(--color-up)';
                        let statusLabel = p.activo ? 'Deuda Activa' : 'Saldado ✔️';
                        let cuotaActual = Math.min((p.cuotasPagadas || 0) + 1, p.cuotasTotales || 1);
                        let cuotaStr = p.activo ? `Cuota ${cuotaActual} de ${p.cuotasTotales || 1}` : `Saldado en ${p.cuotasTotales || 1} cuotas`;
                        let tasaInteres = p.tasaInteres || 0;
                        let cuotaMesCalculada = p.totalDevolver / (p.cuotasTotales || 1);
                        
                        prestamosHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color); opacity: ${p.activo ? '1' : '0.6'}; transition: opacity 0.3s;">
                                <td style="padding: 12px 0;">
                                    <strong>${DOMPurify.sanitize(p.entidad)}</strong><br>
                                    <span style="font-size:11px; color:var(--text-muted);">${p.fecha} | ${statusLabel}</span><br>
                                    <span style="font-size:11px; color:var(--color-accent); font-weight:600;">${cuotaStr}</span>
                                </td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 12px 0; color:var(--text-muted);">${this.zenMode ? '---' : '$' + this.fmtStr(p.capital, 1, false)}</td>
                                <td class="data-font" style="text-align:right; padding: 12px 0; color:var(--color-warning);">${tasaInteres.toFixed(1)}%</td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 12px 0; color:var(--color-primary);">${this.zenMode ? '---' : '$' + this.fmtStr(cuotaMesCalculada, 1, false)}</td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 12px 0; color:var(--color-up);">${this.zenMode ? '---' : '$' + this.fmtStr(p.pagado, 1, false)}</td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 12px 0;">${this.zenMode ? '---' : '$' + this.fmtStr(p.totalDevolver, 1, false)}</td>
                                <td style="vertical-align:middle; padding: 12px 0 12px 15px;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <div style="flex:1; height:6px; background:var(--bg-base); border-radius:3px; overflow:hidden;">
                                            <div style="height:100%; width:${pct}%; background:${statusColor}; border-radius:3px;"></div>
                                        </div>
                                        <span style="font-size:11px; width: 30px; text-align:right;" class="data-font">${pct.toFixed(0)}%</span>
                                    </div>
                                </td>
                            </tr>`
                        );
                    });
                }
                this.DOM.tbodyPrestamos.innerHTML = prestamosHtml.join('');
            }
            
            if (this.DOM.tbodyDeudasProveedores) {
                let deudas = s.deudaProveedoresDetalle || {};
                let deudasHtml = [];
                let dArray = Object.values(deudas).sort((a,b) => b.fecha.localeCompare(a.fecha));
                let totalDeudaProveedores = 0;

                dArray.forEach(d => {
                    if (d.activo) {
                        totalDeudaProveedores += (d.capitalExigibleTotal - d.capitalServido);
                    }
                });

                let headerElement = this.DOM.tbodyDeudasProveedores.closest('.card').querySelector('h2');
                if (headerElement) {
                    headerElement.innerHTML = `Auditoría de Cuentas Corrientes (Proveedores) <span class="data-font texto-warning privacy-mask" style="float:right; font-size:1rem;">Total Adeudado: ${this.zenMode ? '---' : '$' + this.fmtStr(totalDeudaProveedores, 1, false)}</span>`;
                }

                if (dArray.length === 0) {
                    deudasHtml.push('<tr><td colspan="4" style="text-align:center; padding: 40px; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No hay cuentas corrientes pendientes</td></tr>');
                } else {
                    dArray.forEach(d => {
                        let pct = Math.min(100, d.amortizacionPct || 0);
                        let statusColor = d.activo ? 'var(--color-warning)' : 'var(--color-up)';
                        let statusLabel = d.activo ? 'Deuda Pendiente' : 'Saldado ✔️';

                        deudasHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color); opacity: ${d.activo ? '1' : '0.6'}; transition: opacity 0.3s;">
                                <td style="padding: 12px 0;">
                                    <strong>${DOMPurify.sanitize(d.proveedor)}</strong><br>
                                    <span style="font-size:11px; color:var(--text-muted);">${d.fecha} | ${statusLabel}</span><br>
                                    <span style="font-size:11px; color:var(--text-muted);">ID: ${d.id}</span>
                                </td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 12px 0; color:var(--color-up);">${this.zenMode ? '---' : '$' + this.fmtStr(d.capitalServido, 1, false)}</td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 12px 0;">${this.zenMode ? '---' : '$' + this.fmtStr(d.capitalExigibleTotal, 1, false)}</td>
                                <td style="vertical-align:middle; padding: 12px 0 12px 15px;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <div style="flex:1; height:6px; background:var(--bg-base); border-radius:3px; overflow:hidden;">
                                            <div style="height:100%; width:${pct}%; background:${statusColor}; border-radius:3px;"></div>
                                        </div>
                                        <span style="font-size:11px; width: 30px; text-align:right;" class="data-font">${pct.toFixed(0)}%</span>
                                    </div>
                                </td>
                            </tr>`
                        );
                    });
                }
                this.DOM.tbodyDeudasProveedores.innerHTML = deudasHtml.join('');
            }
        });
    },
    
    renderAjustesInflacion() {
        ErrorHandler.catchBoundary('Ajustes de Inflación', 'lista-inflacion', () => {
            if(!this.currentModelData || !this.currentModelData.inflacion) return;
            const container = document.getElementById('lista-inflacion');
            if(!container) return;
            
            let inflacion = this.currentModelData.inflacion;
            let htmlBuffer = [
                '<div style="max-height: 250px; overflow-y: auto; background:var(--bg-base); border: 1px solid var(--border-color); border-radius:8px;">',
                '<table style="width:100%; text-align:left; font-size:13px; border-collapse: collapse;">',
                '<thead style="position: sticky; top: 0; background: var(--bg-input);"><tr><th style="padding:10px;">Período</th><th style="padding:10px;">Índice</th><th style="padding:10px; text-align:right;"></th></tr></thead>',
                '<tbody>'
            ];

            let keys = Object.keys(inflacion).sort().reverse();
            if (keys.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No has registrado datos de inflación.</div>';
                return;
            }

            keys.forEach(k => {
                htmlBuffer.push(
                    `<tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">`,
                    `<td style="padding: 10px; color:var(--text-main);"><strong>${DOMPurify.sanitize(k)}</strong></td>`,
                    `<td class="data-font privacy-mask" style="color:var(--color-up); padding:10px;">${inflacion[k]}%</td>`,
                    `<td style="text-align:right; padding:5px 10px;"><button class="btn--danger" style="padding: 4px 8px; font-size:10px;" data-action="borrar-inflacion" data-mes="${k}" title="Borrar">Eliminar</button></td>`,
                    `</tr>`
                );
            });

            htmlBuffer.push('</tbody></table></div>');
            container.innerHTML = htmlBuffer.join('');
        });
    },

    renderPortafolioVivo(modelData) {
        ErrorHandler.catchBoundary('Portafolio Bursátil', 'portafolio', () => {
            this.DOM.tbodyPortafolio.innerHTML = '';
            if(Object.keys(modelData.portafolio).length === 0) {
                this.DOM.tbodyPortafolio.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 60px; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Tu portafolio está vacío. Registra alguna operación de compra para comenzar a ver la magia.</td></tr>`;
                if (this.DOM.divBar) this.DOM.divBar.innerHTML = '';
                if (this.DOM.divLabels) this.DOM.divLabels.innerHTML = '';
                return;
            }

            let basePatrimonio = modelData.stats.billetera;
            let sectorChartData = {};
            let actChartData = {};
            const cachePrecios = modelData.cachePrecios || {};
            const fragment = document.createDocumentFragment();
            const template = this.DOM.tplPortafolio.content;
            let sparksToDraw = [];
            let expSectorialValor = {};
            let totalInvertidoMercado = 0;

            for(let activo in modelData.portafolio) {
                let d = modelData.portafolio[activo];
                if(d.cant <= 0.0001) continue;
                let ppp = d.costo / d.cant;
                let cIdx = activo.length % this.sectorColors.length;
                let actSafe = DOMPurify.sanitize(activo);
                let secSafe = DOMPurify.sanitize(d.sector);
                
                const row = document.importNode(template, true);
                let mainColor = this.sectorColors[cIdx];

                row.querySelector('.td-avatar').innerHTML = `<div class="asset-wrapper"><span class="asset-badge" style="border-left: 4px solid ${mainColor}; background: ${mainColor}22; color:${mainColor};">${actSafe}</span><div><span style="font-size:11px;color:var(--text-muted); text-transform:uppercase;">${secSafe}</span></div></div>`;
                row.querySelector('.td-cant').textContent = d.cant;
                row.querySelector('.td-ppp').innerHTML = this.zenMode ? '---' : this.fmt(ppp, modelData.dolarBlue, modelData.vistaUSD);
                row.querySelector('.td-costo').innerHTML = this.zenMode ? '---' : this.fmt(d.costo, modelData.dolarBlue, modelData.vistaUSD);
                
                let apiDataObj = cachePrecios[activo];
                let apiData = apiDataObj ? apiDataObj.data : null;
                let sparkWrap = row.querySelector('.td-spark div');
                let tdPrecio = row.querySelector('.td-precio');
                let tdGnr = row.querySelector('.td-gnr');
                let tdSma50 = row.querySelector('.td-sma50');
                let tdSma200 = row.querySelector('.td-sma200');

                if(apiData && apiData.price) {
                    let precio = apiData.price;
                    let valorMercado = precio * d.cant;
                    let ganancia = valorMercado - d.costo;
                    let pct = (ganancia / d.costo) * 100;
                    
                    tdPrecio.innerHTML = `<span class="td-sensitive"><strong>${this.zenMode ? '---' : this.fmt(precio, modelData.dolarBlue, modelData.vistaUSD)}</strong></span>`;
                    tdGnr.innerHTML = `<span class="td-sensitive ${ganancia>=0?'texto-verde':'texto-rojo'}">${ganancia>=0?'+':''}${this.zenMode ? pct.toFixed(2)+'%' : this.fmt(ganancia, modelData.dolarBlue, modelData.vistaUSD)} ${this.zenMode ? '' : '<small>('+pct.toFixed(2)+'%)</small>'}</span>`;
                    
                    tdSma50.innerHTML = apiData.sma50 ? (this.zenMode ? '---' : `<span class="privacy-mask">${this.fmt(apiData.sma50, modelData.dolarBlue, modelData.vistaUSD)}</span>`) : '-';
                    tdSma200.innerHTML = apiData.sma200 ? (this.zenMode ? '---' : `<span class="privacy-mask">${this.fmt(apiData.sma200, modelData.dolarBlue, modelData.vistaUSD)}</span>`) : '-';
                    
                    if(apiData.history && apiData.history.length > 0) {
                        let sparkColor = apiData.history[apiData.history.length-1] >= apiData.history[0] ? '#00F5A0' : '#FF005C';
                        sparkWrap.id = `spark-${actSafe}`;
                        sparkWrap.style.height = '30px';
                        sparkWrap.style.width = '60px';
                        sparksToDraw.push({ id: sparkWrap.id, history: apiData.history.slice(-7), color: sparkColor });
                    } else {
                        sparkWrap.innerHTML = '-';
                    }

                    basePatrimonio += valorMercado;
                    sectorChartData[d.sector] = (sectorChartData[d.sector]||0) + valorMercado;
                    actChartData[activo] = valorMercado;
                    expSectorialValor[d.sector] = (expSectorialValor[d.sector]||0) + valorMercado;
                    totalInvertidoMercado += valorMercado;

                } else if (apiData === null) {
                    tdPrecio.innerHTML = `<span class="texto-rojo" title="Sin cotización local">N/D</span>`;
                    tdGnr.innerHTML = `-`;
                    tdSma50.innerHTML = '-';
                    tdSma200.innerHTML = '-';
                    sparkWrap.innerHTML = '-';
                    
                    basePatrimonio += d.costo;
                    sectorChartData[d.sector] = (sectorChartData[d.sector]||0) + d.costo;
                    actChartData[activo] = d.costo;
                    expSectorialValor[d.sector] = (expSectorialValor[d.sector]||0) + d.costo;
                    totalInvertidoMercado += d.costo;
                } else {
                    tdPrecio.innerHTML = `<div class="skeleton" style="width:70px;"></div>`;
                    tdGnr.innerHTML = `<div class="skeleton" style="width:100px;"></div>`;
                    tdSma50.innerHTML = `<div class="skeleton" style="width:70px;"></div>`;
                    tdSma200.innerHTML = `<div class="skeleton" style="width:70px;"></div>`;
                    sparkWrap.innerHTML = `<div class="skeleton" style="width:60px; height:30px; border-radius:4px;"></div>`;
                }
                fragment.appendChild(row);
            }

            this.DOM.tbodyPortafolio.appendChild(fragment);

            requestAnimationFrame(() => {
                sparksToDraw.forEach(s => ChartRenderer.drawSparkline(s.id, s.history, s.color));
            });

            ChartRenderer.renderDona(sectorChartData, actChartData);

            if(this.DOM.divBar && this.DOM.divLabels) {
                if(totalInvertidoMercado > 0) {
                    let sColors = this.sectorColors;
                    let sIdx = 0;
                    let sortedSectores = Object.entries(expSectorialValor).sort((a,b) => b[1] - a[1]);
                    
                    let barBuffer = [];
                    let labelBuffer = [];
                    
                    sortedSectores.forEach(([sec, val]) => {
                        let pct = (val / totalInvertidoMercado) * 100;
                        if(pct > 0.1) {
                            let c = sColors[sIdx % sColors.length];
                            barBuffer.push(`<div class="div-segment" style="width:${pct}%; background-color:${c};" title="${sec}: ${pct.toFixed(1)}%"></div>`);
                            labelBuffer.push(`<div class="div-label-item"><div class="div-color-dot" style="background-color:${c};"></div><span>${DOMPurify.sanitize(sec)} <strong>${pct.toFixed(1)}%</strong></span></div>`);
                            sIdx++;
                        }
                    });
                    
                    this.DOM.divBar.innerHTML = barBuffer.join('');
                    this.DOM.divLabels.innerHTML = labelBuffer.join('');
                }
            }
        });
    },

    renderWatchlist(wlData) {
        if (!wlData || wlData.length === 0) {
            this.DOM.tbodyWatchlist.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color:var(--text-muted);">No sigues ningún activo aún.</td></tr>';
            return;
        }

        let wlBuffer = [];
        wlData.forEach(w => {
            let precioStr = '<div class="skeleton"></div>';
            let difStr = '-';
            
            if (w.precioActual !== null && w.precioActual !== undefined) {
                precioStr = `<strong class="privacy-mask">$${this.fmtStr(w.precioActual, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</strong>`;
                let colorClass = w.distancia >= 0 ? 'texto-verde' : 'texto-rojo';
                difStr = `<span class="${colorClass}">${w.distancia > 0 ? '+' : ''}${w.distancia.toFixed(2)}%</span>`;
            }

            wlBuffer.push(
                `<tr>`,
                `<td><strong>${DOMPurify.sanitize(w.activo)}</strong></td>`,
                `<td class="data-font">${this.zenMode ? '---' : precioStr}</td>`,
                `<td class="data-font privacy-mask">${this.zenMode ? '---' : '$' + this.fmtStr(w.precioObjetivo, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</td>`,
                `<td class="data-font">${this.zenMode ? '---' : difStr}</td>`,
                `<td><button class="btn--danger" style="padding: 4px 8px; font-size:10px;" data-action="del-watchlist" data-id="${w.activo}" title="Eliminar">Quitar</button></td>`,
                `</tr>`
            );
        });

        this.DOM.tbodyWatchlist.innerHTML = wlBuffer.join('');
    },

    aplicarFiltrosHistorial(filtros) {
        this.historialFiltros = filtros;
        this.renderVirtualScroll(true);
    },

    renderHistorial(modelData) {
        ErrorHandler.catchBoundary('Historial de Movimientos', 'historial', () => {
            UIMetrics.animateValue(this.DOM.histAhorroTotal, modelData.stats.totalAhorradoFisico, (val) => this.zenMode ? "---" : this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
            UIMetrics.animateValue(this.DOM.histRetiroTotal, modelData.stats.totalRetirado, (val) => this.zenMode ? "---" : this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
            UIMetrics.animateValue(this.DOM.histNeto, modelData.stats.ahorroArsPuro, (val) => this.zenMode ? "---" : this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));

            this.historialData = modelData.movimientos.slice().reverse();
            this.renderVirtualScroll();
        });
    },

    renderVirtualScroll(resetScroll = false) {
        let datosAmostrar = this.historialData;
        
        if(this.historialFiltros) {
            datosAmostrar = datosAmostrar.filter(m => {
                let pass = true;
                if(this.historialFiltros.desde && m.fecha < this.historialFiltros.desde) pass = false;
                if(this.historialFiltros.hasta && m.fecha > this.historialFiltros.hasta) pass = false;
                if(this.historialFiltros.tipo && this.historialFiltros.tipo !== 'Todos' && m.tipo !== this.historialFiltros.tipo) pass = false;
                return pass;
            });
        }

        if(resetScroll) {
            this.DOM.vsViewport.scrollTop = 0;
        }

        if(!datosAmostrar || datosAmostrar.length === 0) {
            this.DOM.vsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 80px; color:var(--text-muted);"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.3;"><use href="#icon-empty"></use></svg><br><h3 style="margin-bottom:5px;">El Libro Mayor está en blanco</h3><p style="font-size:0.85rem;">Registra un movimiento en la pestaña de Operar para comenzar.</p></td></tr>`;
            this.DOM.vsSpacer.style.height = '0px';
            this.DOM.vsTable.style.transform = `translateY(0px)`;
            return;
        }

        this.DOM.vsSpacer.style.height = `${datosAmostrar.length * this.vsRowHeight}px`;

        const scrollTop = this.DOM.vsViewport.scrollTop;
        const viewportHeight = this.DOM.vsViewport.clientHeight || 500;
        
        let startIndex = Math.floor(scrollTop / this.vsRowHeight);
        let visibleRows = Math.ceil(viewportHeight / this.vsRowHeight);
        
        const buffer = 5;
        startIndex = Math.max(0, startIndex - buffer);
        const endIndex = Math.min(datosAmostrar.length, startIndex + visibleRows + (buffer * 2));

        const existingRows = Array.from(this.DOM.vsTbody.children);
        const rowsNeeded = endIndex - startIndex;
        
        if (existingRows.length !== rowsNeeded || existingRows[0]?.dataset?.diffId === undefined) {
            const fragment = document.createDocumentFragment();
            const tpl = this.DOM.tplHistorial.content;

            for (let i = startIndex; i < endIndex; i++) {
                const m = datosAmostrar[i];
                const row = document.importNode(tpl, true);
                let tr = row.querySelector('tr');
                tr.dataset.diffId = m.id;
                
                let badgeClass = this.getBadgeClass(m.tipo);
                let descStr = m.activo ? `${m.cantidad||''}x ${m.activo}` : (m.categoria ? m.categoria : (m.proveedor ? m.proveedor : (m.socio ? m.socio : (m.entidad ? m.entidad : (m.tipo === 'Ajuste Stock Inicial' ? 'Inventario Base' : (m.usd?`u$s ${m.usd}`:'-'))))));
                let desc = DOMPurify.sanitize(descStr);
                
                if (m.notas) {
                    let markdownHtml = DOMPurify.sanitize(marked.parse(m.notas));
                    desc += `<div style="margin-top: 6px; font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 4px; border-left: 2px solid var(--color-primary); line-height:1.4;">${markdownHtml}</div>`;
                }

                let res = '-';
                if(m.resultadoCalculado !== undefined && m.tipo === 'Venta') {
                    let sign = m.resultadoCalculado > 0 ? '+' : (m.resultadoCalculado < 0 ? '-' : '');
                    let colorClass = m.resultadoCalculado >= 0 ? 'texto-verde' : 'texto-rojo';
                    let tag = this.currentModelData.vistaUSD ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
                    let valStr = this.fmtStr(Math.abs(m.resultadoCalculado), this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
                    res = `<div style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">${this.zenMode ? '' : tag} <strong class="data-font ${colorClass} privacy-mask">${sign}${this.zenMode ? '---' : valStr}</strong></div>`;
                }

                row.querySelector('.td-fecha').textContent = m.fecha;
                row.querySelector('.td-tipo').innerHTML = `<span class="badge ${badgeClass}">${m.tipo}</span>`;
                row.querySelector('.td-desc').innerHTML = desc;
                row.querySelector('.td-flujo').innerHTML = this.zenMode ? '---' : this.fmt(m.monto, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
                row.querySelector('.td-res').innerHTML = res;
                row.querySelector('.td-acc').innerHTML = `
                    <button class="btn--icon" style="display:inline-flex; padding:6px; margin-right:4px;" data-action="editar-operacion" data-id="${m.id}" title="Editar">
                        <svg width="16" height="16"><use href="#icon-edit"></use></svg>
                    </button>
                    <button class="btn--danger" style="display:inline-flex; padding:6px; border-radius:4px;" data-action="borrar-operacion" data-id="${m.id}" title="Eliminar">
                        <svg width="16" height="16"><use href="#icon-trash"></use></svg>
                    </button>
                `;
                fragment.appendChild(row);
            }
            this.DOM.vsTbody.innerHTML = '';
            this.DOM.vsTbody.appendChild(fragment);
        } 
        else {
            for (let i = startIndex; i < endIndex; i++) {
                const m = datosAmostrar[i];
                const tr = existingRows[i - startIndex];
                
                if (tr.dataset.diffId != m.id || this.zenMode !== (tr.dataset.zen === 'true')) {
                    tr.dataset.diffId = m.id;
                    tr.dataset.zen = this.zenMode;

                    let badgeClass = this.getBadgeClass(m.tipo);
                    let descStr = m.activo ? `${m.cantidad||''}x ${m.activo}` : (m.categoria ? m.categoria : (m.proveedor ? m.proveedor : (m.socio ? m.socio : (m.entidad ? m.entidad : (m.tipo === 'Ajuste Stock Inicial' ? 'Inventario Base' : (m.usd?`u$s ${m.usd}`:'-'))))));
                    let desc = DOMPurify.sanitize(descStr);
                    
                    if (m.notas) {
                        let markdownHtml = DOMPurify.sanitize(marked.parse(m.notas));
                        desc += `<div style="margin-top: 6px; font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 4px; border-left: 2px solid var(--color-primary); line-height:1.4;">${markdownHtml}</div>`;
                    }

                    let res = '-';
                    if(m.resultadoCalculado !== undefined && m.tipo === 'Venta') {
                        let sign = m.resultadoCalculado > 0 ? '+' : (m.resultadoCalculado < 0 ? '-' : '');
                        let colorClass = m.resultadoCalculado >= 0 ? 'texto-verde' : 'texto-rojo';
                        let tag = this.currentModelData.vistaUSD ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
                        let valStr = this.fmtStr(Math.abs(m.resultadoCalculado), this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
                        res = `<div style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">${this.zenMode ? '' : tag} <strong class="data-font ${colorClass} privacy-mask">${sign}${this.zenMode ? '---' : valStr}</strong></div>`;
                    }

                    tr.querySelector('.td-fecha').textContent = m.fecha;
                    tr.querySelector('.td-tipo').innerHTML = `<span class="badge ${badgeClass}">${m.tipo}</span>`;
                    tr.querySelector('.td-desc').innerHTML = desc;
                    tr.querySelector('.td-flujo').innerHTML = this.zenMode ? '---' : this.fmt(m.monto, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
                    tr.querySelector('.td-res').innerHTML = res;
                    tr.querySelector('.td-acc').innerHTML = `
                        <button class="btn--icon" style="display:inline-flex; padding:6px; margin-right:4px;" data-action="editar-operacion" data-id="${m.id}" title="Editar">
                            <svg width="16" height="16"><use href="#icon-edit"></use></svg>
                        </button>
                        <button class="btn--danger" style="display:inline-flex; padding:6px; border-radius:4px;" data-action="borrar-operacion" data-id="${m.id}" title="Eliminar">
                            <svg width="16" height="16"><use href="#icon-trash"></use></svg>
                        </button>
                    `;
                }
            }
        }
        this.DOM.vsTable.style.transform = `translateY(${startIndex * this.vsRowHeight}px)`;
    },

    renderCalendario(modelData) {
        ErrorHandler.catchBoundary('Calendario Financiero', 'calendario', () => {
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            this.DOM.calMesAno.innerText = `${meses[this.calMes]} ${this.calAno}`;
            
            let grid = this.DOM.calDias;
            grid.innerHTML = '';
            
            let primerDia = new Date(this.calAno, this.calMes, 1).getDay();
            if(primerDia === 0) primerDia = 7;
            
            let diasMes = new Date(this.calAno, this.calMes + 1, 0).getDate();
            
            const fragment = document.createDocumentFragment();
            const tpl = this.DOM.tplCalDay.content;

            for(let i=1; i<primerDia; i++) {
                let emptyDiv = document.createElement('div');
                emptyDiv.className = "cal-day empty";
                fragment.appendChild(emptyDiv);
            }

            for(let d=1; d<=diasMes; d++) {
                let fStr = `${this.calAno}-${String(this.calMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                let movs = modelData.movimientos.filter(m => m.fecha === fStr);
                
                let cssClass = (fStr === new Date().toISOString().split('T')[0]) ? 'today' : '';
                if(movs.length > 0) cssClass += ' has-data';
                
                const cellNode = document.importNode(tpl, true);
                const wrapper = cellNode.querySelector('.cal-day');
                wrapper.className = `cal-day ${cssClass}`;
                wrapper.querySelector('.cal-date').textContent = d;
                
                let dotsContainer = wrapper.querySelector('.cal-dots');
                movs.forEach(m => {
                    let c = this.getBadgeClass(m.tipo);
                    let dot = document.createElement('div');
                    dot.className = `cal-dot ${c}`;
                    dotsContainer.appendChild(dot);
                });
                
                wrapper.onclick = () => {
                    const p = this.DOM.calDetalle;
                    if(movs.length === 0) {
                        p.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 20px;"><h3 style="margin-bottom: 5px; font-size:16px;">${fStr}</h3><p>Día sin movimientos registrados.</p></div>`;
                        return;
                    }
                    
                    let detailBuffer = [`<h3 style="margin-bottom: 15px; font-size:16px;">Movimientos del ${fStr}</h3>`];
                    movs.forEach(m => {
                        let c = this.getBadgeClass(m.tipo);
                        let descStr = m.activo ? `${m.cantidad||''}x ${m.activo}` : (m.categoria ? m.categoria : (m.proveedor ? m.proveedor : (m.socio ? m.socio : (m.entidad ? m.entidad : (m.tipo === 'Ajuste Stock Inicial' ? 'Inventario Base' : (m.usd?`u$s ${m.usd}`:'-'))))));
                        let desc = DOMPurify.sanitize(descStr);
                        
                        detailBuffer.push(
                            `<div style="padding:10px 15px; background:var(--bg-input); border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">`,
                            `<div><span class="badge ${c}" style="margin-bottom:5px;">${m.tipo}</span><br><span style="font-size:13px;">${desc}</span></div>`,
                            `<strong class="data-font ${m.tipo==='Venta'?'texto-primario':''}">${this.zenMode ? '---' : this.fmt(m.monto, modelData.dolarBlue, modelData.vistaUSD)}</strong>`,
                            `</div>`
                        );
                    });
                    p.innerHTML = detailBuffer.join('');
                };
                fragment.appendChild(cellNode);
            }
            grid.appendChild(fragment);
        });
    },

    cambiarMesCalendario(d) {
        this.calMes += d;
        if(this.calMes > 11) { this.calMes = 0; this.calAno++; }
        if(this.calMes < 0) { this.calMes = 11; this.calAno--; }
        if(this.currentModelData) this.renderCalendario(this.currentModelData);
    },

    renderInformesPro(modelData) {
        ErrorHandler.catchBoundary('Informes Pro', 'informes', () => {
            let wrapDD = document.getElementById('wrap-drawdown');
            if(!wrapDD) return;
            
            let s = modelData.stats;

            if (this.DOM.infoHoldingPeriod) {
                this.DOM.infoHoldingPeriod.innerText = `${Math.round(s.holdingPeriodDias || 0)} Días`;
            }

            if (this.DOM.valCorrelacion && this.DOM.descCorrelacion) {
                let conc = s.riesgoConcentracion;
                if (conc && conc.hhi > 0) {
                    this.DOM.valCorrelacion.innerText = Math.round(conc.hhi);
                    this.DOM.descCorrelacion.innerText = conc.label;
                    let color = conc.hhi < 1500 ? 'var(--color-up)' : (conc.hhi < 2500 ? 'var(--color-warning)' : 'var(--color-down)');
                    this.DOM.valCorrelacion.style.color = color;
                } else {
                    this.DOM.valCorrelacion.innerText = '-';
                    this.DOM.descCorrelacion.innerText = 'Sin inversiones suficientes';
                }
            }

            if (this.DOM.infoAtribucionSector) {
                let attribBuffer = ['<table style="width:100%; font-size:13px; margin-top:10px;">'];
                let sectores = Object.entries(s.atribucionSector || {}).sort((a,b) => b[1] - a[1]);
                
                if(sectores.length === 0) {
                    attribBuffer.push('<tr><td style="color:var(--text-muted); text-align:center; padding:20px;">No hay ventas cerradas aún</td></tr>');
                } else {
                    sectores.forEach(([sector, resultado]) => {
                        let color = resultado >= 0 ? 'var(--color-up)' : 'var(--color-down)';
                        let signo = resultado > 0 ? '+' : (resultado < 0 ? '-' : '');
                        attribBuffer.push(
                            `<tr style="border-bottom: 1px solid var(--border-color);">`,
                            `<td style="padding: 10px 0; color:var(--text-main);">${DOMPurify.sanitize(sector)}</td>`,
                            `<td class="data-font privacy-mask" style="text-align:right; color:${color}; font-weight:bold;">${signo}${this.zenMode ? '---' : this.fmtStr(Math.abs(resultado), modelData.dolarBlue, modelData.vistaUSD)}</td>`,
                            `</tr>`
                        );
                    });
                }
                attribBuffer.push('</table>');
                this.DOM.infoAtribucionSector.innerHTML = attribBuffer.join('');
            }

            if (s.riesgo) {
                if (this.DOM.infoSharpe) this.DOM.infoSharpe.innerHTML = `<span class="data-font privacy-mask">${s.riesgo.sharpe}</span>`;
                if (this.DOM.infoSortino) this.DOM.infoSortino.innerHTML = `<span class="data-font privacy-mask">${s.riesgo.sortino}</span>`;
                if (this.DOM.infoVolatilidad) this.DOM.infoVolatilidad.innerHTML = `<span class="data-font privacy-mask">${s.riesgo.volatilidad}%</span>`;
            }

            let cagrColor = s.cagr >= 0 ? 'texto-verde' : 'texto-rojo';
            document.getElementById('info-cagr').innerHTML = `<span class="${cagrColor}">${(s.cagr || 0).toFixed(2)}%</span>`;

            if(!modelData.movimientos || modelData.movimientos.length === 0) {
                wrapDD.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin datos para graficar riesgo</div>';
                return;
            }

            let fechas = [...new Set(modelData.movimientos.map(m=>m.fecha))].sort();
            let pAcum = 0;
            let peak = 0;
            let dataDD = [];
            let dataFechas = [];
            let pnlMensual = {};
            let capMensualTracker = {};

            fechas.forEach((f) => {
                let diaMovs = modelData.movimientos.filter(x=>x.fecha===f);
                let valMes = f.substring(0,7);
                let year = valMes.split('-')[0];
                let month = valMes.split('-')[1];

                if(!pnlMensual[year]) pnlMensual[year] = {};
                if(!pnlMensual[year][month]) pnlMensual[year][month] = { pnlPuro: 0 };
                
                capMensualTracker[valMes] = pAcum;

                diaMovs.forEach(m => {
                    if(m.tipo === 'Compra' || m.tipo === 'Transferencia Ahorro') pAcum += m.monto;
                    if(m.tipo === 'Venta' || m.tipo === 'Retiro') pAcum -= m.monto;
                    
                    if(m.tipo === 'Venta' && m.resultadoCalculado) pnlMensual[year][month].pnlPuro += m.resultadoCalculado;
                });
                
                let val = modelData.vistaUSD ? (pAcum/modelData.dolarBlue) : pAcum;
                if(val > peak) peak = val;
                let dd = peak > 0 ? ((val - peak) / peak) * 100 : 0;
                dataDD.push(dd);
                dataFechas.push(f);
            });

            document.getElementById('info-max-patrimonio').innerHTML = this.zenMode ? '---' : this.fmt(peak, modelData.dolarBlue, modelData.vistaUSD);
            
            let maxDD = Math.min(...dataDD);
            if(!isFinite(maxDD)) maxDD = 0;
            document.getElementById('info-max-dd').innerText = maxDD.toFixed(2) + "%";
            document.getElementById('info-current-dd').innerText = "Drawdown Actual: " + (dataDD[dataDD.length-1] || 0).toFixed(2) + "%";

            ChartRenderer.renderDrawdown(dataFechas, dataDD);

            const hGrid = document.getElementById('heatmap-grid');
            let heatmapBuffer = [
                '<div class="hm-header">Año</div><div class="hm-header">Ene</div><div class="hm-header">Feb</div><div class="hm-header">Mar</div><div class="hm-header">Abr</div><div class="hm-header">May</div><div class="hm-header">Jun</div><div class="hm-header">Jul</div><div class="hm-header">Ago</div><div class="hm-header">Sep</div><div class="hm-header">Oct</div><div class="hm-header">Nov</div><div class="hm-header">Dic</div><div class="hm-header" style="color:var(--color-primary);">YTD</div>'
            ];

            Object.keys(pnlMensual).sort().reverse().forEach(y => {
                heatmapBuffer.push(`<div class="hm-cell" style="background:transparent; color:var(--text-main);">${DOMPurify.sanitize(y)}</div>`);
                let productReturnAnual = 1;
                
                for(let m=1; m<=12; m++) {
                    let mStr = String(m).padStart(2,'0');
                    let dataMes = pnlMensual[y][mStr];
                    if(dataMes === undefined) {
                        heatmapBuffer.push(`<div class="hm-cell" style="color:var(--text-muted); font-weight:normal;">-</div>`);
                    } else {
                        let capBaseMes = capMensualTracker[`${y}-${mStr}`] || 1;
                        if (capBaseMes <= 0) capBaseMes = 1;
                        
                        let returnPorcentual = (dataMes.pnlPuro / capBaseMes) * 100;
                        productReturnAnual *= (1 + (returnPorcentual / 100));
                        
                        let cls = '';
                        if(returnPorcentual > 5) cls = 'hm-cell--pos';
                        else if(returnPorcentual > 0) cls = 'hm-cell--pos';
                        else if(returnPorcentual < -5) cls = 'hm-cell--neg';
                        else if(returnPorcentual < 0) cls = 'hm-cell--neg';
                        
                        let numTxt = returnPorcentual === 0 ? '0%' : (returnPorcentual>0?'+':'') + returnPorcentual.toFixed(1) + '%';
                        let divValStr = this.fmtStr(modelData.vistaUSD ? (dataMes.pnlPuro/modelData.dolarBlue) : dataMes.pnlPuro, modelData.dolarBlue, modelData.vistaUSD);
                        
                        heatmapBuffer.push(`<div class="hm-cell ${cls}" title="PnL Mes: ${this.zenMode ? 'Oculto en Zen' : divValStr}">${numTxt}</div>`);
                    }
                }
                
                let ytdPct = (productReturnAnual - 1) * 100;
                let ytdCls = ytdPct >= 0 ? 'texto-verde' : 'texto-rojo';
                let ytdSign = ytdPct > 0 ? '+' : '';
                
                heatmapBuffer.push(`<div class="hm-cell data-font" style="background:transparent; border-left: 1px solid var(--border-color);"><span class="${ytdCls}">${ytdSign}${ytdPct.toFixed(1)}%</span></div>`);
            });

            hGrid.innerHTML = heatmapBuffer.join('');
        });
    },

    calcularInteres() {
        ErrorHandler.catchBoundary('Calculadora Compuesta', 'wrap-calc', () => {
            if(!this.DOM.calcInicial) return;
            
            const cIni = this.cleanNum(this.DOM.calcInicial.value);
            const cMen = this.cleanNum(this.DOM.calcMensual.value);
            const ans = this.cleanNum(this.DOM.calcAnos.value);
            const tAnual = this.cleanNum(this.DOM.calcTasa.value);

            if (ans <= 0 || tAnual < 0) return;
            
            let r = tAnual / 100;
            let t = ans;
            let pmtAnual = cMen * 12;

            let lbl = [];
            let dAp = [];
            let dInt = [];

            for(let i=1; i<=t; i++) {
                let aportado = cIni + (pmtAnual * i);
                let capCrecido = cIni * Math.pow(1 + r, i);
                let aportesCrecidos = r > 0 ? pmtAnual * ((Math.pow(1 + r, i) - 1) / r) : pmtAnual * i;
                let bal = capCrecido + aportesCrecidos;
                lbl.push(`Año ${i}`);
                dAp.push(aportado);
                dInt.push(bal - aportado);
            }

            let totalAportadoF = dAp[dAp.length-1] || 0;
            let totalInteresF = dInt[dInt.length-1] || 0;
            let capitalFinalF = totalAportadoF + totalInteresF;

            if (this.DOM.calcResAportado) this.DOM.calcResAportado.innerHTML = this.zenMode ? '---' : `<span class="privacy-mask">$ ${this.fmtStr(totalAportadoF, 1, false)}</span>`;
            if (this.DOM.calcResInteres) this.DOM.calcResInteres.innerHTML = `<span class="texto-verde privacy-mask">${this.zenMode ? '---' : '+$ ' + this.fmtStr(totalInteresF, 1, false)}</span>`;
            if (this.DOM.calcResFinal) this.DOM.calcResFinal.innerHTML = `<span class="texto-primario privacy-mask">${this.zenMode ? '---' : '$ ' + this.fmtStr(capitalFinalF, 1, false)}</span>`;
            
            if (this.DOM.wrapCalc) {
                ChartRenderer.renderCalculadora(lbl, dAp, dInt, 'chartCalculadora', '#00D1FF', '#00F5A0', this.DOM.wrapCalc);
            }
        });
    },

    initFIRE(modelData) {
        if(modelData && modelData.stats) {
            let capActual = modelData.stats.billetera + modelData.stats.capInvertido;
            let currentInpt = document.getElementById('fire-capital');
            if(currentInpt && capActual > 0 && parseFloat(currentInpt.value) === 0) {
                currentInpt.value = this.fmtStr(Math.round(capActual), 1, false);
            }
            
            let inGastoBase = document.getElementById('fire-gasto-base');
            if(inGastoBase && modelData.stats.gastoPersonalPromedioMes > 0) {
                inGastoBase.value = this.fmtStr(modelData.stats.gastoPersonalPromedioMes, 1, false);
            }
        }
        this.calcularFIRE();
    },

    calcularFIRE() {
        ErrorHandler.catchBoundary('Simulador FIRE', 'wrap-fire-chart', () => {
            const inGastoBase = document.getElementById('fire-gasto-base');
            if(!inGastoBase) return;
            
            const gastoBase = this.cleanNum(inGastoBase.value);
            const gastoExtra = this.cleanNum(document.getElementById('fire-gasto-extra').value);
            const capIni = this.cleanNum(document.getElementById('fire-capital').value);
            const ahorroMes = this.cleanNum(document.getElementById('fire-ahorro').value);
            const cagrPct = parseFloat(document.getElementById('fire-cagr').value) || 8;
            const swrPct = parseFloat(document.getElementById('fire-swr').value) || 4;

            const gastoTotal = gastoBase + gastoExtra;
            const gastoAnual = gastoTotal * 12;
            const targetFIRE = gastoAnual / (swrPct / 100);

            document.getElementById('fire-res-gasto').innerHTML = this.zenMode ? '---' : `<span class="privacy-mask">$ ${this.fmtStr(gastoTotal, 1, false)}</span>`;
            document.getElementById('fire-res-objetivo').innerHTML = this.zenMode ? '---' : `<span class="privacy-mask">$ ${this.fmtStr(targetFIRE, 1, false)}</span>`;

            let r = cagrPct / 100;
            let capitalAcumulado = capIni;
            let anos = 0;
            const maxAnos = 60;

            let lbl = ['Hoy'];
            let dataCapital = [capIni];
            let dataObjetivo = [targetFIRE];

            if(capIni < targetFIRE) {
                while(capitalAcumulado < targetFIRE && anos < maxAnos) {
                    anos++;
                    capitalAcumulado = (capitalAcumulado * (1 + r)) + (ahorroMes * 12);
                    lbl.push(`Año ${anos}`);
                    dataCapital.push(capitalAcumulado);
                    dataObjetivo.push(targetFIRE);
                }
            }

            let elAnos = document.getElementById('fire-res-anos');
            if(capIni >= targetFIRE) {
                elAnos.innerText = "¡FIRE Alcanzado!";
                elAnos.className = "data-font texto-primario";
            } else if (anos >= maxAnos) {
                elAnos.innerText = "+60 Años";
                elAnos.className = "data-font texto-rojo";
            } else {
                elAnos.innerText = `${anos} Años`;
                elAnos.className = `data-font ${anos <= 10 ? 'texto-verde' : (anos <= 20 ? 'texto-warning' : 'texto-rojo')}`;
            }

            const wrapChart = document.getElementById('wrap-fire-chart');
            if (wrapChart) {
                let canvas = wrapChart.querySelector('canvas');
                if (!canvas) {
                    wrapChart.innerHTML = '<canvas id="chartFIRE"></canvas>';
                    canvas = wrapChart.querySelector('canvas');
                }

                if (window.fireChartInstance) window.fireChartInstance.destroy();

                window.fireChartInstance = new Chart(canvas.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: lbl,
                        datasets: [
                            {
                                label: 'Capital Proyectado',
                                data: dataCapital,
                                borderColor: '#00F5A0',
                                backgroundColor: 'rgba(0, 245, 160, 0.1)',
                                borderWidth: 3,
                                fill: true,
                                pointRadius: 0
                            },
                            {
                                label: 'Objetivo FIRE',
                                data: dataObjetivo,
                                borderColor: '#B500FF',
                                borderDash: [5, 5],
                                borderWidth: 2,
                                fill: false,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { labels: { color: '#9ca3af' } } },
                        scales: {
                            x: { grid: { color: 'rgba(51, 65, 85, 0.3)' }, ticks: { color: '#9ca3af', maxTicksLimit: 10 } },
                            y: { grid: { color: 'rgba(51, 65, 85, 0.3)' }, ticks: { color: '#9ca3af' } }
                        }
                    }
                });
            }
        });
    }
};