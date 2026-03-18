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
    _mdCache: new Map(), // NUEVA LÍNEA: Caché de Markdown
    // FASE 3: Paleta de Colores Vibrantes para gráficos e inyecciones JS
    sectorColors: ['#00FF95', '#FF4D8A', '#2CE6D6', '#FCA311', '#6045F4', '#FF871A', '#7C13A4', '#1AA7EC', '#F71735'],
    CEDEAR_RATIOS: {
        'SPY': 20, 'QQQ': 20, 'DIA': 20, 'IWM': 20, 'SPXL': 10, 'AAPL': 10, 'MSFT': 30, 
        'GOOGL': 58, 'AMZN': 144, 'TSLA': 15, 'NVDA': 24, 'META': 24, 'NFLX': 48,
        'KO': 5, 'MCD': 24, 'WMT': 18, 'PG': 5, 'V': 18, 'DIS': 12, 'JNJ': 5, 'MELI': 60
    },
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

    customDialog(type, message, inputType = 'text', maxLength = 255) {
        return new Promise((resolve) => {
            let existing = document.getElementById('custom-dialog-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'custom-dialog-overlay';
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
                background: 'rgba(5, 5, 7, 0.95)', zIndex: '10000',
                display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                paddingTop: '15vh', backdropFilter: 'blur(15px)'
            });

            let inputHtml = type === 'prompt' ? `<input type="${inputType}" id="custom-dialog-input" maxlength="${maxLength}" class="data-font" style="width:100%; text-align:center; font-size:1.8rem; letter-spacing: ${inputType === 'password' ? '15px' : '2px'}; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid var(--color-primary); background: rgba(96, 69, 244, 0.05); color: var(--text-main);" autocomplete="off">` : '';

            overlay.innerHTML = `
                <div class="card" style="max-width: 450px; width: 90%; text-align: center; padding: 40px; border-radius: 24px; border: 1px solid rgba(96, 69, 244, 0.5); box-shadow: var(--shadow-neon-primary);">
                    <h3 style="margin-bottom: 25px; font-size: 1.4rem; font-weight: 900; color: var(--text-main); line-height: 1.5;">${message}</h3>
                    ${inputHtml}
                    <div style="display:flex; gap: 20px; justify-content: center;">
                        <button id="custom-dialog-cancel" class="btn btn--outline" style="flex: 1; padding: 15px; border-radius: 16px; font-size: 1.1rem;">Cancelar</button>
                        <button id="custom-dialog-confirm" class="btn" style="flex: 1; padding: 15px; border-radius: 16px; font-size: 1.1rem; ${type === 'prompt' ? '' : 'background: var(--color-down); box-shadow: var(--shadow-neon-down); color: #fff; border-color: transparent;'}">${type === 'prompt' ? 'Aceptar' : 'Confirmar Acción'}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const btnConfirm = document.getElementById('custom-dialog-confirm');
            const btnCancel = document.getElementById('custom-dialog-cancel');
            const inputEl = document.getElementById('custom-dialog-input');

            if (inputEl) inputEl.focus();

            const closeAndResolve = (val) => {
                overlay.remove();
                resolve(val);
            };

            btnConfirm.addEventListener('click', () => {
                if (type === 'prompt') closeAndResolve(inputEl.value.trim());
                else closeAndResolve(true);
            });

            btnCancel.addEventListener('click', () => closeAndResolve(type === 'prompt' ? null : false));

            if (inputEl) {
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') btnConfirm.click();
                    if (e.key === 'Escape') btnCancel.click();
                });
            }
        });
    },
    customConfirm(message) {
        return this.customDialog('confirm', message);
    },
    customPrompt(message, inputType = 'text', maxLength = 255) {
        return this.customDialog('prompt', message, inputType, maxLength);
    },

    // FASE 3: Insignias Vibrantes (Mapeo estricto con FASE 1 CSS)
    getBadgeClass(tipo) {
        switch (tipo) {
            case 'Rescate a Caja': return 'bg-retiro'; 
            case 'Aporte Capital': return 'bg-ahorro-transf';
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

    getCategoryColor(catName) {
        if (!catName) return 'var(--color-primary)';
        const palette = [
            '#00FF95', '#FF4D8A', '#2CE6D6', '#FCA311', '#6045F4', 
            '#FF871A', '#7C13A4', '#1AA7EC', '#F71735', '#00F5FF', 
            '#FFD500', '#B800FF', '#FF007B', '#E0245E', '#17BF63'
        ];
        let hash = 0;
        for (let i = 0; i < catName.length; i++) {
            hash = catName.charCodeAt(i) + ((hash << 5) - hash);
        }
        hash = Math.abs(hash);
        return palette[hash % palette.length];
    },
    
    initUI() {
        // CORRECCIÓN ESTRUCTURAL: Limpieza del Hack del DOM. Delegación al contenedor global.
        const styleFix = document.createElement('style');
        styleFix.innerHTML = `
            #vs-tbody tr { content-visibility: visible !important; contain-intrinsic-size: auto !important; will-change: auto !important; }
            .card { overflow: visible !important; }
            .dataTable-table > tbody > tr { position: relative; z-index: 1; }
            .dataTable-table > tbody > tr:hover { z-index: 9999 !important; }
        `;
        document.head.appendChild(styleFix);

        // NUCLEO: Renderizador Flotante Global
        const tooltipContainer = document.createElement('div');
        tooltipContainer.id = 'global-tooltip-container';
        Object.assign(tooltipContainer.style, {
            position: 'absolute', pointerEvents: 'none', zIndex: '999999',
            background: 'var(--bg-panel)', color: 'var(--text-main)', padding: '10px 14px',
            borderRadius: '8px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-color)',
            fontSize: '0.85rem', maxWidth: '320px', whiteSpace: 'pre-wrap', wordWrap: 'break-word',
            display: 'none', transition: 'opacity 0.15s ease-in-out', opacity: '0', backdropFilter: 'blur(10px)'
        });
        document.body.appendChild(tooltipContainer);

        // --- SOLUCIÓN ARQUITECTÓNICA: ESCUDO MUTACIONAL (PREVENCIÓN DE TOOLTIPS NATIVOS) ---
        // Extrae y destruye los atributos 'title' milisegundos antes de que el navegador los procese.
        const stripNativeTitles = (nodeList) => {
            nodeList.forEach(node => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    if (node.hasAttribute('title')) {
                        node.setAttribute('data-original-title', node.getAttribute('title'));
                        node.removeAttribute('title');
                    }
                    // Búsqueda profunda en sub-nodos inyectados vía innerHTML
                    const children = node.querySelectorAll('[title]');
                    for (let i = 0; i < children.length; i++) {
                        children[i].setAttribute('data-original-title', children[i].getAttribute('title'));
                        children[i].removeAttribute('title');
                    }
                }
            });
        };

        // Escaneo de purga inicial
        stripNativeTitles([document.body]);

        // Interceptor en tiempo real para inyecciones del Virtual Scroll y Reactividad
        const domObserver = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    stripNativeTitles(mutation.addedNodes);
                }
            }
        });
        domObserver.observe(document.body, { childList: true, subtree: true });

        // --- MANEJADORES DE EVENTOS BLINDADOS ---
        document.body.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip], [data-original-title]');
            if (target) {
                const titleText = target.getAttribute('data-tooltip') || target.getAttribute('data-original-title');
                if (!titleText) return;
                
                tooltipContainer.innerHTML = titleText;
                tooltipContainer.style.display = 'block';
                
                const rect = target.getBoundingClientRect();
                tooltipContainer.style.left = Math.min(rect.left + window.scrollX, document.body.clientWidth - 330) + 'px';
                tooltipContainer.style.top = (rect.bottom + window.scrollY + 8) + 'px';
                
                requestAnimationFrame(() => tooltipContainer.style.opacity = '1');
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip], [data-original-title]');
            if (target) {
                // CORRECCIÓN DE BUBBLING: Evita que el Tooltip parpadee (flicker) o se duplique 
                // visualmente cuando el mouse transita entre elementos hijos dentro del mismo contenedor.
                if (e.relatedTarget && target.contains(e.relatedTarget)) return;

                tooltipContainer.style.opacity = '0';
                setTimeout(() => { 
                    if (tooltipContainer.style.opacity === '0') tooltipContainer.style.display = 'none'; 
                }, 150);
            }
        });

        this.cacheDOM();
        this.bindUIEvents();
        this.bindBusinessEvents();
        this.setupSystemListeners();
        this.initFiltrosTemporales(); 
        this.initExportacionPDF(); 
        
        // CORRECCIÓN MATEMÁTICA: Obtención de Fecha Local exacta evadiendo el offset UTC
        const getLocalISODate = () => {
            const tzOffset = (new Date()).getTimezoneOffset() * 60000;
            return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        };

        if (this.DOM.opFecha) this.DOM.opFecha.value = getLocalISODate();
        if (this.DOM.ecoFecha) this.DOM.ecoFecha.value = getLocalISODate();
        if (this.DOM.dashRatioEI) this.DOM.dashRatioEI.style.display = 'none';

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
            opTipoDesc: document.getElementById('op-tipo-desc'),
            ecoTipoDesc: document.getElementById('eco-tipo-desc'),
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
            resSimMeses: document.getElementById('res-sim-meses'),
            valPatInyecciones: document.getElementById('val-pat-inyecciones')
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

        // CORRECCIÓN: Event Router Unificado. Un solo Listener maestro para toda la aplicación.
        document.body.addEventListener('click', async (e) => {
            const target = e.target;
            
            // --- BLOQUE 1: Navegación y UI Base ---
            const btnNav = target.closest('.nav__item');
            if (btnNav) {
                events.emit('ui:cambiar-pestana', btnNav.getAttribute('aria-controls'));
                return; 
            }

            const btnFilter = target.closest('.btn--filter');
            if (btnFilter && !target.closest('.gastos-filter-group') && !target.closest('.sankey-filter-group')) {
                events.emit('ui:set-filtro', btnFilter.dataset.filter);
            }
            
            if (target.closest('#btn-toggle-moneda')) events.emit('ui:toggle-moneda');
            if (target.closest('#btn-sidebar-toggle')) document.getElementById('sidebar')?.classList.toggle('sidebar--collapsed');
            if (target.closest('#btn-privacy')) this.togglePrivacy();
            if (target.closest('#btn-save-manual')) events.emit('ui:guardar-manual');
            if (target.closest('#btn-zen')) events.emit('ui:toggle-zen');
            
            if (target.closest('#btn-theme')) {
                const htmlEl = document.documentElement;
                const newTheme = htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                htmlEl.setAttribute('data-theme', newTheme);
                
                const iconToggle = document.getElementById('icon-theme-toggle');
                if (iconToggle) {
                    iconToggle.innerHTML = newTheme === 'dark' ? `<use href="#icon-sun"></use>` : `<use href="#icon-moon"></use>`;
                }
                this.toast(`Tema ${newTheme === 'dark' ? 'Oscuro' : 'Claro'} Activado`, "info");
            }

            // --- BLOQUE 2: Reglas de Negocio (Business Actions fusionadas) ---
            const actionBtn = target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                
                if (action === 'guardar-operacion') events.emit('ui:guardar-operacion', this.getOperacionFormData());
                if (action === 'editar-operacion') events.emit('ui:editar-operacion', actionBtn.dataset.id);
                if (action === 'cancelar-edicion') events.emit('ui:cancelar-edicion');
                
                if (action === 'borrar-operacion') {
                    if (await this.customConfirm("¿Borrar este registro permanentemente?")) {
                        events.emit('ui:borrar-operacion', actionBtn.dataset.id);
                    }
                }
                
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
                
                if (action === 'borrar-inflacion') {
                    if (await this.customConfirm(`¿Borrar dato de inflación del período ${actionBtn.dataset.mes}?`)) {
                        events.emit('ui:borrar-inflacion', actionBtn.dataset.mes);
                    }
                }
                
                if (action === 'verificar-pin') events.emit('ui:verificar-pin', document.getElementById('input-pin-login').value);
                if (action === 'guardar-pin') events.emit('ui:guardar-pin', document.getElementById('nuevo-pin').value);
                
                if (action === 'eliminar-pin') {
                    let p = await this.customPrompt("Ingresa tu PIN actual para desactivar la Bóveda:", "password", 4);
                    if(p !== null && p.trim() !== '') events.emit('ui:eliminar-pin', p);
                }
                
                if (action === 'exportar') events.emit('ui:exportar');
                
                if (action === 'borrar-todo') {
                    let p = await this.customPrompt("Escribe BORRAR para formatear el sistema completo (Irreversible):", "text", 10);
                    if (p && p.trim().toUpperCase() === 'BORRAR') events.emit('ui:borrar-todo');
                }
                
                if (action === 'cambiar-mes') this.cambiarMesCalendario(parseInt(actionBtn.dataset.dir));
            }
        });

        const debouncedCalc = debounce(() => this.calcularInteres(), 300);
        document.querySelectorAll('.calc-input').forEach(input => input.addEventListener('input', debouncedCalc));

        const debouncedFire = debounce(() => this.calcularFIRE(), 300);
        document.querySelectorAll('.fire-input').forEach(input => input.addEventListener('input', debouncedFire));

        let isVirtualScrolling = false;
        if(this.DOM.vsViewport) {
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
        }
        
        if(this.DOM.vsTbody) {
            this.DOM.vsTbody.addEventListener('mouseover', (e) => {
                let tr = e.target.closest('tr');
                if(tr) tr.style.zIndex = '10';
            });
            this.DOM.vsTbody.addEventListener('mouseout', (e) => {
                let tr = e.target.closest('tr');
                if(tr) tr.style.zIndex = '1';
            });
        }
    },

    bindBusinessEvents() {
        // CORRECCIÓN: Función vaciada por seguridad para no romper referencias de llamadas previas.
        // Toda su lógica fue encapsulada dentro del Event Router Unificado en bindUIEvents().
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
        const isBursatil = document.getElementById('btn-toggle-bursatil')?.classList.contains('active') === true;
        let formData = {};
        
        if (isBursatil) {
            formData = {
                tipo: DOMPurify.sanitize(this.DOM.opTipo.value),
                fecha: DOMPurify.sanitize(this.DOM.opFecha.value),
                activo: DOMPurify.sanitize(this.DOM.opActivo.value.trim().toUpperCase()),
                sector: DOMPurify.sanitize(this.DOM.opSector.value.trim()),
                cant: this.parseNumber(this.DOM.opCantidad.value) || 0,
                monto: this.parseNumber(this.DOM.opMonto.value),
                usd: this.parseNumber(this.DOM.opUsd.value) || 0
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
            if (t === 'Ajuste Stock Inicial' || t === 'Correccion Stock') {
                let valVenta = this.parseNumber(this.DOM.ecoValorVenta?.value);
                if (valVenta > 0) formData.valorVentaEstimado = valVenta;
            }
            if (t === 'Alta Préstamo') {
                formData.entidad = DOMPurify.sanitize(this.DOM.ecoPrestamoEntidad.value.trim());
                formData.montoTotalDevolver = this.parseNumber(this.DOM.ecoPrestamoTotal.value);
                
                const capInput = document.getElementById('eco-prestamo-capital');
                formData.capital = capInput && capInput.value ? this.parseNumber(capInput.value) : 0;
                
                const cuotasInput = document.getElementById('eco-prestamo-cuotas');
                formData.cuotas = cuotasInput && cuotasInput.value ? parseInt(cuotasInput.value, 10) : 1;
            }
            if (t === 'Pago Préstamo') {
                // CORRECCIÓN: Respetar la integridad del UUID criptográfico. Eliminado parseInt().
                formData.prestamoAsociado = DOMPurify.sanitize(this.DOM.ecoPrestamoId.value);
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
            this.DOM.btnGuardarOp.innerHTML = `<span style="display:inline-flex; gap:8px; align-items:center;"><svg width="18" height="18"><use href="#icon-edit"></use></svg> Sobrescribir Registro</span>`;
            this.DOM.btnGuardarOp.classList.add('btn--warning');
        }
        if (this.DOM.btnCancelarEdicion) this.DOM.btnCancelarEdicion.classList.remove('is-hidden');
        
        const tiposBursatiles = ['Transferencia Ahorro', 'Ahorro', 'Rescate a Caja', 'Compra', 'Venta', 'Rendimiento', 'Dividendo', 'Retiro'];
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
            
            this.adaptarFormularioEconomia(); 
            
            if (mov.categoria && this.DOM.ecoCategoria) this.DOM.ecoCategoria.value = mov.categoria;
            if (mov.proveedor && this.DOM.ecoProveedor) this.DOM.ecoProveedor.value = mov.proveedor;
            if (mov.socio && this.DOM.ecoProveedor) this.DOM.ecoProveedor.value = mov.socio;
            if (mov.entidad && this.DOM.ecoPrestamoEntidad) this.DOM.ecoPrestamoEntidad.value = mov.entidad;
            if (mov.montoTotalDevolver && this.DOM.ecoPrestamoTotal) this.DOM.ecoPrestamoTotal.value = this.fmtStr(mov.montoTotalDevolver, 1, false);
            
            if (mov.cuotas) {
                const cuotasInp = document.getElementById('eco-prestamo-cuotas');
                if (cuotasInp) cuotasInp.value = mov.cuotas;
            }
            if (mov.prestamoAsociado && this.DOM.ecoPrestamoId) this.DOM.ecoPrestamoId.value = mov.prestamoAsociado;
            
            if (mov.valorVentaEstimado && this.DOM.ecoValorVenta) {
                this.DOM.ecoValorVenta.value = this.fmtStr(mov.valorVentaEstimado, 1, false);
            }
            
            if (mov.estadoPago && this.DOM.ecoEstadoPago) this.DOM.ecoEstadoPago.value = mov.estadoPago;
            if (mov.deudaAsociadaId && this.DOM.ecoDeudaProveedorId) this.DOM.ecoDeudaProveedorId.value = mov.deudaAsociadaId;

            if (mov.tipo === 'Alta Préstamo' && mov.capital) {
                const capInput = document.getElementById('eco-prestamo-capital');
                if (capInput) capInput.value = this.fmtStr(mov.capital, 1, false);
            } else {
                if (this.DOM.ecoMonto) this.DOM.ecoMonto.value = this.fmtStr(mov.monto, 1, false);
            }
            
            if (this.DOM.ecoNotas) this.DOM.ecoNotas.value = mov.notas || '';
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
            document.querySelectorAll('.btn--filter:not(.gastos-filter-btn):not(.sankey-filter-btn)').forEach(b => b.classList.remove('active'));
            document.querySelector(`.btn--filter:not(.gastos-filter-btn):not(.sankey-filter-btn)[data-filter="${filtro}"]`)?.classList.add('active');
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
        const isActive = document.body.classList.contains('privacy-active');
        const iconSvg = document.getElementById('icon-privacy-toggle');
        
        if(iconSvg) {
            iconSvg.innerHTML = isActive ? `<use href="#icon-privacy-off"></use>` : `<use href="#icon-privacy"></use>`;
        }
        
        this.toast(isActive ? "Bóveda Visual Activada" : "Visibilidad de Fondos Expuesta", "info");
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
        const descripcionesBursatil = {
        'Transferencia Ahorro': 'Inyección de liquidez. Mueve fondos de la Caja Local hacia la Billetera Bursátil. Aumenta Liquidez Retenida.',
        'Ahorro': 'Ingreso externo y directo. Inyecta capital limpio en la Billetera Bursátil omitiendo el flujo del negocio.',
        'Rescate a Caja': 'Rescate de capital. Mueve dinero de la Billetera Bursátil hacia la Caja Local. Reduce Liquidez Retenida.',
        'Compra': 'Adquisición de instrumentos financieros. Requiere asignación de Ticker, Sector y Volumen nominal.',
        'Venta': 'Liquidación total o parcial de posiciones en cartera. Requiere asignación de Ticker, Sector y Volumen a liquidar.',
        'Rendimiento': 'Asiento de rentabilidad líquida o intereses generados por cauciones y fondos money-market.',
        'Dividendo': 'Distribución de utilidades. Inyección de liquidez pasiva. Requiere asociar el Ticker y Sector emisor.',
        'Retiro': 'Extracción definitiva de capital bursátil hacia fuera del ecosistema financiero auditado.'
    };
        
        if(this.DOM.opTipoDesc) this.DOM.opTipoDesc.innerText = descripcionesBursatil[t] || '';
        if(this.DOM.hintCantidad) this.DOM.hintCantidad.classList.add('is-hidden');
        
        if (['Compra','Venta','Dividendo'].includes(t)) {
            this.DOM.bloqueActivo.classList.remove('is-hidden');
            this.DOM.grupoSector.classList.remove('is-hidden');
        } else {
            this.DOM.bloqueActivo.classList.add('is-hidden');
            this.DOM.grupoSector.classList.add('is-hidden');
        }
        
        if (t === 'Transferencia Ahorro' || t === 'Ahorro' || t === 'Rescate a Caja') {
            this.DOM.bloqueDolares.classList.remove('is-hidden');
        } else {
            this.DOM.bloqueDolares.classList.add('is-hidden');
        }

        this.DOM.lblMonto.innerText = t === 'Dividendo' ? 'Distribución Total Cobrada (ARS)' : 'Monto Consolidado de la Operación (ARS)';
    },

    adaptarFormularioEconomia() {
        let t = this.DOM.ecoTipo.value;
        const descripcionesEco = {
            'Ingreso Local': 'Suma dinero a la Caja Local. Registra como venta/ingreso comercial y descuenta mercadería.',
            'Gasto Local': 'Resta dinero de la Caja Local. Gasto vinculado a mantener el negocio operativo.',
            'Gasto Familiar': 'Resta dinero de la Caja Local para uso personal. Clasificado como Fuga de Capital.',
            'Pago Proveedor': 'Resta dinero de la Caja Local y AUMENTA el Costo del Inventario (Stock).',
            'Amortización Deuda a Proveedor': 'Resta dinero de la Caja Local para pagar deuda pendiente. No toca inventario.',
            'Aporte Capital': 'Suma dinero a la Caja Local sin considerarlo venta (préstamo, ahorro, etc).',
            'Ajuste Stock Inicial': 'Suma valor al Inventario Base sin tocar la Caja. Ideal para sumar remanentes.',
            'Correccion Stock': 'Fija el valor EXACTO del Inventario Actual sobrescribiendo arrastres previos. Útil para auditorías.',
            'Reparto Sociedad': 'Resta dinero de la Caja Local como retiro de los accionistas.',
            'Ahorro': 'Ingreso externo y directo. Inyecta capital limpio en la Billetera Bursátil omitiendo el flujo del negocio.',
            'Alta Préstamo': 'Suma dinero a la Caja Local e inicia el seguimiento de un Pasivo Activo.',
            'Pago Préstamo': 'Resta dinero de la Caja Local para amortizar Pasivos Activos.',
        };
        if(this.DOM.ecoTipoDesc) this.DOM.ecoTipoDesc.innerText = descripcionesEco[t] || '';
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
            
            let htmlToInsert = `
                <div id="eco-categoria-wrapper" style="width: 100%;">
                    <div style="display:flex; gap:10px; width:100%;">
                        <input type="text" id="eco-categoria" list="lista-categorias-eco" placeholder="Selecciona o escribe..." style="flex:1;">
                        <button type="button" class="btn--danger" id="btn-eliminar-categoria" title="Eliminar categoría seleccionada" style="padding: 0 15px; border-radius: 12px; font-weight:900;">X</button>
                    </div>
                    ${datalistHtml}
                </div>
            `;
            
            let existingWrapper = document.getElementById('eco-categoria-wrapper');
            if (existingWrapper) {
                existingWrapper.outerHTML = htmlToInsert;
            } else {
                this.DOM.ecoCategoria.outerHTML = htmlToInsert;
            }
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
            
            let provs = (this.currentModelData?.proveedores || []).filter(p => p.categoria !== 'Socio' && p.categoria !== 'Entidad Bancaria');
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
            
            let socios = (this.currentModelData?.proveedores || []).filter(p => p.categoria === 'Socio');
            let datalistHtml = '<datalist id="lista-socios">';
            socios.forEach(s => { datalistHtml += `<option value="${s.nombre}">`; });
            datalistHtml += '</datalist>';
            
            this.DOM.ecoProveedor.outerHTML = `<input type="text" id="eco-proveedor" list="lista-socios" placeholder="Ej: Nombre del Socio">` + datalistHtml;
            this.DOM.ecoProveedor = document.getElementById('eco-proveedor');
        }
        else if (t === 'Ajuste Stock Inicial' || t === 'Correccion Stock') {
            if (this.DOM.rowEcoValorVenta) {
                this.DOM.bloqueCategoriasEco.classList.remove('is-hidden');
                this.DOM.rowEcoValorVenta.classList.remove('is-hidden');
                let hint = document.getElementById('hint-valor-venta');
                if (hint) {
                    hint.innerText = t === 'Correccion Stock' 
                        ? "Ingresa el valor de venta al público de todo el inventario auditado." 
                        : "Ingresa cuánto dinero obtendrías si vendieras este stock agregado al público.";
                }
            }
        }
        else if (t === 'Alta Préstamo') {
            this.DOM.bloquePrestamosAlta.classList.remove('is-hidden');
            
            let entidades = (this.currentModelData?.proveedores || []).filter(p => p.categoria === 'Entidad Bancaria');
            let datalistHtml = '<datalist id="lista-entidades">';
            entidades.forEach(e => { datalistHtml += `<option value="${e.nombre}">`; });
            datalistHtml += '</datalist>';
            
            let currentEnt = document.getElementById('eco-prestamo-entidad');
            if (currentEnt) {
                currentEnt.outerHTML = `<input type="text" id="eco-prestamo-entidad" list="lista-entidades" placeholder="Ej: Banco Galicia">` + datalistHtml;
                this.DOM.ecoPrestamoEntidad = document.getElementById('eco-prestamo-entidad');
            }
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
            if (this.DOM.ecoPrestamoId) this.DOM.ecoPrestamoId.innerHTML = optionsHtml;
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
            const s = modelData?.stats;
            if (!s || typeof s !== 'object' || Object.keys(s).length === 0) return;

            const safeSetHTML = (el, html) => { if (el) el.innerHTML = html; };
            const safeSetText = (el, text) => { if (el) el.innerText = text; };

            const healthScore = Number(s.healthScore) || 0;
            const ganRealizada = Number(s.ganRealizada) || 0;
            const billetera = Number(s.billetera) || 0;
            const capInvertido = Number(s.capInvertido) || 0;
            const stockCosto = Number(s.stockCosto) || 0;
            const cajaLocal = Number(s.cajaLocal) || 0;
            const rendExtra = Number(s.rendExtra) || 0;
            const cagr = Number(s.cagr) || 0;
            const ahorroArsPuro = Number(s.ahorroArsPuro) || 0;
            const fondoSupervivenciaMeses = Number(s.fondoSupervivenciaMeses) || 0;
            const tasaAhorroReal = Number(s.tasaAhorroReal) || 0;
            const precioPromedioDolar = Number(s.precioPromedioDolar) || 0;
            const vTotal = Number(s.vTotal) || 0;
            const vGanadas = Number(s.vGanadas) || 0;
            
            const ingresosCapital = s.ingresosCapital !== undefined ? Number(s.ingresosCapital) : Number(s.entradasCajaNoOperativas || 0);

            if (this.DOM.dashHealthScore && this.DOM.dashHealthLabel) {
                this.DOM.dashHealthScore.innerText = healthScore;
                
                let scLabel = "Peligro Crítico";
                let scColor = "var(--color-down)";
                if (healthScore >= 700) { scLabel = "Sólido"; scColor = "var(--color-up)"; }
                else if (healthScore >= 400) { scLabel = "Estable"; scColor = "var(--color-warning)"; }
                
                this.DOM.dashHealthScore.style.color = scColor;
                this.DOM.dashHealthLabel.innerText = scLabel;
                this.DOM.dashHealthLabel.style.color = scColor;
                
                let rgbaColor = scColor.includes('up') ? 'rgba(0, 255, 149, 0.2)' : (scColor.includes('warning') ? 'rgba(252, 163, 17, 0.2)' : 'rgba(247, 23, 53, 0.2)');
                let cardParent = this.DOM.dashHealthScore.closest('.card');
                if (cardParent) {
                    cardParent.style.borderColor = scColor;
                    cardParent.style.boxShadow = `0 0 20px ${rgbaColor}`;
                }
            }

            safeSetText(this.DOM.lblDolar, modelData.dolarBlue);
            
            if (typeof UIMetrics !== 'undefined' && UIMetrics.actualizarFavicon) {
                UIMetrics.actualizarFavicon(ganRealizada);
            }

            let totalComercial = billetera + capInvertido + stockCosto + cajaLocal;
            let liquidezTotal = billetera + cajaLocal;

            if (this.DOM.dashLiquidezSub) {
                let txtBilletera = this.fmtStr(billetera, modelData.dolarBlue, modelData.vistaUSD);
                let txtCaja = this.fmtStr(cajaLocal, modelData.dolarBlue, modelData.vistaUSD);
                this.DOM.dashLiquidezSub.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Bursátil: <strong class="texto-primario privacy-mask">${modelData.vistaUSD?'USD':'$'} ${txtBilletera}</strong> &nbsp;|&nbsp; Local: <strong class="texto-verde privacy-mask">${modelData.vistaUSD?'USD':'$'} ${txtCaja}</strong></div>`;
                this.DOM.dashLiquidezSub.style.display = 'block';
            }

            if (this.zenMode) {
                safeSetText(this.DOM.dashTotal, "100.0%");
                safeSetText(this.DOM.dashLiquidez, totalComercial > 0 ? ((liquidezTotal / totalComercial) * 100).toFixed(1) + "%" : "0%");
                safeSetText(this.DOM.dashInvertido, totalComercial > 0 ? ((capInvertido / totalComercial) * 100).toFixed(1) + "%" : "0%");
            } else {
                if (this.DOM.dashTotal) UIMetrics.animateValue(this.DOM.dashTotal, totalComercial, (val) => this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
                if (this.DOM.dashLiquidez) UIMetrics.animateValue(this.DOM.dashLiquidez, liquidezTotal, (val) => this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
                if (this.DOM.dashInvertido) UIMetrics.animateValue(this.DOM.dashInvertido, capInvertido, (val) => this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
            }

            try {
                let histLength = 30;
                const safeArray = (arr) => Array.isArray(arr) ? arr : [];
                
                let arrPatrimonio = safeArray(s.historyPatrimonioConStock || s.historyPatrimonio).slice(-histLength);
                let arrLiquidez = safeArray(s.historyLiquidez).slice(-histLength);
                let arrInvertido = safeArray(s.historyInvertido).slice(-histLength);
                
                if (typeof ChartRenderer !== 'undefined' && ChartRenderer.drawDashboardSparkline) {
                    if (document.getElementById('spark-dash-total')) ChartRenderer.drawDashboardSparkline('spark-dash-total', arrPatrimonio, '#6045F4'); 
                    if (document.getElementById('spark-dash-liquidez')) ChartRenderer.drawDashboardSparkline('spark-dash-liquidez', arrLiquidez, '#00FF95'); 
                    if (document.getElementById('spark-dash-invertido')) ChartRenderer.drawDashboardSparkline('spark-dash-invertido', arrInvertido, '#FF4D8A'); 
                }
            } catch (e) {
                console.warn("[Motor Gráfico] Ignorando renderizado de Sparklines.", e);
            }

            safeSetHTML(this.DOM.valPatInyecciones, this.zenMode ? `<strong>-</strong>` : `<strong>${modelData.vistaUSD?'USD':'$'} <span class="privacy-mask">${this.fmtStr(ingresosCapital, modelData.dolarBlue, modelData.vistaUSD)}</span></strong>`);

            let cagrStr = `<span class="${cagr >= 0 ? 'texto-verde' : 'texto-rojo'} privacy-mask" style="font-weight:900;">${cagr.toFixed(2)}%</span>`;
            let tagHtml = modelData.vistaUSD ? 'USD' : '$';
            let supStr = `<strong style="color: var(--color-primary); text-shadow: var(--shadow-neon-primary);">${fondoSupervivenciaMeses.toFixed(1)} Meses</strong>`;
            let tasaAhStr = `<span class="texto-verde privacy-mask">${tasaAhorroReal.toFixed(1)}%</span>`;
            
            safeSetText(this.DOM.lblPatSub1, "TIR Proyectada (XIRR)");
            safeSetHTML(this.DOM.valPatSub1, cagrStr);
            
            safeSetText(this.DOM.lblPatSub2, "Ahorro de Bolsillo Total");
            safeSetHTML(this.DOM.valPatSub2, this.zenMode ? `<strong>-</strong>` : `<strong>${tagHtml} <span class="privacy-mask">${this.fmtStr(ahorroArsPuro, modelData.dolarBlue, modelData.vistaUSD)}</span></strong>`);
            
            safeSetText(this.DOM.lblLiqSub1, "Fondo de Reserva Operativo");
            safeSetHTML(this.DOM.valLiqSub1, supStr);
            
            safeSetText(this.DOM.lblLiqSub2, "Tasa de Retención Real");
            safeSetHTML(this.DOM.valLiqSub2, tasaAhStr);
            
            safeSetText(this.DOM.lblInvSub1, "Dólar Promedio Histórico");
            safeSetHTML(this.DOM.valInvSub1, `<strong>$ <span class="privacy-mask">${this.fmtStr(precioPromedioDolar, 1, false)}</span></strong>`);
            
            safeSetText(this.DOM.lblInvSub2, "Trades Realizados");
            safeSetHTML(this.DOM.valInvSub2, `<strong style="color: var(--color-accent); text-shadow: var(--shadow-neon-accent);">${vTotal}</strong>`);

            let ganColor = ganRealizada >= 0 ? 'texto-verde' : 'texto-rojo';
            let ganSign = ganRealizada > 0 ? '+' : (ganRealizada < 0 ? '-' : '');
            let tagHtm = modelData.vistaUSD ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
            
            let displayGanancia = this.zenMode ? 
                `${ganSign}${(capInvertido > 0 ? (Math.abs(ganRealizada) / capInvertido * 100).toFixed(1) : 0)}%` : 
                this.fmtStr(Math.abs(ganRealizada), modelData.dolarBlue, modelData.vistaUSD);
                
            let displayPasivos = this.zenMode ? 
                `${(capInvertido > 0 ? (rendExtra / capInvertido * 100).toFixed(1) : 0)}%` : 
                this.fmtStr(rendExtra, modelData.dolarBlue, modelData.vistaUSD);
            
            safeSetHTML(this.DOM.dashGanancia, `
                <div style="display:flex; align-items:center; gap:10px; width:100%; overflow:hidden;">
                    <span class="${ganColor}" style="font-size:1.6rem; font-weight:900;">${ganSign}</span>
                    ${this.zenMode ? '' : tagHtm}
                    <span class="${ganColor} data-font privacy-mask" style="font-size:1.8rem; font-weight:900; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${displayGanancia}</span>
                </div>
            `);
            
            safeSetHTML(this.DOM.dashPasivos, `
                <div style="display:flex; align-items:center; gap:10px; width:100%; overflow:hidden;">
                    <span class="texto-primario" style="font-size:1.6rem; font-weight:900;">+</span>
                    ${this.zenMode ? '' : tagHtm}
                    <span class="texto-primario data-font privacy-mask" style="font-size:1.8rem; font-weight:900; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${displayPasivos}</span>
                </div>
            `);

            let wr = vTotal > 0 ? (vGanadas/vTotal*100).toFixed(1) : 0;
            safeSetHTML(this.DOM.dashWinrate, `
                <div style="display:flex; align-items:baseline; gap:10px; width:100%; overflow:hidden;">
                    <span class="data-font" style="font-size:1.8rem; font-weight:900; color: var(--color-warning); text-shadow: var(--shadow-neon-warning);">${wr}%</span>
                    <span style="font-size:1rem; color:var(--text-muted); font-weight:700; white-space:nowrap;">(${vGanadas}/${vTotal})</span>
                </div>
            `);

            let topAct = '-', maxR = -Infinity;
            if (s.rendimientoPorActivo && typeof s.rendimientoPorActivo === 'object') {
                for(let k in s.rendimientoPorActivo) {
                    if(s.rendimientoPorActivo[k] > maxR) { maxR = s.rendimientoPorActivo[k]; topAct = k; }
                }
            }
            
            safeSetHTML(this.DOM.dashTop, `
                <div style="display:flex; align-items:center; width:100%; overflow:hidden;">
                    <span class="data-font" style="font-size:1.8rem; font-weight:900; color:var(--color-purple); text-shadow: var(--shadow-neon-purple); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${DOMPurify.sanitize(topAct !== '-' ? topAct : '-')}</span>
                </div>
            `);
            
            if (this.DOM.tbodyProveedores) {
                let statsProvs = s.proveedoresDetalle || {};
                let provArray = [];
                
                for (let pNombre in statsProvs) {
                    provArray.push({ nombre: pNombre, total: statsProvs[pNombre].total });
                }
                
                provArray.sort((a,b) => b.total - a.total);
                let maxProvTotal = provArray.length > 0 ? Math.max(...provArray.map(p => p.total)) : 0;
                
                let provHtml = [];
                if (provArray.length === 0) {
                    provHtml.push('<tr><td colspan="2" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin registros u obligaciones logísticas recientes</td></tr>');
                } else {
                    provArray.forEach((p, index) => {
                        let pct = maxProvTotal > 0 ? (p.total / maxProvTotal) * 100 : 0;
                        let pColor = this.getCategoryColor(p.nombre); 
                        let rank = index + 1;
                        let rankTpl = index < 3 
                            ? `<span style="display:inline-flex; justify-content:center; align-items:center; width:26px; height:26px; border-radius:8px; background:${pColor}22; color:${pColor}; border: 1px solid ${pColor}50; font-size:0.85rem; margin-right:12px; font-weight:900;">${rank}</span>` 
                            : `<span style="display:inline-flex; justify-content:center; align-items:center; width:26px; font-size:0.85rem; color:var(--text-muted); margin-right:12px; font-weight:700;">${rank}</span>`;
                        
                        provHtml.push(
                            `<tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-input); transition: transform 0.2s; cursor: default;">
                                <td style="padding: 18px 25px; display:flex; align-items:center;">
                                    ${rankTpl}
                                    <div style="flex:1;">
                                        <strong style="font-size: 1.15rem; font-weight: 900; color: var(--text-main); letter-spacing: 0.5px;">${DOMPurify.sanitize(p.nombre)}</strong>
                                        <div style="margin-top: 10px; height: 6px; width: 100%; background: var(--bg-base); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
                                            <div style="height: 100%; width: ${pct}%; background: ${pColor}; box-shadow: 0 0 10px ${pColor}; border-radius: 4px; transition: width 0.5s ease-in-out;"></div>
                                        </div>
                                    </div>
                                </td>
                                <td class="data-font" style="text-align:right; padding: 18px 25px; vertical-align: bottom;">
                                    <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; margin-bottom: 4px;">Volumen Histórico</div>
                                    <strong class="privacy-mask" style="font-size: 1.35rem; font-weight: 900; color: ${pColor}; text-shadow: 0 0 15px ${pColor}40;">${this.zenMode ? '---' : '$' + this.fmtStr(p.total, 1, false)}</strong>
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
                    prestamosHtml.push('<tr><td colspan="7" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No se registran pasivos ni deudas financieras activas</td></tr>');
                } else {
                    pArray.forEach(p => {
                        let pct = Math.min(100, (p.pagado / p.totalDevolver) * 100);
                        let statusColor = p.activo ? 'var(--color-primary)' : 'var(--color-up)';
                        let statusLabel = p.activo ? 'Deuda Activa' : 'Saldado ✔️';
                        let cuotaActual = Math.min((p.cuotasPagadas || 0) + 1, p.cuotasTotales || 1);
                        let cuotaStr = p.activo ? `Cuota ${cuotaActual} de ${p.cuotasTotales || 1}` : `Liquidado en ${p.cuotasTotales || 1} pagos`;
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
                let dArray = Object.values(deudas);
                let totalDeudaProveedores = 0;
                let totalPagadoProveedores = 0;

                dArray.forEach(d => {
                    if (d.activo) {
                        totalDeudaProveedores += (d.capitalExigibleTotal - d.capitalServido);
                    }
                    totalPagadoProveedores += (d.capitalServido || 0);
                });

                // Algoritmo de Ordenamiento: Activos primero (descendentes), Saldados después (descendentes)
                dArray.sort((a,b) => {
                    if (a.activo && !b.activo) return -1;
                    if (!a.activo && b.activo) return 1;
                    return b.fecha.localeCompare(a.fecha);
                });

                let headerElement = this.DOM.tbodyDeudasProveedores.closest('.card').querySelector('h2');
                if (headerElement) {
                    headerElement.innerHTML = `Auditoría de Cuentas Corrientes (Proveedores) 
                        <div style="float:right; display:flex; gap: 10px; margin-top: -5px;">
                            <span class="data-font texto-verde privacy-mask" style="font-size:1.15rem; background: rgba(0, 255, 149, 0.1); padding: 5px 15px; border-radius: 8px; border: 1px solid var(--color-up);">
                                Abonado: ${this.zenMode ? '---' : '$' + this.fmtStr(totalPagadoProveedores, 1, false)}
                            </span>
                            <span class="data-font texto-warning privacy-mask" style="font-size:1.15rem; background: rgba(252, 163, 17, 0.1); padding: 5px 15px; border-radius: 8px; border: 1px solid var(--color-warning);">
                                Pendiente: ${this.zenMode ? '---' : '$' + this.fmtStr(totalDeudaProveedores, 1, false)}
                            </span>
                        </div>`;
                }

                if (dArray.length === 0) {
                    deudasHtml.push('<tr><td colspan="4" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No hay cuentas corrientes pendientes con proveedores</td></tr>');
                } else {
                    dArray.forEach(d => {
                        let pct = Math.min(100, d.amortizacionPct || 0);
                        let statusColor = d.activo ? 'var(--color-orange)' : 'var(--color-up)';
                        let statusLabel = d.activo ? 'Saldo Pendiente' : 'Cuenta Liquidada ✔️';

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
        let inver = (stats.flowAhorro || 0) / div; // CORREGIDO: Puntero a flowAhorro

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

    // FASE 3: Tablas y Rendimiento Físico adaptados al DOM Neon-Tech (Esqueletos Tonalizados)
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

            // NUEVA INTEGRACIÓN FASE 4: Matriz Operativa Mensual
            const hmOpGrid = document.getElementById('heatmap-operativo-grid');
            if (hmOpGrid) {
                let hmOpBuffer = [
                    '<div class="hm-header">Año</div><div class="hm-header">Ene</div><div class="hm-header">Feb</div><div class="hm-header">Mar</div><div class="hm-header">Abr</div><div class="hm-header">May</div><div class="hm-header">Jun</div><div class="hm-header">Jul</div><div class="hm-header">Ago</div><div class="hm-header">Sep</div><div class="hm-header">Oct</div><div class="hm-header">Nov</div><div class="hm-header">Dic</div><div class="hm-header" style="color:var(--color-primary); text-shadow: var(--shadow-neon-primary);">AVG</div>'
                ];
                
                let opMensual = {};
                for(let mes in s.flujoMensual) {
                    let y = mes.split('-')[0];
                    let m = mes.split('-')[1];
                    if(!opMensual[y]) opMensual[y] = {};
                    let f = s.flujoMensual[mes];
                    
                    let ing = f.ingresosComerciales || 0;
                    let gLocal = f.gastosComerciales || 0;
                    let gVida = f.costoVida || 0;
                    let neto = ing - gLocal - gVida;
                    let margen = ing > 0 ? (neto / ing) * 100 : 0;
                    
                    opMensual[y][m] = { neto, margen, ing };
                }

                Object.keys(opMensual).sort().reverse().forEach(y => {
                    hmOpBuffer.push(`<div class="hm-cell" style="background:var(--bg-input); color:var(--text-main); font-weight: 900;">${DOMPurify.sanitize(y)}</div>`);
                    let totalNetoYear = 0;
                    let totalIngYear = 0;
                    
                    for(let m=1; m<=12; m++) {
                        let mStr = String(m).padStart(2,'0');
                        let dataMes = opMensual[y][mStr];
                        if(!dataMes) {
                            hmOpBuffer.push(`<div class="hm-cell" style="color:var(--text-muted); font-weight:normal; background: transparent;">-</div>`);
                        } else {
                            totalNetoYear += dataMes.neto;
                            totalIngYear += dataMes.ing;
                            
                            let cls = '';
                            if(dataMes.margen >= 30) cls = 'hm-cell--pos';
                            else if(dataMes.margen > 0) cls = 'hm-cell--pos';
                            else if(dataMes.margen <= 0) cls = 'hm-cell--neg';
                            
                            let valStr = this.fmtStr(dataMes.neto, modelData.dolarBlue, modelData.vistaUSD);
                            let disp = this.zenMode ? `${dataMes.margen.toFixed(1)}%` : valStr;
                            
                            hmOpBuffer.push(`<div class="hm-cell ${cls} data-font" title="Margen: ${dataMes.margen.toFixed(1)}% | Neto: ${valStr}" style="font-size: 0.95rem;">${disp}</div>`);
                        }
                    }
                    
                    if (totalIngYear > 0) {
                        let avgMargen = (totalNetoYear / totalIngYear) * 100;
                        let avgCls = avgMargen >= 0 ? 'texto-verde' : 'texto-rojo';
                        let dispAvg = this.zenMode ? `${avgMargen.toFixed(1)}%` : this.fmtStr(totalNetoYear/12, modelData.dolarBlue, modelData.vistaUSD);
                        hmOpBuffer.push(`<div class="hm-cell data-font" style="background:var(--bg-panel); border-left: 2px solid var(--border-color);"><span class="${avgCls}" style="font-size: 1rem;" title="Margen Promedio: ${avgMargen.toFixed(1)}%">${dispAvg}</span></div>`);
                    } else {
                        hmOpBuffer.push(`<div class="hm-cell data-font" style="background:var(--bg-panel); border-left: 2px solid var(--border-color);"><span style="font-size: 1rem; color:var(--text-muted);">-</span></div>`);
                    }
                });
                hmOpGrid.innerHTML = hmOpBuffer.join('');
            }

            if (this.DOM.metStockCosto) this.DOM.metStockCosto.innerHTML = this.zenMode ? "- %" : this.fmt(s.stockCosto, modelData.dolarBlue, modelData.vistaUSD);
            if (this.DOM.metStockRetail) this.DOM.metStockRetail.innerHTML = this.zenMode ? "- %" : this.fmt(s.stockValorVenta, modelData.dolarBlue, modelData.vistaUSD);
            
            if (this.DOM.metRatioLiquidez) this.DOM.metRatioLiquidez.innerText = `${(s.liquidezAcida || 0).toFixed(2)}x / ${(s.liquidezCorriente || 0).toFixed(2)}x`;
            
            if (this.DOM.metHedgeStock) {
                let inflacionTotal = 0;
                for(let k in modelData.inflacion) inflacionTotal += modelData.inflacion[k];
                
                let markupReal = s.stockCosto > 0 ? ((s.stockValorVenta - s.stockCosto) / s.stockCosto) * 100 : 0;
                let spread = markupReal - inflacionTotal;
                
                this.DOM.metHedgeStock.innerText = `${spread > 0 ? '+' : ''}${spread.toFixed(1)}%`;
                this.DOM.metHedgeStock.className = `stat__value data-font ${spread >= 0 ? 'texto-verde' : 'texto-rojo'}`;
            }

            if(this.DOM.metIngresoLocal) this.DOM.metIngresoLocal.innerHTML = this.zenMode ? "100.0%" : this.fmt(s.ingresosConsolidadosGlobal !== undefined ? s.ingresosConsolidadosGlobal : s.flowIngreso, modelData.dolarBlue, modelData.vistaUSD);
            
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
                    provHtml.push('<tr><td colspan="2" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin registros u obligaciones logísticas recientes</td></tr>');
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
                    prestamosHtml.push('<tr><td colspan="7" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No se registran pasivos ni deudas financieras activas</td></tr>');
                } else {
                    pArray.forEach(p => {
                        let pct = Math.min(100, (p.pagado / p.totalDevolver) * 100);
                        let statusColor = p.activo ? 'var(--color-primary)' : 'var(--color-up)';
                        let statusLabel = p.activo ? 'Deuda Activa' : 'Saldado ✔️';
                        let cuotaActual = Math.min((p.cuotasPagadas || 0) + 1, p.cuotasTotales || 1);
                        let cuotaStr = p.activo ? `Cuota ${cuotaActual} de ${p.cuotasTotales || 1}` : `Liquidado en ${p.cuotasTotales || 1} pagos`;
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
                let dArray = Object.values(deudas);
                let totalDeudaProveedores = 0;
                let totalPagadoProveedores = 0;

                dArray.forEach(d => {
                    if (d.activo) {
                        totalDeudaProveedores += (d.capitalExigibleTotal - d.capitalServido);
                    }
                    totalPagadoProveedores += (d.capitalServido || 0);
                });

                // Algoritmo de Ordenamiento: Activos primero (descendentes), Saldados después (descendentes)
                dArray.sort((a,b) => {
                    if (a.activo && !b.activo) return -1;
                    if (!a.activo && b.activo) return 1;
                    return b.fecha.localeCompare(a.fecha);
                });

                let headerElement = this.DOM.tbodyDeudasProveedores.closest('.card').querySelector('h2');
                if (headerElement) {
                    headerElement.innerHTML = `Auditoría de Cuentas Corrientes (Proveedores) 
                        <div style="float:right; display:flex; gap: 10px; margin-top: -5px;">
                            <span class="data-font texto-verde privacy-mask" style="font-size:1.15rem; background: rgba(0, 255, 149, 0.1); padding: 5px 15px; border-radius: 8px; border: 1px solid var(--color-up);">
                                Abonado: ${this.zenMode ? '---' : '$' + this.fmtStr(totalPagadoProveedores, 1, false)}
                            </span>
                            <span class="data-font texto-warning privacy-mask" style="font-size:1.15rem; background: rgba(252, 163, 17, 0.1); padding: 5px 15px; border-radius: 8px; border: 1px solid var(--color-warning);">
                                Pendiente: ${this.zenMode ? '---' : '$' + this.fmtStr(totalDeudaProveedores, 1, false)}
                            </span>
                        </div>`;
                }

                if (dArray.length === 0) {
                    deudasHtml.push('<tr><td colspan="4" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No hay cuentas corrientes pendientes con proveedores</td></tr>');
                } else {
                    dArray.forEach(d => {
                        let pct = Math.min(100, d.amortizacionPct || 0);
                        let statusColor = d.activo ? 'var(--color-orange)' : 'var(--color-up)';
                        let statusLabel = d.activo ? 'Saldo Pendiente' : 'Cuenta Liquidada ✔️';

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
                '<div style="background:var(--bg-base); border: 1px solid var(--border-color); border-radius:12px; width: 100%; max-height: 250px; overflow-y: auto; overflow-x: hidden;">', // CORREGIDO: Scrollbar y altura máxima inyectada
                '<table class="dataTable-table" style="width:100%; min-width: 100%; text-align:left; border-collapse: collapse; margin-top: 0;">',
                '<thead style="background: var(--bg-panel); backdrop-filter: var(--glass-blur);"><tr><th style="padding:15px; font-weight: 900;">Período</th><th style="padding:15px; font-weight: 900; text-align:right;">Índice</th><th style="padding:15px;"></th></tr></thead>',
                '<tbody>'
            ];

            let keys = Object.keys(inflacion).sort().reverse();
            if (keys.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted); border: 2px dashed var(--border-color); border-radius: 12px;"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>No has registrado datos de inflación mensual.</div>';
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
            // CORRECCIÓN: Prevención estricta de Memory Leak al destruir instancias previas de Sparklines de Chart.js
            if (typeof ChartRenderer !== 'undefined' && ChartRenderer.destroySparklines) {
                ChartRenderer.destroySparklines();
            }

            this.DOM.tbodyPortafolio.innerHTML = '';
            if(Object.keys(modelData.portafolio).length === 0) {
                this.DOM.tbodyPortafolio.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Portafolio sin posiciones activas. Registre nuevas operaciones bursátiles para iniciar el seguimiento de mercado.</td></tr>`;
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
                
                let mainColor = this.sectorColors[cIdx];
                const row = document.importNode(template, true);
                
                let apiDataObj = cachePrecios[activo];
                let apiData = apiDataObj ? apiDataObj.data : null;

                let ratioText = this.CEDEAR_RATIOS[activo] ? `<br><span style="font-size:10px; color:var(--color-primary); font-weight:900;">RATIO ${this.CEDEAR_RATIOS[activo]}:1</span>` : '';
                
                row.querySelector('.td-avatar').innerHTML = `<div class="asset-wrapper" style="display:flex; align-items:center; gap:12px;"><span class="asset-badge" style="padding:6px 12px; border-radius:8px; font-weight:900; border-left: 4px solid ${mainColor}; background: ${mainColor}22; color:${mainColor}; box-shadow: -2px 0 10px ${mainColor}40;">${actSafe}</span><div><span style="font-size:11px;color:var(--text-muted); font-weight: 900; text-transform:uppercase;">${secSafe}</span>${ratioText}</div></div>`;
                row.querySelector('.td-cant').innerHTML = `<strong style="font-size: 1.1rem;">${d.cant}</strong>`;
                row.querySelector('.td-cant').style.textAlign = 'right';
                
                row.querySelector('.td-ppp').innerHTML = this.zenMode ? '---' : this.fmt(ppp, modelData.dolarBlue, modelData.vistaUSD);
                row.querySelector('.td-ppp').style.textAlign = 'right';
                
                row.querySelector('.td-costo').innerHTML = this.zenMode ? '---' : this.fmt(d.costo, modelData.dolarBlue, modelData.vistaUSD);
                row.querySelector('.td-costo').style.textAlign = 'right';
                
                let sparkWrap = row.querySelector('.td-spark div');
                let tdPrecio = row.querySelector('.td-precio');
                let tdGnr = row.querySelector('.td-gnr');
                
                if (tdPrecio) tdPrecio.style.textAlign = 'right';
                if (tdGnr) tdGnr.style.textAlign = 'right';

                if(apiData && apiData.price) {
                    let precio = apiData.price;
                    let valorMercado = precio * d.cant;
                    let ganancia = valorMercado - d.costo;
                    let pct = (ganancia / d.costo) * 100;
                    
                    let pColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#0A0D14' : 'var(--text-main)';
                    
                    let originalPriceHtml = (apiData.originalPrice && !this.zenMode) 
                        ? `<span style="display:block; font-size: 0.85rem; color: var(--color-up); font-weight: 900; letter-spacing: 0.5px; opacity: 0.9;">USD ${apiData.originalPrice.toFixed(2)}</span>` 
                        : '';

                    if (tdPrecio) {
                        tdPrecio.innerHTML = `<div class="td-sensitive" style="display:flex; flex-direction:column; align-items:flex-end;">
                            <strong style="font-size: 1.15rem; color: ${pColor};">${this.zenMode ? '---' : this.fmt(precio, modelData.dolarBlue, modelData.vistaUSD)}</strong>
                            ${originalPriceHtml}
                        </div>`;
                    }
                    
                    if (tdGnr) tdGnr.innerHTML = `<span class="td-sensitive ${ganancia>=0?'texto-verde':'texto-rojo'}" style="font-size: 1.15rem;">${ganancia>=0?'+':''}${this.zenMode ? pct.toFixed(2)+'%' : this.fmt(ganancia, modelData.dolarBlue, modelData.vistaUSD)} ${this.zenMode ? '' : '<small style="font-size: 0.85rem; opacity: 0.8;">('+pct.toFixed(2)+'%)</small>'}</span>`;
                    
                    if(apiData.history && apiData.history.length > 0) {
                        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
                        let sparkColor = apiData.history[apiData.history.length-1] >= apiData.history[0] ? getCSS('--color-up', '#00FF95') : getCSS('--color-down', '#F71735');
                        if (sparkWrap) {
                            sparkWrap.id = `spark-${actSafe}`;
                            sparkWrap.style.height = '35px';
                            sparkWrap.style.width = '70px';
                        }
                        sparksToDraw.push({ id: `spark-${actSafe}`, history: apiData.history.slice(-7), color: sparkColor });
                    } else {
                        if (sparkWrap) sparkWrap.innerHTML = '-';
                    }

                    basePatrimonio += valorMercado;
                    sectorChartData[d.sector] = (sectorChartData[d.sector]||0) + valorMercado;
                    actChartData[activo] = valorMercado;
                    expSectorialValor[d.sector] = (expSectorialValor[d.sector]||0) + valorMercado;
                    totalInvertidoMercado += valorMercado;

                } else if (apiData === null) {
                    if (tdPrecio) tdPrecio.innerHTML = `<span class="texto-rojo" title="Sin cotización local" style="font-weight: 900;">N/D</span>`;
                    if (tdGnr) tdGnr.innerHTML = `<strong style="color: var(--text-muted);">-</strong>`;
                    if (sparkWrap) sparkWrap.innerHTML = '-';
                    
                    basePatrimonio += d.costo;
                    sectorChartData[d.sector] = (sectorChartData[d.sector]||0) + d.costo;
                    actChartData[activo] = d.costo;
                    expSectorialValor[d.sector] = (expSectorialValor[d.sector]||0) + d.costo;
                    totalInvertidoMercado += d.costo;
                } else {
                    if (tdPrecio) tdPrecio.innerHTML = `<div class="skeleton" style="width:80px; margin-left:auto;"></div>`;
                    if (tdGnr) tdGnr.innerHTML = `<div class="skeleton" style="width:100px; margin-left:auto;"></div>`;
                    if (sparkWrap) sparkWrap.innerHTML = `<div class="skeleton" style="width:70px; height:35px; border-radius:6px;"></div>`;
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
            this.DOM.tbodyWatchlist.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color:var(--text-muted); font-weight: 800; border-bottom: none;">No sigues ningún activo aún. Agrega tickers a tu radar.</td></tr>';
            return;
        }

        // Cache del template nativo en memoria para re-renderizados ultrarrápidos y prevención XSS
        if (!this._tplWatchlistRow) {
            const tpl = document.createElement('template');
            tpl.innerHTML = `
                <tr style="transition: background 0.2s; background: var(--bg-input); border-bottom: 1px solid var(--border-color);">
                    <td class="td-activo" style="padding: 15px 20px;"></td>
                    <td class="td-precio data-font" style="padding: 15px 20px; text-align:right;"></td>
                    <td class="td-objetivo data-font privacy-mask" style="padding: 15px 20px; font-size: 1.15rem; text-align:right;"></td>
                    <td class="td-dif data-font" style="padding: 15px 20px; text-align:right;"></td>
                    <td style="padding: 15px 20px; text-align:center;">
                        <button class="btn-del btn--danger" style="padding: 8px 16px; font-size:11px; border-radius: 8px;" data-action="del-watchlist" title="Eliminar del Radar">Quitar</button>
                    </td>
                </tr>
            `;
            this._tplWatchlistRow = tpl;
        }

        const fragment = document.createDocumentFragment();

        wlData.forEach(w => {
            const row = document.importNode(this._tplWatchlistRow.content, true);

            let precioStr = '<div class="skeleton" style="width: 80px; margin-left:auto;"></div>';
            let difStr = '-';

            if (w.precioActual !== null && w.precioActual !== undefined) {
                precioStr = `<strong class="privacy-mask" style="font-size: 1.15rem;">$${this.fmtStr(w.precioActual, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</strong>`;
                let colorClass = w.distancia >= 0 ? 'texto-verde' : 'texto-rojo';
                difStr = `<span class="${colorClass}" style="font-size: 1.15rem;">${w.distancia > 0 ? '+' : ''}${w.distancia.toFixed(2)}%</span>`;
            }

            let ratioText = this.CEDEAR_RATIOS[w.activo] ? `<br><span style="font-size:0.8rem; color:var(--color-primary); font-weight:900;">Ratio ${this.CEDEAR_RATIOS[w.activo]}:1</span>` : '';

            let cacheSafeguard = this.currentModelData.cachePrecios || {};
            let apiDataObj = cacheSafeguard[w.activo];
            let origPriceText = (apiDataObj && apiDataObj.data && apiDataObj.data.originalPrice) ? `<span style="font-size:0.8rem; color:var(--color-up); margin-left:6px; font-weight:900;">(USD ${apiDataObj.data.originalPrice.toFixed(2)})</span>` : '';

            // Asignación DOM vectorizada segura contra XSS
            row.querySelector('.td-activo').innerHTML = `<strong style="color: var(--text-main); font-size: 1.15rem; text-shadow: var(--shadow-neon-primary);">${DOMPurify.sanitize(w.activo)}</strong>${origPriceText}${ratioText}`;
            row.querySelector('.td-precio').innerHTML = this.zenMode ? '---' : precioStr;
            row.querySelector('.td-objetivo').textContent = this.zenMode ? '---' : '$' + this.fmtStr(w.precioObjetivo, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
            row.querySelector('.td-dif').innerHTML = this.zenMode ? '---' : difStr;
            
            row.querySelector('.btn-del').dataset.id = w.activo;

            fragment.appendChild(row);
        });

        this.DOM.tbodyWatchlist.innerHTML = '';
        this.DOM.tbodyWatchlist.appendChild(fragment);
    },

    aplicarFiltrosHistorial(filtros) {
        this.historialFiltros = filtros;
        // Caché pre-procesada para evitar cuellos de botella en el scroll virtual
        this.historialDataFiltrada = this.historialData.filter(m => {
            let pass = true;
            if(this.historialFiltros.desde && m.fecha < this.historialFiltros.desde) pass = false;
            if(this.historialFiltros.hasta && m.fecha > this.historialFiltros.hasta) pass = false;
            if(this.historialFiltros.tipo && this.historialFiltros.tipo !== 'Todos' && m.tipo !== this.historialFiltros.tipo) pass = false;
            return pass;
        });
        this.renderVirtualScroll(true);
    },

    renderHistorial(modelData) {
        ErrorHandler.catchBoundary('Historial de Movimientos', 'historial', () => {
            UIMetrics.animateValue(this.DOM.histAhorroTotal, modelData.stats.totalAhorradoFisico, (val) => this.zenMode ? "---" : this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
            UIMetrics.animateValue(this.DOM.histRetiroTotal, modelData.stats.totalRetirado, (val) => this.zenMode ? "---" : this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));
            UIMetrics.animateValue(this.DOM.histNeto, modelData.stats.ahorroArsPuro, (val) => this.zenMode ? "---" : this.fmt(val, modelData.dolarBlue, modelData.vistaUSD));

            this.historialData = modelData.movimientos.slice().reverse();
            this.historialDataFiltrada = [...this.historialData]; // Inicialización de caché de scroll
            this.DOM.vsTbody.innerHTML = ''; // Fuerza repintado total al editar
            this.renderVirtualScroll();
        });
    },

    renderVirtualScroll(resetScroll = false) {
        let datosAmostrar = this.historialDataFiltrada || this.historialData;

        if(resetScroll) {
            this.DOM.vsViewport.scrollTop = 0;
        }

        if(!datosAmostrar || datosAmostrar.length === 0) {
            requestAnimationFrame(() => {
                this.DOM.vsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 100px; color:var(--text-muted);"><svg width="80" height="80" style="margin-bottom:20px; opacity:0.3; filter: drop-shadow(0 0 10px rgba(9, 251, 255, 0.5));"><use href="#icon-empty"></use></svg><br><h3 style="margin-bottom:10px; font-weight: 900; letter-spacing: 1px;">Libro Mayor sin transacciones</h3><p style="font-size:1rem; font-weight: 600;">Ingrese los primeros asientos contables para iniciar el seguimiento del flujo patrimonial.</p></td></tr>`;
                this.DOM.vsSpacer.style.height = '0px';
                this.DOM.vsTable.style.transform = `translateY(0px)`;
            });
            return;
        }

        const scrollTop = this.DOM.vsViewport.scrollTop;
        const viewportHeight = this.DOM.vsViewport.clientHeight || 500;
        
        let startIndex = Math.floor(scrollTop / this.vsRowHeight);
        let visibleRows = Math.ceil(viewportHeight / this.vsRowHeight);
        
        const buffer = 5;
        startIndex = Math.max(0, startIndex - buffer);
        const endIndex = Math.min(datosAmostrar.length, startIndex + visibleRows + (buffer * 2));

        const existingRows = Array.from(this.DOM.vsTbody.children);
        const rowsNeeded = endIndex - startIndex;
        const needsFullRebuild = existingRows.length !== rowsNeeded || existingRows[0]?.dataset?.diffId === undefined;
        
        const spacerHeight = `${datosAmostrar.length * this.vsRowHeight}px`;
        const tableTransform = `translateY(${startIndex * this.vsRowHeight}px)`;

        requestAnimationFrame(() => {
            this.DOM.vsSpacer.style.height = spacerHeight;
            
            if (needsFullRebuild) {
                const fragment = document.createDocumentFragment();
                const tpl = this.DOM.tplHistorial.content;

                for (let i = startIndex; i < endIndex; i++) {
                    const m = datosAmostrar[i];
                    const row = document.importNode(tpl, true);
                    let tr = row.querySelector('tr');
                    tr.dataset.diffId = m.id;
                    tr.dataset.zen = this.zenMode;
                    
                    let badgeClass = this.getBadgeClass(m.tipo);
                    
                    let descHtml = m.categoria 
                        ? `<span style="display:inline-flex; align-items:center; gap:8px;"><div style="width:10px; height:10px; border-radius:50%; background:${this.getCategoryColor(m.categoria)}; box-shadow: 0 0 8px ${this.getCategoryColor(m.categoria)};"></div>${DOMPurify.sanitize(m.categoria)}</span>`
                        : DOMPurify.sanitize(m.activo ? `${m.cantidad||''}x ${m.activo}` : (m.proveedor ? m.proveedor : (m.socio ? m.socio : (m.entidad ? m.entidad : (m.tipo === 'Ajuste Stock Inicial' ? 'Inventario Base' : (m.tipo === 'Rescate a Caja' ? 'Inyección Liquidez a Caja' : (m.tipo === 'Transferencia Ahorro' ? 'Fuga hacia Billetera Bursátil' : (m.usd?`u$s ${m.usd}`:'-'))))))));
                    
                    if (m.notas) {
                        let markdownHtml;
                        if (this._mdCache.has(m.notas)) {
                            markdownHtml = this._mdCache.get(m.notas);
                        } else {
                            markdownHtml = DOMPurify.sanitize(marked.parse(m.notas));
                            this._mdCache.set(m.notas, markdownHtml);
                        }
                        descHtml += `<div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-base); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--color-primary); line-height:1.5;">${markdownHtml}</div>`;
                    }

                    let res = '-';
                    if(m.resultadoCalculado !== undefined && m.tipo === 'Venta') {
                        let sign = m.resultadoCalculado > 0 ? '+' : (m.resultadoCalculado < 0 ? '-' : '');
                        let colorClass = m.resultadoCalculado >= 0 ? 'texto-verde' : 'texto-rojo';
                        let tag = this.currentModelData.vistaUSD ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
                        let valStr = this.fmtStr(Math.abs(m.resultadoCalculado), this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
                        res = `<div style="display:inline-flex; align-items:center; justify-content:flex-end; width:100%; gap:8px; white-space:nowrap;">${this.zenMode ? '' : tag} <strong class="data-font ${colorClass} privacy-mask" style="font-size: 1.15rem;">${sign}${this.zenMode ? '---' : valStr}</strong></div>`;
                    }

                    row.querySelector('.td-fecha').innerHTML = `<span style="font-weight: 800; color: var(--text-muted); font-size: 0.95rem;">${m.fecha}</span>`;
                    row.querySelector('.td-tipo').innerHTML = `<span class="badge ${badgeClass}" style="box-shadow: none;">${m.tipo}</span>`;
                    row.querySelector('.td-desc').innerHTML = descHtml;
                    row.querySelector('.td-flujo').innerHTML = `<strong style="font-size: 1.15rem; color: var(--text-main);">${this.zenMode ? '---' : this.fmt(m.monto, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</strong>`;
                    row.querySelector('.td-res').innerHTML = res;
                    row.querySelector('.td-acc').innerHTML = `
                        <button class="btn--icon" style="display:inline-flex; padding:10px; margin-right:4px;" data-action="editar-operacion" data-id="${m.id}" title="Editar Transacción">
                            <svg width="18" height="18"><use href="#icon-edit"></use></svg>
                        </button>
                        <button class="btn--danger" style="display:inline-flex; padding:10px; border-radius:10px; box-shadow: none;" data-action="borrar-operacion" data-id="${m.id}" title="Eliminar Registro">
                            <svg width="18" height="18"><use href="#icon-trash"></use></svg>
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
                    const tr = this.DOM.vsTbody.children[i - startIndex]; 
                    
                    if (tr.dataset.diffId != m.id || String(this.zenMode) !== String(tr.dataset.zen)) {
                        tr.dataset.diffId = m.id;
                        tr.dataset.zen = this.zenMode;

                        const tdFecha = tr.children[0];
                        const tdTipo = tr.children[1];
                        const tdDesc = tr.children[2];
                        const tdFlujo = tr.children[3];
                        const tdRes = tr.children[4];
                        const tdAcc = tr.children[5];

                        let badgeClass = this.getBadgeClass(m.tipo);
                        
                        let descHtml = m.categoria 
                            ? `<span style="display:inline-flex; align-items:center; gap:8px;"><div style="width:10px; height:10px; border-radius:50%; background:${this.getCategoryColor(m.categoria)}; box-shadow: 0 0 8px ${this.getCategoryColor(m.categoria)};"></div>${DOMPurify.sanitize(m.categoria)}</span>`
                            : DOMPurify.sanitize(m.activo ? `${m.cantidad||''}x ${m.activo}` : (m.proveedor ? m.proveedor : (m.socio ? m.socio : (m.entidad ? m.entidad : (m.tipo === 'Ajuste Stock Inicial' ? 'Inventario Base' : (m.tipo === 'Rescate a Caja' ? 'Inyección Liquidez a Caja' : (m.tipo === 'Transferencia Ahorro' ? 'Fuga hacia Billetera Bursátil' : (m.usd?`u$s ${m.usd}`:'-'))))))));
                        
                        if (m.notas) {
                            let markdownHtml;
                            if (this._mdCache.has(m.notas)) {
                                markdownHtml = this._mdCache.get(m.notas);
                            } else {
                                markdownHtml = DOMPurify.sanitize(marked.parse(m.notas));
                                this._mdCache.set(m.notas, markdownHtml);
                            }
                            descHtml += `<div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-base); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--color-primary); line-height:1.5;">${markdownHtml}</div>`;
                        }

                        let res = '-';
                        if(m.resultadoCalculado !== undefined && m.tipo === 'Venta') {
                            let sign = m.resultadoCalculado > 0 ? '+' : (m.resultadoCalculado < 0 ? '-' : '');
                            let colorClass = m.resultadoCalculado >= 0 ? 'texto-verde' : 'texto-rojo';
                            let tag = this.currentModelData.vistaUSD ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
                            let valStr = this.fmtStr(Math.abs(m.resultadoCalculado), this.currentModelData.dolarBlue, this.currentModelData.vistaUSD);
                            res = `<div style="display:inline-flex; align-items:center; justify-content:flex-end; width:100%; gap:8px; white-space:nowrap;">${this.zenMode ? '' : tag} <strong class="data-font ${colorClass} privacy-mask" style="font-size: 1.15rem;">${sign}${this.zenMode ? '---' : valStr}</strong></div>`;
                        }

                        tdFecha.innerHTML = `<span style="font-weight: 800; color: var(--text-muted); font-size: 0.95rem;">${m.fecha}</span>`;
                        tdTipo.innerHTML = `<span class="badge ${badgeClass}" style="box-shadow: none;">${m.tipo}</span>`;
                        tdDesc.innerHTML = descHtml;
                        tdFlujo.innerHTML = `<strong style="font-size: 1.15rem; color: var(--text-main);">${this.zenMode ? '---' : this.fmt(m.monto, this.currentModelData.dolarBlue, this.currentModelData.vistaUSD)}</strong>`;
                        tdRes.innerHTML = res;
                        
                        if (tdAcc.firstElementChild.dataset.id !== String(m.id)) {
                            tdAcc.innerHTML = `
                                <button class="btn--icon" style="display:inline-flex; padding:10px; margin-right:4px;" data-action="editar-operacion" data-id="${m.id}" title="Editar Transacción">
                                    <svg width="18" height="18"><use href="#icon-edit"></use></svg>
                                </button>
                                <button class="btn--danger" style="display:inline-flex; padding:10px; border-radius:10px; box-shadow: none;" data-action="borrar-operacion" data-id="${m.id}" title="Eliminar Registro">
                                    <svg width="18" height="18"><use href="#icon-trash"></use></svg>
                                </button>
                            `;
                        }
                    }
                }
            }
            this.DOM.vsTable.style.transform = tableTransform;
        });
    },

    renderCalendario(modelData) {
        ErrorHandler.catchBoundary('Calendario Financiero', 'calendario', () => {
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            this.DOM.calMesAno.innerText = `${meses[this.calMes]} ${this.calAno}`;
            
            let grid = this.DOM.calDias;
            grid.innerHTML = '';
            
            grid.onclick = (e) => {
                const dayNode = e.target.closest('.cal-day');
                if (!dayNode || !dayNode.dataset.date) return;
                
                const fStr = dayNode.dataset.date;
                let movs = modelData.stats.movimientosPorFecha && modelData.stats.movimientosPorFecha[fStr] 
                            ? modelData.stats.movimientosPorFecha[fStr] 
                            : [];
                            
                const p = this.DOM.calDetalle;
                if(movs.length === 0) {
                    p.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 40px; border: 2px dashed var(--border-color); border-radius: 12px;"><h3 style="margin-bottom: 10px; font-size:1.2rem; font-weight: 900; letter-spacing: 1px;">${fStr}</h3><p style="font-size: 1rem;">Día sin movimientos registrados.</p></div>`;
                    return;
                }
                
                let detailBuffer = [`<h3 style="margin-bottom: 20px; font-size:1.2rem; font-weight: 900; letter-spacing: 0.5px; color: var(--color-primary); text-shadow: var(--shadow-neon-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Movimientos del ${fStr}</h3>`];
                movs.forEach(m => {
                    let c = this.getBadgeClass(m.tipo);
                    let descStr = m.activo ? `${m.cantidad||''}x ${m.activo}` : (m.categoria ? m.categoria : (m.proveedor ? m.proveedor : (m.socio ? m.socio : (m.entidad ? m.entidad : (m.tipo === 'Ajuste Stock Inicial' ? 'Inventario Base' : (m.tipo === 'Rescate a Caja' ? 'Inyección Liquidez a Caja' : (m.tipo === 'Transferencia Ahorro' ? 'Fuga hacia Billetera Bursátil' : (m.usd?`u$s ${m.usd}`:'-'))))))));
                    
                    let desc = DOMPurify.sanitize(descStr); 
                    
                    detailBuffer.push(
                        `<div style="padding:15px 20px; background:var(--bg-input); border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-color); box-shadow: var(--shadow-card); transition: transform 0.2s;">`,
                        `<div><span class="badge ${c}" style="margin-bottom:8px;">${m.tipo}</span><br><span style="font-size:1rem; font-weight: 700;">${desc}</span></div>`,
                        `<strong class="data-font ${m.tipo==='Venta'?'texto-primario':''}" style="font-size: 1.2rem; font-weight: 900; text-align:right;">${this.zenMode ? '---' : this.fmt(m.monto, modelData.dolarBlue, modelData.vistaUSD)}</strong>`,
                        `</div>`
                    );
                });
                p.innerHTML = detailBuffer.join('');
            };

            let primerDia = new Date(this.calAno, this.calMes, 1).getDay();
            if(primerDia === 0) primerDia = 7;
            
            let diasMes = new Date(this.calAno, this.calMes + 1, 0).getDate();
            
            const fragment = document.createDocumentFragment();
            const tpl = this.DOM.tplCalDay.content;

            const tzOffset = (new Date()).getTimezoneOffset() * 60000;
            const fechaLocalHoy = new Date(Date.now() - tzOffset).toISOString().split('T')[0];

            for(let i=1; i<primerDia; i++) {
                let emptyDiv = document.createElement('div');
                emptyDiv.className = "cal-day empty";
                fragment.appendChild(emptyDiv);
            }

            for(let d=1; d<=diasMes; d++) {
                let fStr = `${this.calAno}-${String(this.calMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                
                let movs = modelData.stats.movimientosPorFecha && modelData.stats.movimientosPorFecha[fStr] 
                            ? modelData.stats.movimientosPorFecha[fStr] 
                            : [];
                
                let cssClass = (fStr === fechaLocalHoy) ? 'today' : '';
                if(movs.length > 0) cssClass += ' has-data';
                
                const cellNode = document.importNode(tpl, true);
                const wrapper = cellNode.querySelector('.cal-day');
                wrapper.className = `cal-day ${cssClass}`;
                wrapper.dataset.date = fStr; 
                wrapper.querySelector('.cal-date').textContent = d;
                
                let dotsContainer = wrapper.querySelector('.cal-dots');
                movs.forEach(m => {
                    let dotColor = 'var(--color-primary)';
                    
                    if (m.categoria) {
                        dotColor = this.getCategoryColor(m.categoria);
                    } else {
                        let c = this.getBadgeClass(m.tipo);
                        if (c.includes('bg-retiro') || c.includes('bg-gasto-local')) dotColor = '#FF003C'; 
                        else if (c.includes('bg-ingreso-local')) dotColor = '#00FF95'; 
                        else if (c.includes('bg-prestamo-pago')) dotColor = '#00F5FF'; 
                        else if (c.includes('bg-gasto-vida')) dotColor = '#FF871A'; 
                        else if (c.includes('bg-proveedor')) dotColor = '#FFD500'; 
                        else if (c.includes('bg-sociedad')) dotColor = '#B800FF'; 
                        else if (c.includes('bg-ahorro-transf') || c.includes('bg-prestamo-alta')) dotColor = '#6045F4'; 
                        else if (c.includes('bg-compra')) dotColor = '#FF007B'; 
                        else if (c.includes('bg-venta')) dotColor = '#00F0FF'; 
                        else if (c.includes('bg-rendimiento')) dotColor = '#1AA7EC'; 
                    }
                    
                    let dot = document.createElement('div');
                    dot.className = `cal-dot`;
                    dot.style.backgroundColor = dotColor;
                    dot.style.boxShadow = `0 0 6px ${dotColor}, 0 0 12px ${dotColor}80`;
                    dotsContainer.appendChild(dot);
                });
                
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
                this.DOM.infoHoldingPeriod.innerHTML = `<span style="font-weight: 900; color: var(--color-primary); text-shadow: var(--shadow-neon-primary);">${Math.round(s.holdingPeriodDias || 0)} Días</span>`;
            }

            if (this.DOM.valCorrelacion && this.DOM.descCorrelacion) {
                let conc = s.riesgoConcentracion;
                if (conc && conc.hhi > 0) {
                    this.DOM.valCorrelacion.innerText = Math.round(conc.hhi);
                    this.DOM.descCorrelacion.innerText = conc.label;
                    let color = conc.hhi < 1500 ? 'var(--color-up)' : (conc.hhi < 2500 ? 'var(--color-warning)' : 'var(--color-down)');
                    this.DOM.valCorrelacion.style.color = color;
                    this.DOM.valCorrelacion.style.textShadow = `0 0 15px ${color.replace('var(', '').replace(')', '') === '--color-up' ? 'rgba(0, 255, 149, 0.4)' : (color.includes('warning') ? 'rgba(252, 163, 17, 0.4)' : 'rgba(247, 23, 53, 0.4)')}`;
                } else {
                    this.DOM.valCorrelacion.innerText = '-';
                    this.DOM.descCorrelacion.innerText = 'Faltan datos';
                }
            }

            if (this.DOM.infoAtribucionSector) {
                let attribBuffer = ['<table style="width:100%; font-size:1rem; margin-top:10px; border-collapse: separate; border-spacing: 0 5px;">'];
                let sectores = Object.entries(s.atribucionSector || {}).sort((a,b) => b[1] - a[1]);
                
                if(sectores.length === 0) {
                    attribBuffer.push('<tr><td style="color:var(--text-muted); text-align:center; padding:30px; font-weight: 800; border: 2px dashed var(--border-color); border-radius: 12px;">No se registran liquidaciones de activos en el período evaluado.</td></tr>');
                } else {
                    sectores.forEach(([sector, resultado]) => {
                        let color = resultado >= 0 ? 'var(--color-up)' : 'var(--color-down)';
                        let signo = resultado > 0 ? '+' : (resultado < 0 ? '-' : '');
                        attribBuffer.push(
                            `<tr style="background: var(--bg-input); transition: transform 0.2s;">`,
                            `<td style="padding: 15px 20px; color:var(--text-main); font-weight: 900; border-radius: 12px 0 0 12px;">${DOMPurify.sanitize(sector)}</td>`,
                            `<td class="data-font privacy-mask" style="text-align:right; color:${color}; font-weight:900; font-size: 1.15rem; padding: 15px 20px; border-radius: 0 12px 12px 0;">${signo}${this.zenMode ? '---' : this.fmtStr(Math.abs(resultado), modelData.dolarBlue, modelData.vistaUSD)}</td>`,
                            `</tr>`
                        );
                    });
                }
                attribBuffer.push('</table>');
                this.DOM.infoAtribucionSector.innerHTML = attribBuffer.join('');
            }

            if (s.riesgo) {
                if (this.DOM.infoSharpe) this.DOM.infoSharpe.innerHTML = `<span class="data-font privacy-mask" style="font-weight: 900; color: var(--text-main);">${s.riesgo.sharpe}</span>`;
                if (this.DOM.infoSortino) this.DOM.infoSortino.innerHTML = `<span class="data-font privacy-mask" style="font-weight: 900; color: var(--text-main);">${s.riesgo.sortino}</span>`;
                if (this.DOM.infoVolatilidad) this.DOM.infoVolatilidad.innerHTML = `<span class="data-font privacy-mask texto-warning">${s.riesgo.volatilidad}%</span>`;
            }

            let cagrColor = s.cagr >= 0 ? 'texto-verde' : 'texto-rojo';
            document.getElementById('info-cagr').innerHTML = `<span class="${cagrColor}" style="font-size: 3rem; font-weight: 900;">${(s.cagr || 0).toFixed(2)}%</span>`;

            if(!modelData.movimientos || modelData.movimientos.length === 0) {
                wrapDD.innerHTML = '<div style="text-align:center; padding: 60px; color:var(--text-muted); font-size: 1.1rem; font-weight: 800;"><svg width="64" height="64" style="margin-bottom:15px; opacity:0.5;"><use href="#icon-empty"></use></svg><br>Sin datos suficientes para calcular riesgos</div>';
                return;
            }

            let peakBursatilReal = Math.max(...s.historyBursatil);
            document.getElementById('info-max-patrimonio').innerHTML = `<span style="font-size: 3rem; font-weight: 900; color: var(--color-primary); text-shadow: var(--shadow-neon-primary);">${this.zenMode ? '---' : this.fmt(peakBursatilReal, modelData.dolarBlue, modelData.vistaUSD)}</span>`;
            
            document.getElementById('info-max-dd').innerHTML = `<span style="font-size: 3rem; font-weight: 900; color: var(--color-down); text-shadow: var(--shadow-neon-down);">${(s.maxDrawdownBursatil || 0).toFixed(2)}%</span>`;
            document.getElementById('info-current-dd').innerHTML = `<span style="font-size: 1rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Drawdown Actual: ${(s.historyDrawdown[s.historyDrawdown.length-1] || 0).toFixed(2)}%</span>`;

            ChartRenderer.renderDrawdown(s.historyFechas, s.historyDrawdown);

            const hGrid = document.getElementById('heatmap-grid');
            let heatmapBuffer = [
                '<div class="hm-header">Año</div><div class="hm-header">Ene</div><div class="hm-header">Feb</div><div class="hm-header">Mar</div><div class="hm-header">Abr</div><div class="hm-header">May</div><div class="hm-header">Jun</div><div class="hm-header">Jul</div><div class="hm-header">Ago</div><div class="hm-header">Sep</div><div class="hm-header">Oct</div><div class="hm-header">Nov</div><div class="hm-header">Dic</div><div class="hm-header" style="color:var(--color-primary); text-shadow: var(--shadow-neon-primary);">YTD</div>'
            ];

            let fechas = s.historyFechas;
            let pnlMensual = {};
            
            for (let i = 0; i < fechas.length; i++) {
                let f = fechas[i];
                let valMes = f.substring(0,7);
                let year = valMes.split('-')[0];
                let month = valMes.split('-')[1];
                
                if (!pnlMensual[year]) pnlMensual[year] = {};
                if (!pnlMensual[year][month]) {
                    pnlMensual[year][month] = { indexStart: i > 0 ? s.historyIndexTWR[i-1] : 100, indexEnd: 100, pnlPuro: 0 };
                }
                
                pnlMensual[year][month].indexEnd = s.historyIndexTWR[i];
                
                let prevVal = i > 0 ? s.historyBursatil[i-1] : 0;
                let todayVal = s.historyBursatil[i];
                let flow = s.historyFlujoBursatil[i] || 0;
                pnlMensual[year][month].pnlPuro += (todayVal - (prevVal + flow));
            }

            Object.keys(pnlMensual).sort().reverse().forEach(y => {
                heatmapBuffer.push(`<div class="hm-cell" style="background:var(--bg-input); color:var(--text-main); font-weight: 900;">${DOMPurify.sanitize(y)}</div>`);
                let startYtdIndex = null;
                let endYtdIndex = null;
                
                for(let m=1; m<=12; m++) {
                    let mStr = String(m).padStart(2,'0');
                    let dataMes = pnlMensual[y][mStr];
                    if(!dataMes) {
                        heatmapBuffer.push(`<div class="hm-cell" style="color:var(--text-muted); font-weight:normal; background: transparent;">-</div>`);
                    } else {
                        if (startYtdIndex === null) startYtdIndex = dataMes.indexStart;
                        endYtdIndex = dataMes.indexEnd;
                        
                        let returnPorcentual = dataMes.indexStart > 0 ? ((dataMes.indexEnd / dataMes.indexStart) - 1) * 100 : 0;
                        
                        let cls = '';
                        if(returnPorcentual > 5) cls = 'hm-cell--pos';
                        else if(returnPorcentual > 0) cls = 'hm-cell--pos';
                        else if(returnPorcentual < -5) cls = 'hm-cell--neg';
                        else if(returnPorcentual < 0) cls = 'hm-cell--neg';
                        
                        let numTxt = returnPorcentual === 0 ? '0%' : (returnPorcentual>0?'+':'') + returnPorcentual.toFixed(1) + '%';
                        
                        // CORRECCIÓN: Se elimina la doble división. Se asume que dataMes.pnlPuro ya está en ARS.
                        let divValStr = this.fmtStr(dataMes.pnlPuro, modelData.dolarBlue, modelData.vistaUSD);
                        
                        heatmapBuffer.push(`<div class="hm-cell ${cls} data-font" title="Variación Absoluta Mes: ${this.zenMode ? 'Oculto' : divValStr}" style="font-size: 0.95rem;">${numTxt}</div>`);
                    }
                }
                
                if (startYtdIndex !== null && endYtdIndex !== null) {
                    let ytdPct = ((endYtdIndex / startYtdIndex) - 1) * 100;
                    let ytdCls = ytdPct >= 0 ? 'texto-verde' : 'texto-rojo';
                    let ytdSign = ytdPct > 0 ? '+' : '';
                    heatmapBuffer.push(`<div class="hm-cell data-font" style="background:var(--bg-panel); border-left: 2px solid var(--border-color);"><span class="${ytdCls}" style="font-size: 1rem;">${ytdSign}${ytdPct.toFixed(1)}%</span></div>`);
                } else {
                    heatmapBuffer.push(`<div class="hm-cell data-font" style="background:var(--bg-panel); border-left: 2px solid var(--border-color);"><span style="font-size: 1rem; color:var(--text-muted);">-</span></div>`);
                }
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
            
            // Evaluadores dinámicos 
            const inIncAporte = document.getElementById('calc-inc-aporte');
            const incAporte = inIncAporte ? (this.cleanNum(inIncAporte.value) / 100) : 0;
            
            const inInflacion = document.getElementById('calc-inflacion');
            const inflacion = inInflacion ? (this.cleanNum(inInflacion.value) / 100) : 0;
            
            const inImpuestos = document.getElementById('calc-impuestos');
            const impuestos = inImpuestos ? (this.cleanNum(inImpuestos.value) / 100) : 0;
            
            const inFrec = document.getElementById('calc-frecuencia');
            const frecCapitalizacion = inFrec ? inFrec.value : 'mensual';

            if (ans <= 0 || tAnual < 0) return;
            
            // 1. Tasa Nominal Neta de Carga Impositiva (Tax Drag)
            const tAnualNeto = (tAnual / 100) * (1 - impuestos); 
            
            // 2. Tasa Real Ajustada por Inflación (Ecuación de Fisher)
            const rAnualReal = ((1 + tAnualNeto) / (1 + inflacion)) - 1;

            let lbl = [];
            let dAp = [];
            let dInt = [];

            let capitalActual = cIni;
            let aportesAcumulados = cIni;
            let cuotaMensualEnCurso = cMen;

            for(let anio = 1; anio <= ans; anio++) {
                for (let mes = 1; mes <= 12; mes++) {
                    aportesAcumulados += cuotaMensualEnCurso;
                    capitalActual += cuotaMensualEnCurso;

                    // Lógica de Capitalización Algorítmica Pura
                    if (frecCapitalizacion === 'continua') {
                        let rMensualCont = Math.log(1 + rAnualReal) / 12;
                        capitalActual = capitalActual * Math.exp(rMensualCont);
                    } else if (frecCapitalizacion === 'diaria') {
                        let rDiaria = Math.pow(1 + rAnualReal, 1/365) - 1;
                        capitalActual = capitalActual * Math.pow(1 + rDiaria, 30.416);
                    } else if (frecCapitalizacion === 'mensual') {
                        let rMensual = rAnualReal / 12;
                        capitalActual *= (1 + rMensual);
                    } else if (frecCapitalizacion === 'trimestral' && mes % 3 === 0) {
                        let rTrimestral = rAnualReal / 4;
                        capitalActual *= (1 + rTrimestral);
                    } else if (frecCapitalizacion === 'anual' && mes === 12) {
                        capitalActual *= (1 + rAnualReal);
                    }
                }
                
                // Incremento anual escalonado de aportes (Ajuste por paritarias / ascensos)
                cuotaMensualEnCurso *= (1 + incAporte);
                
                lbl.push(`Año ${anio}`);
                dAp.push(aportesAcumulados);
                dInt.push(capitalActual - aportesAcumulados);
            }

            let totalAportadoF = dAp[dAp.length-1] || 0;
            let totalInteresF = dInt[dInt.length-1] || 0;
            let capitalFinalF = totalAportadoF + totalInteresF;

            if (this.DOM.calcResAportado) this.DOM.calcResAportado.innerHTML = this.zenMode ? '---' : `<span class="privacy-mask" style="font-size: 1.8rem; font-weight: 900; color: var(--text-main);">$ ${this.fmtStr(totalAportadoF, 1, false)}</span>`;
            if (this.DOM.calcResInteres) this.DOM.calcResInteres.innerHTML = `<span class="texto-verde privacy-mask" style="font-size: 1.8rem; font-weight: 900;">${this.zenMode ? '---' : '+$ ' + this.fmtStr(totalInteresF, 1, false)}</span>`;
            if (this.DOM.calcResFinal) this.DOM.calcResFinal.innerHTML = `<span class="texto-primario privacy-mask" style="font-size: 2.2rem; font-weight: 900;">${this.zenMode ? '---' : '$ ' + this.fmtStr(capitalFinalF, 1, false)}</span>`;
            
            if (this.DOM.wrapCalc) {
                const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
                const colorC1 = getCSS('--color-primary', '#6045F4');
                const colorC2 = getCSS('--color-up', '#00FF95');
                ChartRenderer.renderCalculadora(lbl, dAp, dInt, 'chartCalculadora', colorC1, colorC2, this.DOM.wrapCalc);
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
            
            const cagrNominal = parseFloat(document.getElementById('fire-cagr').value) || 8;
            const inflacionFija = 3.0; // Promedio histórico estructural
            const cagrRealPct = cagrNominal - inflacionFija; 
            const swrPct = parseFloat(document.getElementById('fire-swr').value) || 4;
            
            // CORRECCIÓN: Prevención de División por cero e Infinity
            const swrSeguro = Math.max(0.01, swrPct); 

            const gastoTotal = gastoBase + gastoExtra;
            const gastoAnual = gastoTotal * 12;
            
            // CORRECCIÓN: Evitar Infinite Math. Evalúa a 0 si es inmanejable.
            let targetFIRE = gastoAnual / (swrSeguro / 100);
            if (!isFinite(targetFIRE)) targetFIRE = 0;

            document.getElementById('fire-res-gasto').innerHTML = this.zenMode ? '---' : `<span class="privacy-mask" style="font-size: 2.5rem; font-weight: 900; color: var(--color-down); text-shadow: var(--shadow-neon-down);">$ ${this.fmtStr(gastoTotal, 1, false)}</span>`;
            document.getElementById('fire-res-objetivo').innerHTML = this.zenMode ? '---' : `<span class="privacy-mask" style="font-size: 2.5rem; font-weight: 900; color: var(--color-purple); text-shadow: var(--shadow-neon-purple);">$ ${this.fmtStr(targetFIRE, 1, false)}</span>`;

            // Refactorización a Tasa Efectiva Mensual para soportar DCA (Dollar Cost Averaging) Real
            let rMensual = Math.pow(1 + (cagrRealPct / 100), 1/12) - 1;
            let capitalAcumulado = capIni;
            let anos = 0;
            const maxAnos = 60;

            let lbl = ['Hoy'];
            let dataCapital = [capIni];
            let dataObjetivo = [targetFIRE];

            if(capIni < targetFIRE) {
                while(capitalAcumulado < targetFIRE && anos < maxAnos) {
                    anos++;
                    for (let m = 0; m < 12; m++) {
                        capitalAcumulado = (capitalAcumulado + ahorroMes) * (1 + rMensual);
                        // PREVENCIÓN DE DESBORDAMIENTO: Límite arquitectónico V8 Engine
                        if (capitalAcumulado > Number.MAX_SAFE_INTEGER) capitalAcumulado = Number.MAX_SAFE_INTEGER;
                    }
                    lbl.push(`Año ${anos}`);
                    dataCapital.push(capitalAcumulado);
                    dataObjetivo.push(targetFIRE);
                }
            }

            let elAnos = document.getElementById('fire-res-anos');
            if(capIni >= targetFIRE) {
                elAnos.innerText = "¡Independencia Alcanzada!";
                elAnos.className = "data-font texto-primario";
                elAnos.style.fontSize = "3rem";
            } else if (anos >= maxAnos) {
                elAnos.innerText = "+60 Años";
                elAnos.className = "data-font texto-rojo";
                elAnos.style.fontSize = "4rem";
            } else {
                elAnos.innerText = `${anos} Años`;
                elAnos.className = `data-font ${anos <= 10 ? 'texto-verde' : (anos <= 20 ? 'texto-warning' : 'texto-rojo')}`;
                elAnos.style.fontSize = "5rem";
            }

            // SIMULACIÓN DE MONTECARLO (Sequence of Returns Risk Mitigation)
            const elProbabilidad = document.getElementById('fire-res-probabilidad');
            if (elProbabilidad) {
                const inVol = document.getElementById('info-volatilidad');
                let volTxt = inVol ? inVol.innerText.replace('%', '').trim() : '15';
                
                // CORRECCIÓN: Filtrado para predecir colapsos de cálculo si Vol = 0
                let volatilidad = parseFloat(volTxt);
                if (isNaN(volatilidad) || volatilidad <= 0) volatilidad = 15; 
                
                let volReal = volatilidad / 100;

                let exitos = 0;
                let iteraciones = 1000;
                let horizonteSimulacion = 40; 
                let rAnual = cagrRealPct / 100;

                for(let i = 0; i < iteraciones; i++) {
                    let capMC = capIni;
                    let esRetiro = capMC >= targetFIRE;
                    let fracaso = false;

                    for(let y = 1; y <= horizonteSimulacion; y++) {
                        // Transformación Box-Muller para distribución normal aleatoria
                        let u1 = Math.random(), u2 = Math.random();
                        if(u1 === 0) u1 = 0.00001;
                        let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                        let rSim = rAnual + z0 * volReal;

                        if (!esRetiro) {
                            capMC = (capMC + (ahorroMes * 12)) * (1 + rSim);
                            // Límite de control superior asintótico Montecarlo
                            if (capMC > Number.MAX_SAFE_INTEGER) capMC = Number.MAX_SAFE_INTEGER;
                            
                            if (capMC >= targetFIRE) esRetiro = true;
                        } else {
                            let currentSwr = swrSeguro / 100;
                            // Algoritmo dinámico: Caída del mercado reduce SWR un 20% temporalmente
                            if (rSim < 0) {
                                currentSwr = currentSwr * 0.8;
                            }
                            let retiro = capMC * currentSwr;
                            capMC = (capMC - retiro) * (1 + rSim);
                        }

                        if (capMC <= 0) {
                            fracaso = true;
                            break;
                        }
                    }
                    if (!fracaso) exitos++;
                }

                let probabilidad = (exitos / iteraciones) * 100;
                elProbabilidad.innerText = `${probabilidad.toFixed(1)}%`;
                
                if (probabilidad >= 90) elProbabilidad.className = 'data-font texto-verde';
                else if (probabilidad >= 75) elProbabilidad.className = 'data-font texto-warning';
                else elProbabilidad.className = 'data-font texto-rojo';
            }

            const wrapChart = document.getElementById('wrap-fire-chart');
            if (wrapChart) {
                let canvas = wrapChart.querySelector('canvas');
                if (!canvas) {
                    wrapChart.innerHTML = '<canvas id="chartFIRE"></canvas>';
                    canvas = wrapChart.querySelector('canvas');
                }

                if (window.fireChartInstance) window.fireChartInstance.destroy();

                const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
                const c1 = getCSS('--color-up', '#00FF95');
                const c2 = getCSS('--color-purple', '#7C13A4'); 

                const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, c1.replace(')', ', 0.3)').replace('rgb', 'rgba'));
                gradient.addColorStop(1, 'rgba(0,0,0,0)');

                window.fireChartInstance = new Chart(canvas.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: lbl,
                        datasets: [
                            {
                                label: 'Capital Proyectado',
                                data: dataCapital,
                                borderColor: c1,
                                backgroundColor: gradient,
                                borderWidth: 3,
                                fill: true,
                                pointRadius: 0,
                                tension: 0.4
                            },
                            {
                                label: 'Objetivo FIRE',
                                data: dataObjetivo,
                                borderColor: c2,
                                borderDash: [6, 6],
                                borderWidth: 3,
                                fill: false,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { labels: { color: getCSS('--text-muted', '#8B95A5'), font: { weight: 'bold' } } } },
                        scales: {
                            x: { grid: { color: 'rgba(139, 149, 165, 0.05)' }, ticks: { color: getCSS('--text-muted', '#8B95A5'), font: { weight: 'bold' }, maxTicksLimit: 10 } },
                            y: { grid: { color: 'rgba(139, 149, 165, 0.05)' }, ticks: { color: getCSS('--text-muted', '#8B95A5'), font: { weight: 'bold' } } }
                        }
                    }
                });
            }
        });
    }}