"use strict";
import { ToastManager } from './views/ToastManager.js';
import { UIMetrics } from './views/UIMetrics.js';
import { ChartRenderer } from './views/ChartRenderer.js';
import { events } from './utils/events.js';
import { debounce } from './utils/helpers.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { FinancialMath } from './utils/financial.js'; 

export const view = {
    DOM: {}, calMes: new Date().getMonth(), calAno: new Date().getFullYear(),
    currentModelData: null, activeTab: 'dashboard', activeFilter: 'MAX',
    historialData: [], historialFiltros: null, vsRowHeight: 65, 
    sectorColors: ['#00FF95', '#FF4D8A', '#2CE6D6', '#FCA311', '#6045F4', '#FF871A', '#7C13A4', '#1AA7EC', '#F71735'],
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

    getDisplayTipo(tipo) {
        const mapa = {
            'Ingreso Local': 'Ingreso Comercial',
            'Gasto Local': 'Egreso Comercial',
            'Gasto Familiar': 'Egreso Personal',
            'Transferencia Ahorro': 'Inyección Liquidez',
            'Pago Proveedor': 'Pago Logístico',
            'Amortización Deuda a Proveedor': 'Amortización Logística',
            'Reparto Sociedad': 'Retiro Societario',
            'Ajuste Stock Inicial': 'Auditoría Inventario'
        };
        return mapa[tipo] || tipo;
    },
    
    initUI() {
        this.cacheDOM();
        this.bindUIEvents();
        this.bindBusinessEvents();
        this.setupSystemListeners();
        this.initFiltrosTemporales(); 
        this.initExportacionPDF(); 
        
        this.DOM.opFecha.value = new Date().toISOString().split('T')[0];
        if(this.DOM.ecoFecha) this.DOM.ecoFecha.value = new Date().toISOString().split('T')[0];
        
        if(this.DOM.dashRatioEI) this.DOM.dashRatioEI.style.display = 'none';

        const iconSvg = document.getElementById('icon-privacy-toggle');
        if (iconSvg) {
            iconSvg.innerHTML = document.body.classList.contains('privacy-active') ? `<use href="#icon-privacy-off"></use>` : `<use href="#icon-privacy"></use>`;
        }

        document.querySelectorAll('.format-number').forEach(input => {
            input.style.textAlign = 'right'; 
            input.addEventListener('input', function() {
                let clean = this.value.replace(/[^0-9,]/g, '');
                let parts = clean.split(',');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                if(parts.length > 2) parts.pop();
                this.value = parts.join(',');
            });
        });
        
        document.querySelectorAll('input[type="number"].data-font').forEach(input => {
            input.style.textAlign = 'right';
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
            
            if (btnFilter && !target.closest('.gastos-filter-group') && !target.closest('.sankey-filter-group')) {
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
        
        this.DOM.vsTbody?.addEventListener('mouseover', (e) => {
            let tr = e.target.closest('tr');
            if(tr) tr.style.zIndex = '10';
        });
        this.DOM.vsTbody?.addEventListener('mouseout', (e) => {
            let tr = e.target.closest('tr');
            if(tr) tr.style.zIndex = '1';
        });
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
                if (action === 'borrar-operacion' && confirm("¿Proceder con la eliminación del asiento contable?")) events.emit('ui:borrar-operacion', actionBtn.dataset.id);
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
                if (action === 'borrar-inflacion' && confirm(`¿Purgar dato estadístico de ${actionBtn.dataset.mes}?`)) events.emit('ui:borrar-inflacion', actionBtn.dataset.mes);
                
                if (action === 'verificar-pin') events.emit('ui:verificar-pin', document.getElementById('input-pin-login').value);
                if (action === 'guardar-pin') events.emit('ui:guardar-pin', document.getElementById('nuevo-pin').value);
                if (action === 'eliminar-pin') {
                    let p = prompt("Firma digital requerida (PIN):");
                    if(p !== null) events.emit('ui:eliminar-pin', p);
                }
                
                if (action === 'exportar') events.emit('ui:exportar');
                if (action === 'borrar-todo' && prompt("Validación de seguridad: Escriba BORRAR para formatear") === 'BORRAR') events.emit('ui:borrar-todo');
                if (action === 'cambiar-mes') this.cambiarMesCalendario(parseInt(actionBtn.dataset.dir));
            }
        });

        document.getElementById('file-import')?.addEventListener('change', (e) => {
            if(e.target.files.length > 0) events.emit('ui:importar-backup', e.target.files[0]);
        });
    },

    initFiltrosTemporales() {
        const attachGastos = (containerId, contexto, targetDomId) => {
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
                
                if (contexto === 'Local') events.emit('ui:cambio-temporalidad-gastos-local', btn.dataset.filter);
                if (contexto === 'Personal') events.emit('ui:cambio-temporalidad-gastos-personal', btn.dataset.filter);
            });
        };

        attachGastos('filtros-gastos-local', 'Local', 'wrap-gastos-local');
        attachGastos('filtros-gastos-personal', 'Personal', 'wrap-gastos-personal');

        const containerSankey = document.getElementById('filtros-sankey');
        if (containerSankey) {
            containerSankey.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn--filter');
                if (!btn) return;

                containerSankey.querySelectorAll('.btn--filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                events.emit('ui:cambio-temporalidad-sankey', btn.dataset.filter);
            });
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
        
        if (this.DOM.tituloOperarBursatil) this.DOM.tituloOperarBursatil.innerText = "Auditar Inversión Bursátil";
        if (this.DOM.tituloOperarEco) this.DOM.tituloOperarEco.innerText = "Auditar Asiento de Caja";
        if (this.DOM.tituloConfirmar) this.DOM.tituloConfirmar.innerText = "Consolidar Modificación";
        if (this.DOM.btnGuardarOp) {
            this.DOM.btnGuardarOp.innerHTML = `<span style="display:inline-flex; gap:8px; align-items:center;"><svg width="18" height="18"><use href="#icon-edit"></use></svg> Sobrescribir Registro</span>`;
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
            this.toast(this.zenMode ? "Modo Relativo Activado (%)" : "Modo Absoluto Activado ($)", "success");
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
            document.querySelectorAll('.btn--filter:not(.gastos-filter-btn):not(.sankey-filter-btn)').forEach(b => b.classList.remove('active'));
            document.querySelector(`.btn--filter:not(.gastos-filter-btn):not(.sankey-filter-btn)[data-filter="${filtro}"]`)?.classList.add('active');
            if(this.currentModelData) this.renderEvolucion();
        });

        events.on('app:marketStatus', (isOpen) => {
            let dot = document.getElementById('market-dot');
            let text = document.getElementById('market-text');
            if(dot && text) {
                dot.className = isOpen ? 'market-dot market-dot--open' : 'market-dot market-dot--closed';
                text.innerText = isOpen ? 'Mercado Operativo' : 'Mercado Cerrado';
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

            if (this.DOM.tituloOperarBursatil) this.DOM.tituloOperarBursatil.innerText = "Transacciones Bursátiles";
            if (this.DOM.tituloOperarEco) this.DOM.tituloOperarEco.innerText = "Flujos Operativos y Personales";
            if (this.DOM.tituloConfirmar) this.DOM.tituloConfirmar.innerText = "Aprobación de la Transacción";
            
            if (this.DOM.btnGuardarOp) {
                this.DOM.btnGuardarOp.innerHTML = "Consolidar Registro";
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
            this.DOM.hintCantidad.innerText = `Tenencia actual confirmada: ${tenencia}`;
            const isEditing = !this.DOM.btnCancelarEdicion.classList.contains('is-hidden');
            if (!isEditing && inputCant > tenencia) {
                this.DOM.opCantidad.value = tenencia;
                this.DOM.hintCantidad.innerText = `Tope nominal alcanzado: ${tenencia}`;
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

        this.DOM.lblMonto.innerText = t === 'Dividendo' ? 'Rendimiento Distribuido (ARS)' : 'Impacto Consolidado (ARS)';
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
            
            this.DOM.ecoCategoria.outerHTML = `<input type="text" id="eco-categoria" list="lista-categorias-eco" placeholder="Selección de categoría de asignación...">` + datalistHtml;
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
                if (hint) hint.innerText = "La omisión asume un margen de utilidad nulo para este asiento logístico.";
            }
            
            let provs = this.currentModelData?.proveedores || [];
            let datalistHtml = '<datalist id="lista-proveedores">';
            provs.forEach(p => { datalistHtml += `<option value="${p.nombre}">`; });
            datalistHtml += '</datalist>';
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" list="lista-proveedores" placeholder="Identificador legal/comercial">` + datalistHtml;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor'); 
        } 
        else if (t === 'Amortización Deuda a Proveedor') {
            if (this.DOM.bloquePagoDeudaProveedor) this.DOM.bloquePagoDeudaProveedor.classList.remove('is-hidden');
            
            let deudas = this.currentModelData?.stats?.deudaProveedoresDetalle || {};
            let optionsHtml = '<option value="">-- Vincular Deuda Logística --</option>';
            
            for(let key in deudas) {
                let d = deudas[key];
                if(d.activo) {
                    let pendiente = d.capitalExigibleTotal - d.capitalServido;
                    optionsHtml += `<option value="${d.id}">${DOMPurify.sanitize(d.proveedor)} (Saldo Pendiente $${this.fmtStr(pendiente, 1, false)}) - ${d.fecha}</option>`;
                }
            }
            if (this.DOM.ecoDeudaProveedorId) this.DOM.ecoDeudaProveedorId.innerHTML = optionsHtml;
        }
        else if (t === 'Reparto Sociedad') {
            this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
            this.DOM.grupoEcoProveedor.classList.remove('is-hidden');
            this.DOM.ecoProveedor.placeholder = "Identificación de socio receptor";
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" placeholder="Identificación de socio receptor">`;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor');
        }
        else if (t === 'Ajuste Stock Inicial') {
            if (this.DOM.rowEcoValorVenta) {
                this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
                this.DOM.rowEcoValorVenta.classList.remove('is-hidden');
                let hint = document.getElementById('hint-valor-venta');
                if (hint) hint.innerText = "Proyección de ingresos asumiendo la liquidación total del inventario base.";
            }
        }
        else if (t === 'Alta Préstamo') {
            this.DOM.bloquePrestamosAlta.classList.remove('is-hidden');
        }
        else if (t === 'Pago Préstamo') {
            this.DOM.bloquePrestamosPago.classList.remove('is-hidden');
            let prestamos = this.currentModelData?.stats?.prestamosDetalle || {};
            let optionsHtml = '<option value="">-- Seleccionar Obligación --</option>';
            
            for(let key in prestamos) {
                let p = prestamos[key];
                if(p.activo) {
                    let deudaPendiente = p.totalDevolver - p.pagado;
                    optionsHtml += `<option value="${p.id}">${DOMPurify.sanitize(p.entidad)} (Saldo $${this.fmtStr(deudaPendiente, 1, false)})</option>`;
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
                
                let scLabel = "Riesgo Estructural";
                let scColor = "var(--color-down)";
                if (sc >= 700) { scLabel = "Operativa Óptima"; scColor = "var(--color-up)"; }
                else if (sc >= 400) { scLabel = "Balance Estable"; scColor = "var(--color-warning)"; }
                
                this.DOM.dashHealthScore.style.color = scColor;
                this.DOM.dashHealthLabel.innerText = scLabel;
                this.DOM.dashHealthLabel.style.color = scColor;
                
                let rgbaColor = scColor.includes('up') ? 'rgba(0, 255, 149, 0.2)' : (scColor.includes('warning') ? 'rgba(252, 163, 17, 0.2)' : 'rgba(247, 23, 53, 0.2)');
                this.DOM.dashHealthScore.closest('.card').style.borderColor = scColor;
                this.DOM.dashHealthScore.closest('.card').style.boxShadow = `0 0 20px ${rgbaColor}`;
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
            
            ChartRenderer.drawDashboardSparkline('spark-dash-total', arrPatrimonio, '#6045F4'); 
            ChartRenderer.drawDashboardSparkline('spark-dash-liquidez', arrLiquidez, '#00FF95'); 
            ChartRenderer.drawDashboardSparkline('spark-dash-invertido', arrInvertido, '#FF4D8A'); 

            if (this.DOM.lblPatSub1) {
                let cagrStr = `<span class="${s.cagr >= 0 ? 'texto-verde' : 'texto-rojo'} privacy-mask" style="font-weight:900;">${(s.cagr || 0).toFixed(2)}%</span>`;
                this.DOM.lblPatSub1.innerText = "TIR Proyectada (XIRR)";
                this.DOM.valPatSub1.innerHTML = cagrStr;
                
                let tagHtml = modelData.vistaUSD ? 'USD' : '$';
                this.DOM.lblPatSub2.innerText = "Ahorro de Bolsillo Total";
                this.DOM.valPatSub2.innerHTML = this.zenMode ? `<strong>-</strong>` : `<strong>${tagHtml} <span class="privacy-mask">${this.fmtStr(s.ahorroArsPuro, modelData.dolarBlue, modelData.vistaUSD)}</span></strong>`;
                
                let supStr = `<strong style="color: var(--color-primary); text-shadow: var(--shadow-neon-primary);">${(s.fondoSupervivenciaMeses || 0).toFixed(1)} Meses</strong>`;
                let tasaAhStr = `<span class="texto-verde privacy-mask">${(s.tasaAhorroReal || 0).toFixed(1)}%</span>`;
                
                this.DOM.lblLiqSub1.innerText = "Fondo Supervivencia Local";
                this.DOM.valLiqSub1.innerHTML = supStr;
                
                this.DOM.lblLiqSub2.innerText = "Tasa de Retención Real";
                this.DOM.valLiqSub2.innerHTML = tasaAhStr;
                
                this.DOM.lblInvSub1.innerText = "Dólar Promedio Histórico";
                this.DOM.valInvSub1.innerHTML = `<strong>$ <span class="privacy-mask">${this.fmtStr(s.precioPromedioDolar || 0, 1, false)}</span></strong>`;
                
                this.DOM.lblInvSub2.innerText = "Trades Ejecutados";
                this.DOM.valInvSub2.innerHTML = `<strong style="color: var(--color-accent); text-shadow: var(--shadow-neon-accent);">${s.vTotal || 0}</strong>`;
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
                <div style="display:flex; align-items:center; gap:10px; width:100%; overflow:hidden;">
                    <span class="${ganColor}" style="font-size:1.6rem; font-weight:900;">${ganSign}</span>
                    ${this.zenMode ? '' : tagHtm}
                    <span class="${ganColor} data-font privacy-mask" style="font-size:1.8rem; font-weight:900; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${displayGanancia}</span>
                </div>
            `;
            
            this.DOM.dashPasivos.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; width:100%; overflow:hidden;">
                    <span class="texto-primario" style="font-size:1.6rem; font-weight:900;">+</span>
                    ${this.zenMode ? '' : tagHtm}
                    <span class="texto-primario data-font privacy-mask" style="font-size:1.8rem; font-weight:900; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${displayPasivos}</span>
                </div>
            `;

            let wr = s.vTotal > 0 ? (s.vGanadas/s.vTotal*100).toFixed(1) : 0;
            this.DOM.dashWinrate.innerHTML = `
                <div style="display:flex; align-items:baseline; gap:10px; width:100%; overflow:hidden;">
                    <span class="data-font" style="font-size:1.8rem; font-weight:900; color: var(--color-warning); text-shadow: var(--shadow-neon-warning);">${wr}%</span>
                    <span style="font-size:1rem; color:var(--text-muted); font-weight:700; white-space:nowrap;">(${s.vGanadas}/${s.vTotal})</span>
                </div>
            `;

            let topAct = '-', maxR = -Infinity;
            for(let k in s.rendimientoPorActivo) {
                if(s.rendimientoPorActivo[k] > maxR) { maxR = s.rendimientoPorActivo[k]; topAct = k; }
            }
            
            this.DOM.dashTop.innerHTML = `
                <div style="display:flex; align-items:center; width:100%; overflow:hidden;">
                    <span class="data-font" style="font-size:1.8rem; font-weight:900; color:var(--color-purple); text-shadow: var(--shadow-neon-purple); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${DOMPurify.sanitize(topAct !== '-' ? topAct : '-')}</span>
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

    actualizarSankey(stats, temporalidad) {
        if (!this.DOM.flowValIngreso) return;
        const div = this.currentModelData?.vistaUSD ? this.currentModelData.dolarBlue : 1;
        const isUSD = this.currentModelData?.vistaUSD;

        let ingresosBrutos = (stats.ingresosLocal || 0) / div;
        let gastosLocales = (stats.gastosLocal || 0) / div;
        let pagosProv = (stats.pagosProveedores || 0) / div;
        let gastosPersonales = (stats.gastosFamiliar || 0) / div;
        let flowSociedad = (stats.sociedadRetiros || 0) / div;
        let inver = (stats.totalAhorrado || 0) / div;

        const aplicarPromedio = (monto) => {
            if (!temporalidad || temporalidad.toLowerCase() === 'histórico' || temporalidad.toLowerCase() === 'historico') return monto;
            
            let meses = stats.numMesesOperativos || 1;
            let val = monto;
            
            if (temporalidad.toLowerCase() === 'anual') {
                val = monto / Math.max(1, meses / 12);
            } else if (temporalidad.toLowerCase() === 'mensual') {
                val = monto / meses;
            } else if (temporalidad.toLowerCase() === 'semanal') {
                val = (monto / meses) / 4.3333; 
            } else if (temporalidad.toLowerCase() === 'diario') {
                val = (monto / meses) / 30.416; 
            }
            return Math.max(0, val);
        };

        let iTotal = aplicarPromedio(ingresosBrutos);
        let gLocal = aplicarPromedio(gastosLocales);
        let pProv = aplicarPromedio(pagosProv);
        let gPers = aplicarPromedio(gastosPersonales);
        let soc = aplicarPromedio(flowSociedad);
        let ah = aplicarPromedio(inver);

        let iRef = iTotal > 0 ? iTotal : 1;

        this.DOM.flowValIngreso.innerHTML = this.zenMode ? "100%" : this.fmt(iTotal * div, div, isUSD);

        this.DOM.flowValOperativo.innerHTML = this.zenMode ? ((gLocal / iRef) * 100).toFixed(1) + "%" : this.fmt(gLocal * div, div, isUSD);
        this.DOM.flowPctOperativo.innerText = ((gLocal / iRef) * 100).toFixed(1) + "%";

        this.DOM.flowValProveedores.innerHTML = this.zenMode ? ((pProv / iRef) * 100).toFixed(1) + "%" : this.fmt(pProv * div, div, isUSD);
        this.DOM.flowPctProveedores.innerText = ((pProv / iRef) * 100).toFixed(1) + "%";

        if (this.DOM.flowValSociedad) {
            this.DOM.flowValSociedad.innerHTML = this.zenMode ? ((soc / iRef) * 100).toFixed(1) + "%" : this.fmt(soc * div, div, isUSD);
            this.DOM.flowPctSociedad.innerText = ((soc / iRef) * 100).toFixed(1) + "%";
        }

        this.DOM.flowValVida.innerHTML = this.zenMode ? ((gPers / iRef) * 100).toFixed(1) + "%" : this.fmt(gPers * div, div, isUSD);
        this.DOM.flowPctVida.innerText = ((gPers / iRef) * 100).toFixed(1) + "%";

        this.DOM.flowValAhorro.innerHTML = this.zenMode ? ((ah / iRef) * 100).toFixed(1) + "%" : this.fmt(ah * div, div, isUSD);
        this.DOM.flowPctAhorro.innerText = ((ah / iRef) * 100).toFixed(1) + "%";
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
                    this.DOM.lblCrossoverDetalles.innerText = `Sustitución operativa: ${(s.horasLibresRegaladas || 0).toFixed(1)} hs/mes.`;
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
                
                const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
                const colorUp = getCSS('--color-up', '#00FF95'); 

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
                                backgroundColor: colorUp,
                                borderColor: '#000000',
                                borderWidth: document.documentElement.getAttribute('data-theme') === 'light' ? 2 : 0,
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { font: { weight: 'bold' } } },
                                x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
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

            this.actualizarSankey(s, modelData.uiState?.sankeyTemporalidad || 'Histórico');

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
                    this.DOM.lblCargaEstado.innerText = "Libre de deudas operativas";
                    this.DOM.metCargaPct.style.color = "var(--color-up)";
                } else if (carga <= 15) {
                    this.DOM.barCarga.style.backgroundColor = "var(--color-up)";
                    this.DOM.lblCargaEstado.innerText = "Saludable (Bajo control)";
                    this.DOM.metCargaPct.style.color = "var(--color-up)";
                } else if (carga <= 30) {
                    this.DOM.barCarga.style.backgroundColor = "var(--color-warning)";
                    this.DOM.lblCargaEstado.innerText = "Precaución (Carga elevada)";
                    this.DOM.metCargaPct.style.color = "var(--color-warning)";
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
                    provArray.push({ nombre: pNombre, total: statsProvs[pNombre].total });
                }
                
                provArray.sort((a,b) => b.total - a.total);
                
                let provHtml = [];
                if (provArray.length === 0) {
                    provHtml.push('<tr><td colspan="2" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin registros logísticos recientes</td></tr>');
                } else {
                    provArray.forEach((p, index) => {
                        let pColor = index === 0 ? 'var(--color-accent)' : 'var(--color-primary)';
                        provHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-input); transition: transform 0.2s; cursor: default;">
                                <td style="padding: 18px 25px; font-size: 1.15rem; font-weight: 900; color: ${pColor}; text-shadow: 0 0 10px ${pColor}40;">
                                    ${DOMPurify.sanitize(p.nombre)}
                                </td>
                                <td class="data-font" style="text-align:right; padding: 18px 25px; font-size: 1.25rem; font-weight: 900; color: var(--color-up); text-shadow: var(--shadow-neon-up);">
                                    <strong class="privacy-mask">${this.zenMode ? '---' : '$' + this.fmtStr(p.total, 1, false)}</strong>
                                </td>
                            </tr>`
                        );
                    });
                }
                this.DOM.tbodyProveedores.innerHTML = provHtml.join('');
            }

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
                    subDash.style.gap = '15px';
                    subDash.style.marginBottom = '25px';
                    subDash.innerHTML = `
                        <div style="background:var(--bg-input); padding:15px; border-radius:12px; text-align:center; border: 1px solid var(--border-color); box-shadow: var(--shadow-card);">
                            <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight: 900; letter-spacing: 1px;">Total Pedido (Capital)</div>
                            <div class="data-font privacy-mask" style="font-size:1.4rem; color:var(--text-main); font-weight:900; margin-top: 5px;">${this.zenMode ? '---' : '$' + this.fmtStr(s.totalPedidoPrestamos || 0, 1, false)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:15px; border-radius:12px; text-align:center; border: 2px solid var(--color-down); box-shadow: var(--shadow-neon-down);">
                            <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight: 900; letter-spacing: 1px;">Total Exigible (Deuda)</div>
                            <div class="data-font texto-rojo privacy-mask" style="font-size:1.4rem; font-weight:900; margin-top: 5px;">${this.zenMode ? '---' : '$' + this.fmtStr(s.totalDevolverPrestamos || 0, 1, false)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:15px; border-radius:12px; text-align:center; border: 1px solid var(--color-warning); box-shadow: var(--shadow-neon-warning);">
                            <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight: 900; letter-spacing: 1px;">Cuota Mensual Global</div>
                            <div class="data-font texto-warning privacy-mask" style="font-size:1.4rem; font-weight:900; margin-top: 5px;">${this.zenMode ? '---' : '$' + this.fmtStr(s.totalCuotaMensualPrestamos || 0, 1, false)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:15px; border-radius:12px; text-align:center; border: 1px solid var(--color-primary); box-shadow: var(--shadow-neon-primary);">
                            <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight: 900; letter-spacing: 1px;">Tasa de Interés (Prom)</div>
                            <div class="data-font texto-primario privacy-mask" style="font-size:1.4rem; font-weight:900; margin-top: 5px;">${(s.tasaPromedioPrestamos || 0).toFixed(1)}%</div>
                        </div>
                    `;
                    headerElement.parentNode.insertBefore(subDash, headerElement.nextSibling);
                }

                if (pArray.length === 0) {
                    prestamosHtml.push('<tr><td colspan="7" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sistema libre de deudas financieras</td></tr>');
                } else {
                    pArray.forEach(p => {
                        let pct = Math.min(100, (p.pagado / p.totalDevolver) * 100);
                        let statusColor = p.activo ? 'var(--color-primary)' : 'var(--color-up)';
                        let statusLabel = p.activo ? 'Deuda Activa' : 'Liquidado';
                        let cuotaActual = Math.min((p.cuotasPagadas || 0) + 1, p.cuotasTotales || 1);
                        let cuotaStr = p.activo ? `Cuota ${cuotaActual} de ${p.cuotasTotales || 1}` : `Cancelado en ${p.cuotasTotales || 1} pagos`;
                        let tasaInteres = p.tasaInteres || 0;
                        let cuotaMesCalculada = p.totalDevolver / (p.cuotasTotales || 1);
                        
                        prestamosHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color); opacity: ${p.activo ? '1' : '0.4'}; background: var(--bg-input); transition: all 0.3s ease;">
                                <td style="padding: 16px 20px;">
                                    <strong style="font-size: 1.15rem; color: var(--text-main); font-weight: 900; letter-spacing: 0.5px;">${DOMPurify.sanitize(p.entidad)}</strong><br>
                                    <span style="font-size:0.85rem; color:var(--text-muted); font-weight: 700;">${p.fecha} | ${statusLabel}</span><br>
                                    <span style="font-size:0.85rem; color:var(--color-accent); font-weight:900; text-transform: uppercase;">${cuotaStr}</span>
                                </td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 16px 20px; font-size: 1.1rem; color:var(--text-muted); font-weight: 800;">${this.zenMode ? '---' : '$' + this.fmtStr(p.capital, 1, false)}</td>
                                <td class="data-font texto-warning" style="text-align:right; padding: 16px 20px; font-size: 1.1rem; font-weight: 900;">${tasaInteres.toFixed(1)}%</td>
                                <td class="data-font texto-primario privacy-mask" style="text-align:right; padding: 16px 20px; font-size: 1.1rem; font-weight: 900;">${this.zenMode ? '---' : '$' + this.fmtStr(cuotaMesCalculada, 1, false)}</td>
                                <td class="data-font texto-verde privacy-mask" style="text-align:right; padding: 16px 20px; font-size: 1.1rem; font-weight: 900;">${this.zenMode ? '---' : '$' + this.fmtStr(p.pagado, 1, false)}</td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 16px 20px; font-size: 1.15rem; font-weight: 900; color: var(--text-main);">${this.zenMode ? '---' : '$' + this.fmtStr(p.totalDevolver, 1, false)}</td>
                                <td style="vertical-align:middle; padding: 16px 20px;">
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <div style="flex:1; height:8px; background:var(--bg-base); border-radius:4px; overflow:hidden; border: 1px solid var(--border-color);">
                                            <div style="height:100%; width:${pct}%; background:${statusColor}; box-shadow: 0 0 10px ${statusColor}; border-radius:4px;"></div>
                                        </div>
                                        <span style="font-size:0.9rem; font-weight: 900; width: 40px; text-align:right; color: ${statusColor};" class="data-font">${pct.toFixed(0)}%</span>
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
                    headerElement.innerHTML = `Auditoría de Cuentas Corrientes (Proveedores) 
                        <span class="data-font texto-warning privacy-mask" style="float:right; font-size:1.2rem; background: rgba(252, 163, 17, 0.1); padding: 5px 15px; border-radius: 8px; border: 1px solid var(--color-warning);">
                            Total Pendiente: ${this.zenMode ? '---' : '$' + this.fmtStr(totalDeudaProveedores, 1, false)}
                        </span>`;
                }

                if (dArray.length === 0) {
                    deudasHtml.push('<tr><td colspan="4" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Auditoría en cero. Sin cuentas pendientes</td></tr>');
                } else {
                    dArray.forEach(d => {
                        let pct = Math.min(100, d.amortizacionPct || 0);
                        let statusColor = d.activo ? 'var(--color-orange)' : 'var(--color-up)';
                        let statusLabel = d.activo ? 'Saldo Pendiente' : 'Liquidada';

                        deudasHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color); opacity: ${d.activo ? '1' : '0.4'}; background: var(--bg-input); transition: all 0.3s ease;">
                                <td style="padding: 16px 20px;">
                                    <strong style="font-size: 1.15rem; color: var(--text-main); font-weight: 900; letter-spacing: 0.5px;">${DOMPurify.sanitize(d.proveedor)}</strong><br>
                                    <span style="font-size:0.85rem; color:var(--text-muted); font-weight: 700;">${d.fecha} | ${statusLabel}</span><br>
                                    <span style="font-size:0.8rem; color:var(--color-purple); font-weight: 900;">ID REF: ${d.id}</span>
                                </td>
                                <td class="data-font texto-verde privacy-mask" style="text-align:right; padding: 16px 20px; font-size: 1.15rem; font-weight: 900;">${this.zenMode ? '---' : '$' + this.fmtStr(d.capitalServido, 1, false)}</td>
                                <td class="data-font privacy-mask" style="text-align:right; padding: 16px 20px; font-size: 1.2rem; font-weight: 900; color: var(--text-main);">${this.zenMode ? '---' : '$' + this.fmtStr(d.capitalExigibleTotal, 1, false)}</td>
                                <td style="vertical-align:middle; padding: 16px 20px;">
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <div style="flex:1; height:8px; background:var(--bg-base); border-radius:4px; overflow:hidden; border: 1px solid var(--border-color);">
                                            <div style="height:100%; width:${pct}%; background:${statusColor}; box-shadow: 0 0 10px ${statusColor}; border-radius:4px;"></div>
                                        </div>
                                        <span style="font-size:0.9rem; font-weight: 900; width: 40px; text-align:right; color: ${statusColor};" class="data-font">${pct.toFixed(0)}%</span>
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
                '<div style="max-height: 250px; overflow-y: auto; background:var(--bg-base); border: 1px solid var(--border-color); border-radius:12px;">',
                '<table class="dataTable-table" style="width:100%; text-align:left; border-collapse: collapse;">',
                '<thead style="position: sticky; top: 0; background: var(--bg-panel); backdrop-filter: var(--glass-blur);"><tr><th style="padding:15px; font-weight: 900; text-transform: uppercase;">Período</th><th style="padding:15px; font-weight: 900; text-transform: uppercase; text-align:right;">Índice</th><th style="padding:15px; text-align:right;"></th></tr></thead>',
                '<tbody>'
            ];

            let keys = Object.keys(inflacion).sort().reverse();
            if (keys.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted); border: 2px dashed var(--border-color); border-radius: 12px;"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Ausencia de índices macroeconómicos.</div>';
                return;
            }

            keys.forEach(k => {
                htmlBuffer.push(
                    `<tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s; background: var(--bg-input);">`,
                    `<td style="padding: 15px; color:var(--text-main); font-size: 1rem;"><strong style="letter-spacing: 0.5px;">${DOMPurify.sanitize(k)}</strong></td>`,
                    `<td class="data-font privacy-mask texto-warning" style="padding:15px; font-size: 1.1rem; text-align:right;">${inflacion[k]}%</td>`,
                    `<td style="text-align:right; padding:15px;"><button class="btn--danger" style="padding: 6px 12px; font-size:11px; border-radius: 6px;" data-action="borrar-inflacion" data-mes="${k}" title="Borrar">Eliminar</button></td>`,
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
                this.DOM.tbodyPortafolio.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin instrumentos en cartera. Registre operaciones para iniciar la auditoría.</td></tr>`;
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

                row.querySelector('.td-avatar').innerHTML = `<div class="asset-wrapper" style="display:flex; align-items:center; gap:12px;"><span class="asset-badge" style="padding:6px 12px; border-radius:8px; font-weight:900; border-left: 4px solid ${mainColor}; background: ${mainColor}22; color:${mainColor}; box-shadow: -2px 0 10px ${mainColor}40;">${actSafe}</span><div><span style="font-size:11px;color:var(--text-muted); font-weight: 900; text-transform:uppercase;">${secSafe}</span></div></div>`;
                row.querySelector('.td-cant').innerHTML = `<strong style="font-size: 1.1rem;">${d.cant}</strong>`;
                row.querySelector('.td-cant').style.textAlign = 'right';
                
                row.querySelector('.td-ppp').innerHTML = this.zenMode ? '---' : this.fmt(ppp, modelData.dolarBlue, modelData.vistaUSD);
                row.querySelector('.td-ppp').style.textAlign = 'right';
                
                row.querySelector('.td-costo').innerHTML = this.zenMode ? '---' : this.fmt(d.costo, modelData.dolarBlue, modelData.vistaUSD);
                row.querySelector('.td-costo').style.textAlign = 'right';
                
                let apiDataObj = cachePrecios[activo];
                let apiData = apiDataObj ? apiDataObj.data : null;
                let sparkWrap = row.querySelector('.td-spark div');
                let tdPrecio = row.querySelector('.td-precio');
                let tdGnr = row.querySelector('.td-gnr');
                
                tdPrecio.style.textAlign = 'right';
                tdGnr.style.textAlign = 'right';

                if(apiData && apiData.price) {
                    let precio = apiData.price;
                    let valorMercado = precio * d.cant;
                    let ganancia = valorMercado - d.costo;
                    let pct = (ganancia / d.costo) * 100;
                    
                    let pColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#0A0D14' : 'var(--text-main)';
                    tdPrecio.innerHTML = `<span class="td-sensitive"><strong style="font-size: 1.15rem; color: ${pColor};">${this.zenMode ? '---' : this.fmt(precio, modelData.dolarBlue, modelData.vistaUSD)}</strong></span>`;
                    tdGnr.innerHTML = `<span class="td-sensitive ${ganancia>=0?'texto-verde':'texto-rojo'}" style="font-size: 1.15rem;">${ganancia>=0?'+':''}${this.zenMode ? pct.toFixed(2)+'%' : this.fmt(ganancia, modelData.dolarBlue, modelData.vistaUSD)} ${this.zenMode ? '' : '<small style="font-size: 0.85rem; opacity: 0.8;">('+pct.toFixed(2)+'%)</small>'}</span>`;
                    
                    if(apiData.history && apiData.history.length > 0) {
                        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
                        let sparkColor = apiData.history[apiData.history.length-1] >= apiData.history[0] ? getCSS('--color-up', '#00FF95') : getCSS('--color-down', '#F71735');
                        sparkWrap.id = `spark-${actSafe}`;
                        sparkWrap.style.height = '35px';
                        sparkWrap.style.width = '70px';
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
                    tdPrecio.innerHTML = `<span class="texto-rojo" title="Sin cotización local" style="font-weight: 900;">N/D</span>`;
                    tdGnr.innerHTML = `<strong style="color: var(--text-muted);">-</strong>`;
                    sparkWrap.innerHTML = '-';
                    
                    basePatrimonio += d.costo;
                    sectorChartData[d.sector] = (sectorChartData[d.sector]||0) + d.costo;
                    actChartData[activo] = d.costo;
                    expSectorialValor[d.sector] = (expSectorialValor[d.sector]||0) + d.costo;
                    totalInvertidoMercado += d.costo;
                } else {
                    tdPrecio.innerHTML = `<div class="skeleton" style="width:80px; margin-left:auto;"></div>`;
                    tdGnr.innerHTML = `<div class="skeleton" style="width:100px; margin-left:auto;"></div>`;
                    sparkWrap.innerHTML = `<div class="skeleton" style="width:70px; height:35px; border-radius:6px;"></div>`;
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
                            barBuffer.push(`<div class="div-segment" style="width:${pct}%; background-color:${c}; box-shadow: inset 0 0 5px rgba(0,0,0,0.2);" title="${sec}: ${pct.toFixed(1)}%"></div>`);
                            labelBuffer.push(`<div class="div-label-item"><div class="div-color-dot" style="background-color:${c}; box-shadow: 0 0 8px ${c};"></div><span style="font-weight: 700;">${DOMPurify.sanitize(sec)} <strong style="color: var(--text-main);">${pct.toFixed(1)}%</strong></span></div>`);
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
            this.DOM.tbodyWatchlist.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color:var(--text-muted); font-weight: 800; border-bottom: none;">Sin activos en seguimiento.</td></tr>';
            return;
        }

        let wlBuffer = [];
        wlData.forEach(w => {
            let precioStr = '<div class="skeleton" style="width: 80px; margin-left:auto;"></div>';
            let difStr = '-';
            
            if (w.precioActual !== null && w.precioActual !== undefined) {
                precioStr = `<strong class="privacy-mask" style="font-size: 1.15rem;">$${this.fmtStr(w.precioActual, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</strong>`;
                let colorClass = w.distancia >= 0 ? 'texto-verde' : 'texto-rojo';
                difStr = `<span class="${colorClass}" style="font-size: 1.15rem;">${w.distancia > 0 ? '+' : ''}${w.distancia.toFixed(2)}%</span>`;
            }

            wlBuffer.push(
                `<tr style="transition: background 0.2s; background: var(--bg-input); border-bottom: 1px solid var(--border-color);">`,
                `<td style="padding: 15px 20px;"><strong style="color: var(--color-primary); font-size: 1.15rem; text-shadow: var(--shadow-neon-primary);">${DOMPurify.sanitize(w.activo)}</strong></td>`,
                `<td class="data-font" style="padding: 15px 20px; text-align:right;">${this.zenMode ? '---' : precioStr}</td>`,
                `<td class="data-font privacy-mask" style="padding: 15px 20px; font-size: 1.15rem; text-align:right;">${this.zenMode ? '---' : '$' + this.fmtStr(w.precioObjetivo, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</td>`,
                `<td class="data-font" style="padding: 15px 20px; text-align:right;">${this.zenMode ? '---' : difStr}</td>`,
                `<td style="padding: 15px 20px; text-align:center;"><button class="btn--danger" style="padding: 8px 16px; font-size:11px; border-radius: 8px;" data-action="del-watchlist" data-id="${w.activo}" title="Eliminar del Monitor">Desvincular</button></td>`,
                `</tr>`
            );
        });

        this.DOM.tbodyWatchlist.innerHTML = wlBuffer.join('');
    },

    renderHistorial(modelData) {
        ErrorHandler.catchBoundary('Libro Mayor', 'historial', () => {
            if(!modelData) return;
            
            const s = modelData.stats;
            this.DOM.histAhorroTotal.innerHTML = this.zenMode ? "---" : this.fmt(s.totalAhorrado, modelData.dolarBlue, modelData.vistaUSD);
            this.DOM.histRetiroTotal.innerHTML = this.zenMode ? "---" : this.fmt(s.totalRetirado, modelData.dolarBlue, modelData.vistaUSD);
            this.DOM.histNeto.innerHTML = this.zenMode ? "---" : this.fmt(s.flujoNeto, modelData.dolarBlue, modelData.vistaUSD);
            
            let filtrados = FinancialMath.filtrarHistorialAvanzado(modelData.movimientos, this.historialFiltros);
            this.historialData = filtrados;
            
            if (this.historialData.length === 0) {
                this.DOM.vsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Auditoría en cero. Sin asientos contables registrados.</td></tr>';
                this.DOM.vsSpacer.style.height = '0px';
                return;
            }

            this.DOM.vsSpacer.style.height = (this.historialData.length * this.vsRowHeight) + 'px';
            this.renderVirtualScroll();
        });
    },

    aplicarFiltrosHistorial(filtros) {
        this.historialFiltros = filtros;
        this.DOM.vsViewport.scrollTop = 0;
        this.renderHistorial(this.currentModelData);
    },

    renderVirtualScroll() {
        if (this.historialData.length === 0) return;

        const scrollTop = this.DOM.vsViewport.scrollTop;
        const viewportHeight = this.DOM.vsViewport.clientHeight;
        
        let startIndex = Math.floor(scrollTop / this.vsRowHeight);
        let endIndex = startIndex + Math.ceil(viewportHeight / this.vsRowHeight) + 2;
        
        startIndex = Math.max(0, startIndex - 2);
        endIndex = Math.min(this.historialData.length, endIndex);
        
        const visibleData = this.historialData.slice(startIndex, endIndex);
        const template = this.DOM.tplHistorial.content;
        const fragment = document.createDocumentFragment();
        const div = this.currentModelData.vistaUSD ? this.currentModelData.dolarBlue : 1;
        const isUSD = this.currentModelData.vistaUSD;

        visibleData.forEach((mov) => {
            const row = document.importNode(template, true);
            const tr = row.querySelector('tr');
            tr.style.height = this.vsRowHeight + 'px';
            
            let tagClass = this.getBadgeClass(mov.tipo);
            let displayTipo = this.getDisplayTipo(mov.tipo);

            let desc = '';
            if(['Compra','Venta','Dividendo'].includes(mov.tipo)) desc = `${DOMPurify.sanitize(mov.activo)} ${mov.cantidad ? '('+mov.cantidad+' nom)' : ''}`;
            else if (mov.tipo === 'Gasto Local' || mov.tipo === 'Gasto Familiar') desc = DOMPurify.sanitize(mov.categoria || 'Sin clasificar');
            else if (mov.tipo === 'Pago Proveedor' || mov.tipo === 'Amortización Deuda a Proveedor') desc = DOMPurify.sanitize(mov.proveedor || 'No especificado');
            else if (mov.tipo === 'Reparto Sociedad') desc = `Socio: ${DOMPurify.sanitize(mov.socio || 'No especificado')}`;
            else if (mov.tipo === 'Alta Préstamo' || mov.tipo === 'Pago Préstamo') desc = `Entidad: ${DOMPurify.sanitize(mov.entidad || 'Financiera')}`;
            
            let monto = mov.monto;
            if (['Transferencia Ahorro', 'Ahorro'].includes(mov.tipo) && mov.usd > 0 && isUSD) monto = mov.usd;
            else monto = monto / div;

            let colorMonto = 'var(--text-main)';
            let sign = '';
            if (['Ingreso Local', 'Ahorro', 'Transferencia Ahorro', 'Venta', 'Dividendo', 'Rendimiento', 'Alta Préstamo'].includes(mov.tipo)) {
                colorMonto = 'var(--color-up)';
                sign = '+';
            } else if (['Gasto Local', 'Gasto Familiar', 'Pago Proveedor', 'Amortización Deuda a Proveedor', 'Reparto Sociedad', 'Compra', 'Retiro', 'Pago Préstamo'].includes(mov.tipo)) {
                colorMonto = 'var(--color-down)';
                sign = '-';
            }

            row.querySelector('.td-fecha').innerText = mov.fecha;
            row.querySelector('.td-tipo').innerHTML = `<span class="badge ${tagClass}">${displayTipo}</span>`;
            row.querySelector('.td-desc').innerHTML = desc !== '' ? desc : '<span style="color:var(--text-muted);">-</span>';
            
            if(mov.notas) {
                row.querySelector('.td-desc').innerHTML += ` <span data-tooltip="${DOMPurify.sanitize(mov.notas)}" style="margin-left:8px; color:var(--color-primary); cursor:help;"><svg width="14" height="14" style="vertical-align:middle;"><use href="#icon-note"></use></svg></span>`;
            }

            row.querySelector('.td-flujo').innerHTML = `<strong style="color: ${colorMonto};">${sign}${this.zenMode ? '---' : this.fmt(monto, 1, isUSD)}</strong>`;

            let tagHtml = isUSD ? `<span class="tag--usd" style="padding:2px 4px; font-size:10px;">USD</span>` : `<span class="tag--ars" style="padding:2px 4px; font-size:10px;">ARS</span>`;
            row.querySelector('.td-res').innerHTML = this.zenMode ? '---' : tagHtml;

            row.querySelector('.td-acc').innerHTML = `
                <div style="display:flex; gap:8px; justify-content:center;">
                    <button class="btn--icon" data-action="editar-operacion" data-id="${mov.id}" title="Editar Registro"><svg width="16" height="16"><use href="#icon-edit"></use></svg></button>
                    <button class="btn--icon" style="color:var(--color-down)!important; background:rgba(247,23,53,0.1);" data-action="borrar-operacion" data-id="${mov.id}" title="Eliminar Registro"><svg width="16" height="16"><use href="#icon-trash"></use></svg></button>
                </div>
            `;

            fragment.appendChild(row);
        });

        this.DOM.vsTbody.innerHTML = '';
        this.DOM.vsTbody.appendChild(fragment);
        this.DOM.vsTable.style.transform = `translateY(${startIndex * this.vsRowHeight}px)`;
    },

    renderInformesPro(modelData) {
        ErrorHandler.catchBoundary('Informes Avanzados', 'informes', () => {
            const s = modelData.stats;

            if (this.DOM.infoHoldingPeriod) this.DOM.infoHoldingPeriod.innerText = `${s.holdingPeriodDias} Días`;
            
            if (this.DOM.infoSharpe) {
                this.DOM.infoSharpe.innerText = (s.sharpeRatio || 0).toFixed(2);
                this.DOM.infoSharpe.className = `stat__value data-font ${s.sharpeRatio >= 1 ? 'texto-verde' : (s.sharpeRatio > 0 ? 'texto-warning' : 'texto-rojo')}`;
            }
            
            if (this.DOM.infoSortino) {
                this.DOM.infoSortino.innerText = (s.sortinoRatio || 0).toFixed(2);
                this.DOM.infoSortino.className = `stat__value data-font ${s.sortinoRatio >= 1.5 ? 'texto-verde' : (s.sortinoRatio > 0 ? 'texto-warning' : 'texto-rojo')}`;
            }
            
            if (this.DOM.infoVolatilidad) this.DOM.infoVolatilidad.innerText = (s.volatilidadAnualizada || 0).toFixed(1) + "%";

            let correlacionStr = s.correlacionIndice ? (s.correlacionIndice).toFixed(2) : "0.00";
            if(this.DOM.valCorrelacion) this.DOM.valCorrelacion.innerText = correlacionStr;
            
            if(this.DOM.descCorrelacion && s.correlacionIndice !== undefined) {
                if(s.correlacionIndice < 0.15) { 
                    this.DOM.descCorrelacion.innerText = "Excelente Diversificación (Bajo Riesgo)"; 
                    this.DOM.valCorrelacion.className = "data-font texto-verde"; 
                } else if(s.correlacionIndice < 0.25) { 
                    this.DOM.descCorrelacion.innerText = "Concentración Moderada (Estable)"; 
                    this.DOM.valCorrelacion.className = "data-font texto-warning"; 
                } else { 
                    this.DOM.descCorrelacion.innerText = "Alta Concentración (Riesgo Sistémico)"; 
                    this.DOM.valCorrelacion.className = "data-font texto-rojo"; 
                }
            }

            let maxPatStr = this.zenMode ? '---' : this.fmt(s.maxPatrimonio, modelData.dolarBlue, modelData.vistaUSD);
            let maxDDStr = `${s.maxDrawdownPct.toFixed(2)}%`;
            let currDDStr = `Tensión Actual: ${s.currentDrawdownPct.toFixed(2)}%`;
            
            let cagrHtml = `<div style="display:flex; align-items:baseline; justify-content:center; gap:5px;"><span class="${s.cagr >= 0 ? 'texto-verde' : 'texto-rojo'}">${s.cagr.toFixed(2)}%</span><span style="font-size:0.85rem; color:var(--text-muted); font-weight:700;">TIR</span></div>`;
            
            const cagrDOM = document.getElementById('info-cagr');
            if (cagrDOM) cagrDOM.innerHTML = cagrHtml;
            
            const maxPatDOM = document.getElementById('info-max-patrimonio');
            if (maxPatDOM) maxPatDOM.innerHTML = `<span class="privacy-mask">${maxPatStr}</span>`;
            
            const maxDdDOM = document.getElementById('info-max-dd');
            if (maxDdDOM) maxDdDOM.innerText = maxDDStr;
            
            const currDdDOM = document.getElementById('info-current-dd');
            if (currDdDOM) currDdDOM.innerText = currDDStr;

            if (this.DOM.infoAtribucionSector) {
                let atr = s.atribucionSectorial;
                if(Object.keys(atr).length === 0) {
                    this.DOM.infoAtribucionSector.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 40px; font-weight:800;">Sin posiciones activas.</div>';
                } else {
                    let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
                    let sortedSectores = Object.entries(atr).sort((a,b) => b[1] - a[1]);
                    
                    sortedSectores.forEach(([sec, val], idx) => {
                        let c = this.sectorColors[idx % this.sectorColors.length];
                        let vStr = this.zenMode ? '---' : this.fmtStr(Math.abs(val), modelData.dolarBlue, modelData.vistaUSD);
                        let sign = val >= 0 ? '+' : '-';
                        let col = val >= 0 ? 'var(--color-up)' : 'var(--color-down)';
                        
                        html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-input); padding: 16px 20px; border-radius:12px; border-left: 4px solid ${c}; transition: transform 0.2s;">
                                <span style="font-weight:900; font-size:1rem; color:var(--text-main); letter-spacing: 0.5px;">${DOMPurify.sanitize(sec)}</span>
                                <span class="data-font privacy-mask" style="color:${col}; font-weight:900; font-size:1.15rem; text-shadow: 0 0 10px ${col}40;">${sign}$${vStr}</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                    this.DOM.infoAtribucionSector.innerHTML = html;
                }
            }

            let hmGrid = document.getElementById('heatmap-grid');
            if (hmGrid && s.heatmapMensual) {
                let hm = s.heatmapMensual;
                let años = Object.keys(hm).sort((a,b)=>b-a);
                
                if (años.length === 0) {
                    hmGrid.innerHTML = '<div style="grid-column: 1 / -1; color:var(--text-muted); padding: 40px; font-weight:800;">Datos insuficientes para generar matriz térmica.</div>';
                } else {
                    let header = '<div class="hm-header">AÑO</div>';
                    const mesesStr = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    mesesStr.forEach(m => header += `<div class="hm-header">${m}</div>`);
                    header += '<div class="hm-header" style="color:var(--color-primary);">YTD</div>';
                    
                    let body = '';
                    años.forEach(a => {
                        body += `<div class="hm-cell" style="background:var(--bg-input); color:var(--text-main); font-weight:900;">${a}</div>`;
                        let rowYTD = 0;
                        for(let i=1; i<=12; i++) {
                            let val = hm[a][i];
                            if(val !== undefined) {
                                rowYTD += val;
                                let cClass = val > 0 ? 'hm-cell--pos' : (val < 0 ? 'hm-cell--neg' : '');
                                let vStr = val > 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;
                                body += `<div class="hm-cell ${cClass} data-font">${vStr}</div>`;
                            } else {
                                body += `<div class="hm-cell" style="color:var(--text-muted); opacity:0.3;">-</div>`;
                            }
                        }
                        let ytdClass = rowYTD > 0 ? 'hm-cell--pos' : (rowYTD < 0 ? 'hm-cell--neg' : '');
                        let ytdStr = rowYTD > 0 ? `+${rowYTD.toFixed(1)}%` : `${rowYTD.toFixed(1)}%`;
                        body += `<div class="hm-cell ${ytdClass} data-font" style="border:1px solid var(--border-color);">${ytdStr}</div>`;
                    });
                    
                    hmGrid.innerHTML = header + body;
                }
            }

            if (s.historyFechas && s.historyDrawdown) {
                ChartRenderer.renderDrawdown(s.historyFechas, s.historyDrawdown);
            }
        });
    },

    renderCalendario(modelData) {
        ErrorHandler.catchBoundary('Calendario Operativo', 'calendario', () => {
            const m = modelData.movimientos;
            
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            this.DOM.calMesAno.innerText = `${monthNames[this.calMes]} ${this.calAno}`;
            
            const firstDay = new Date(this.calAno, this.calMes, 1).getDay();
            const daysInMonth = new Date(this.calAno, this.calMes + 1, 0).getDate();
            const startOffset = firstDay === 0 ? 6 : firstDay - 1; 
            
            let movsDelMes = m.filter(mov => {
                let d = new Date(mov.fecha + "T00:00:00");
                return d.getMonth() === this.calMes && d.getFullYear() === this.calAno;
            });

            let mapDias = {};
            movsDelMes.forEach(mov => {
                let d = parseInt(mov.fecha.split('-')[2]);
                if(!mapDias[d]) mapDias[d] = [];
                mapDias[d].push(mov);
            });

            this.DOM.calDias.innerHTML = '';
            const template = this.DOM.tplCalDay.content;
            const fragment = document.createDocumentFragment();
            
            let hoy = new Date();
            let isCurrentMonth = (hoy.getMonth() === this.calMes && hoy.getFullYear() === this.calAno);
            
            for(let i=0; i<startOffset; i++) {
                const el = document.importNode(template, true);
                let div = el.querySelector('.cal-day');
                div.classList.add('empty');
                fragment.appendChild(el);
            }
            
            for(let d=1; d<=daysInMonth; d++) {
                const el = document.importNode(template, true);
                let div = el.querySelector('.cal-day');
                let dateEl = el.querySelector('.cal-date');
                let dotsEl = el.querySelector('.cal-dots');
                
                dateEl.innerText = d;
                
                if(isCurrentMonth && d === hoy.getDate()) div.classList.add('today');
                
                if(mapDias[d] && mapDias[d].length > 0) {
                    div.classList.add('has-data');
                    let dotsHtml = '';
                    mapDias[d].slice(0, 8).forEach(mov => {
                        let color = 'var(--text-muted)';
                        if(['Compra','Venta'].includes(mov.tipo)) color = 'var(--color-accent)';
                        else if(['Ingreso Local'].includes(mov.tipo)) color = 'var(--color-up)';
                        else if(['Gasto Local','Gasto Familiar','Pago Proveedor'].includes(mov.tipo)) color = 'var(--color-down)';
                        else if(mov.tipo === 'Reparto Sociedad') color = 'var(--color-purple)';
                        
                        dotsHtml += `<div class="cal-dot" style="color:${color}; background-color:${color};"></div>`;
                    });
                    if(mapDias[d].length > 8) dotsHtml += `<div style="font-size:10px; font-weight:900; color:var(--text-muted);">+${mapDias[d].length - 8}</div>`;
                    dotsEl.innerHTML = dotsHtml;
                    
                    div.addEventListener('click', () => {
                        document.querySelectorAll('.cal-day').forEach(cd => cd.style.borderColor = '');
                        div.style.borderColor = 'var(--color-primary)';
                        
                        let html = `<h3 class="stat__title" style="margin-bottom: 25px; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">Movimientos del ${d} de ${monthNames[this.calMes]}</h3>`;
                        html += '<div style="display:flex; flex-direction:column; gap:12px; max-height: 500px; overflow-y:auto; padding-right: 10px;">';
                        
                        mapDias[d].forEach(mov => {
                            let displayTipo = this.getDisplayTipo(mov.tipo);
                            let tagClass = this.getBadgeClass(mov.tipo);
                            
                            let color = 'var(--text-main)';
                            let sign = '';
                            if (['Ingreso Local', 'Ahorro', 'Transferencia Ahorro', 'Venta', 'Dividendo', 'Rendimiento', 'Alta Préstamo'].includes(mov.tipo)) {
                                color = 'var(--color-up)';
                                sign = '+';
                            } else if (['Gasto Local', 'Gasto Familiar', 'Pago Proveedor', 'Amortización Deuda a Proveedor', 'Reparto Sociedad', 'Compra', 'Retiro', 'Pago Préstamo'].includes(mov.tipo)) {
                                color = 'var(--color-down)';
                                sign = '-';
                            }

                            let divVal = this.currentModelData.vistaUSD ? this.currentModelData.dolarBlue : 1;
                            let isUSD = this.currentModelData.vistaUSD;
                            let monto = mov.monto;
                            if (['Transferencia Ahorro', 'Ahorro'].includes(mov.tipo) && mov.usd > 0 && isUSD) monto = mov.usd;
                            else monto = monto / divVal;
                            
                            let desc = '';
                            if(['Compra','Venta','Dividendo'].includes(mov.tipo)) desc = DOMPurify.sanitize(mov.activo);
                            else if (mov.tipo === 'Gasto Local' || mov.tipo === 'Gasto Familiar') desc = DOMPurify.sanitize(mov.categoria || '');
                            else if (mov.tipo === 'Pago Proveedor' || mov.tipo === 'Amortización Deuda a Proveedor') desc = DOMPurify.sanitize(mov.proveedor || '');
                            else if (mov.tipo === 'Reparto Sociedad') desc = `Socio: ${DOMPurify.sanitize(mov.socio || '')}`;
                            else if (mov.tipo === 'Alta Préstamo' || mov.tipo === 'Pago Préstamo') desc = `Entidad: ${DOMPurify.sanitize(mov.entidad || '')}`;

                            html += `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding: 18px 20px; background:var(--bg-input); border-radius:12px; border-left: 4px solid ${color};">
                                    <div style="display:flex; flex-direction:column; gap:6px;">
                                        <span class="badge ${tagClass}" style="width:fit-content; font-size: 0.7rem; padding: 4px 8px;">${displayTipo}</span>
                                        <span style="font-weight:900; font-size:1.05rem; color:var(--text-main);">${desc}</span>
                                    </div>
                                    <span class="data-font privacy-mask" style="color:${color}; font-weight:900; font-size:1.25rem;">${sign}${this.zenMode ? '---' : this.fmt(monto, 1, isUSD)}</span>
                                </div>
                            `;
                        });
                        html += '</div>';
                        this.DOM.calDetalle.innerHTML = html;
                    });
                }
                fragment.appendChild(el);
            }
            
            this.DOM.calDias.appendChild(fragment);
        });
    },

    cambiarMesCalendario(dir) {
        this.calMes += dir;
        if(this.calMes > 11) { this.calMes = 0; this.calAno++; }
        else if(this.calMes < 0) { this.calMes = 11; this.calAno--; }
        this.renderCalendario(this.currentModelData);
    },

    calcularInteres() {
        ErrorHandler.catchBoundary('Calculadora Interés', 'herramientas', () => {
            if(this.activeTab !== 'herramientas' || !this.DOM.calcInicial) return;
            
            let p = this.cleanNum(this.DOM.calcInicial.value);
            let pm = this.cleanNum(this.DOM.calcMensual.value);
            let r = parseFloat(this.DOM.calcTasa.value) / 100;
            let t = parseInt(this.DOM.calcAnos.value);
            let n = 12; 
            
            if (isNaN(p) || isNaN(pm) || isNaN(r) || isNaN(t) || t <= 0) return;

            let labels = [];
            let dAp = [];
            let dInt = [];
            
            let currentAportado = p;
            let currentTotal = p;
            
            for(let i=1; i<=t; i++) {
                labels.push(`Año ${i}`);
                currentAportado += pm * 12;
                currentTotal = currentTotal * Math.pow(1 + r/n, n) + pm * ((Math.pow(1 + r/n, n) - 1) / (r/n));
                
                dAp.push(currentAportado);
                dInt.push(Math.max(0, currentTotal - currentAportado));
            }

            this.DOM.calcResAportado.innerText = this.zenMode ? '---' : '$' + this.fmtStr(currentAportado, 1, false);
            this.DOM.calcResInteres.innerText = this.zenMode ? '---' : '$' + this.fmtStr(currentTotal - currentAportado, 1, false);
            this.DOM.calcResFinal.innerText = this.zenMode ? '---' : '$' + this.fmtStr(currentTotal, 1, false);

            const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
            let c1 = getCSS('--color-primary', '#6045F4');
            let c2 = getCSS('--color-up', '#00FF95');

            ChartRenderer.renderCalculadora(labels, dAp, dInt, 'chartCalc', c1, c2, this.DOM.wrapCalc);
        });
    },

    initFIRE(modelData) {
        ErrorHandler.catchBoundary('Proyección FIRE', 'fire', () => {
            if(!modelData || !modelData.stats) return;
            
            let s = modelData.stats;
            let objGastoBase = document.getElementById('fire-gasto-base');
            let objCapital = document.getElementById('fire-capital');
            let objAhorro = document.getElementById('fire-ahorro');
            
            if(objGastoBase && s.gastosFamiliar) {
                let meses = s.numMesesOperativos || 1;
                let gastoFamiliarMensual = s.gastosFamiliar / meses;
                objGastoBase.value = this.fmtStr(gastoFamiliarMensual, 1, false);
            }
            
            if(objCapital) objCapital.value = this.fmtStr(s.capInvertido + s.billetera, 1, false);
            
            if(objAhorro && s.totalAhorrado) {
                let meses = s.numMesesOperativos || 1;
                objAhorro.value = this.fmtStr(s.totalAhorrado / meses, 1, false);
            }
            
            this.calcularFIRE();
        });
    },

    calcularFIRE() {
        ErrorHandler.catchBoundary('Cálculo FIRE', 'fire', () => {
            let vBase = this.cleanNum(document.getElementById('fire-gasto-base')?.value);
            let vExtra = this.cleanNum(document.getElementById('fire-gasto-extra')?.value);
            let p = this.cleanNum(document.getElementById('fire-capital')?.value);
            let pm = this.cleanNum(document.getElementById('fire-ahorro')?.value);
            let r = parseFloat(document.getElementById('fire-cagr')?.value) / 100;
            let swr = parseFloat(document.getElementById('fire-swr')?.value) / 100;
            
            let elAnos = document.getElementById('fire-res-anos');
            let elGasto = document.getElementById('fire-res-gasto');
            let elObj = document.getElementById('fire-res-objetivo');
            let wrapFire = document.getElementById('wrap-fire-chart');

            if (isNaN(vBase) || isNaN(vExtra) || isNaN(p) || isNaN(pm) || isNaN(r) || isNaN(swr) || swr <= 0) return;

            let gastoMensualTotal = vBase + vExtra;
            let gastoAnualTotal = gastoMensualTotal * 12;
            let targetFire = gastoAnualTotal / swr;

            elGasto.innerText = this.zenMode ? '---' : '$' + this.fmtStr(gastoMensualTotal, 1, false);
            elObj.innerText = this.zenMode ? '---' : '$' + this.fmtStr(targetFire, 1, false);

            let currentVal = p;
            let meses = 0;
            let n = 12;
            let rMensual = r / n;
            
            let labels = [];
            let dataProgreso = [];
            let dataTarget = [];

            if (currentVal >= targetFire) {
                elAnos.innerText = "Objetivo Alcanzado";
                elAnos.style.color = "var(--color-up)";
                labels = ['Actual'];
                dataProgreso = [currentVal];
                dataTarget = [targetFire];
            } else if (pm <= 0 && r <= 0) {
                elAnos.innerText = "Inviable (Aporte 0)";
                elAnos.style.color = "var(--color-down)";
            } else {
                let maxMeses = 12 * 60; 
                while(currentVal < targetFire && meses < maxMeses) {
                    if(meses % 12 === 0) {
                        labels.push(`Año ${meses/12}`);
                        dataProgreso.push(currentVal);
                        dataTarget.push(targetFire);
                    }
                    currentVal = currentVal * (1 + rMensual) + pm;
                    meses++;
                }
                
                if(meses % 12 !== 0) {
                    labels.push(`Final`);
                    dataProgreso.push(currentVal);
                    dataTarget.push(targetFire);
                }

                if(meses >= maxMeses) {
                    elAnos.innerText = "+60 Años";
                    elAnos.style.color = "var(--color-down)";
                } else {
                    let anosReales = meses / 12;
                    elAnos.innerText = `${anosReales.toFixed(1)} Años`;
                    elAnos.style.color = "var(--color-up)";
                }
            }

            if (wrapFire && labels.length > 0) {
                let canvas = wrapFire.querySelector('canvas');
                if(!canvas) {
                    wrapFire.innerHTML = '<canvas id="chartFire"></canvas>';
                    canvas = wrapFire.querySelector('canvas');
                }
                const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
                
                let cAccent = getCSS('--color-accent', '#FF4D8A');
                let cUp = getCSS('--color-up', '#00FF95');
                const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

                if(window.chartFireInst) window.chartFireInst.destroy();
                
                window.chartFireInst = new Chart(canvas.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Progresión de Capital',
                                data: dataProgreso,
                                borderColor: cUp,
                                backgroundColor: isLightMode ? ChartRenderer._createGradient(canvas.getContext('2d'), cUp) : 'transparent',
                                borderWidth: 3,
                                fill: isLightMode,
                                pointRadius: 0,
                                tension: 0.4
                            },
                            {
                                label: 'Umbral FIRE',
                                data: dataTarget,
                                borderColor: cAccent,
                                backgroundColor: 'transparent',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                fill: false,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } },
                            y: { 
                                border: { display: false }, 
                                ticks: { 
                                    callback: function(value) {
                                        if(value >= 1000000) return '$' + (value/1000000).toFixed(1) + 'M';
                                        return '$' + value;
                                    },
                                    font: { family: "'Roboto Mono', monospace", weight: 'bold' } 
                                } 
                            }
                        }
                    }
                });
            }
        });
    }
};