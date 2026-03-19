"use strict";
import { api, priceStream } from './api.js';
import { model } from './model.js';
import { view } from './view.js';
import { storage } from './utils/storage.js';
import { backup } from './utils/backup.js';
import { events } from './utils/events.js';
import { UIMetrics } from './views/UIMetrics.js';
import { ChartRenderer } from './views/ChartRenderer.js';
import { FinancialMath } from './utils/financial.js';
import { PDFGenerator } from './utils/pdfGenerator.js';

const TabFSM = {
    state: 'dashboard',
    validTabs: ['dashboard', 'finanza-general', 'operar', 'portafolio', 'calendario', 'informes', 'historial', 'herramientas', 'ajustes', 'fire'],
    
    transition(newTab) {
        if (this.validTabs.includes(newTab) && this.state !== newTab) {
            this.state = newTab;
            events.emit('state:tabChanged', this.state);
            return true;
        }
        return false;
    }
};

const Logger = {
    isProduction: true,
    info: function(...args) { if (!this.isProduction) console.info(...args); },
    warn: function(...args) { if (!this.isProduction) console.warn(...args); },
    error: function(...args) { console.error(...args); } 
};

const controller = {
    state: { 
        filtroEvolucion: 'MAX',
        editingId: null,
        zenMode: false,
        vistaRentabilidadBruta: false
    },
    
    _isFetchingPrices: false,
    _subscriptions: [],

    _safeParse(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
        return parseFloat(str) || 0;
    },

    subscribeSafe(eventName, callback) {
        events.on(eventName, callback);
        this._subscriptions.push({ eventName, callback });
    },

    unsubscribeAll() {
        this._subscriptions.forEach(sub => {
            if (typeof events.off === 'function') {
                events.off(sub.eventName, sub.callback);
            }
        });
        this._subscriptions = [];
    },

    async comprobarBloqueo() {
        try {
            const pin = await storage.get('gestor_pin');
            if (pin) {
                events.emit('app:pinStatus', 'LOCKED');
            } else {
                events.emit('app:pinStatus', 'NO_PIN');
            }
        } catch (error) {
            Logger.warn("Error al verificar bóveda de seguridad. Omitiendo bloqueo.", error);
            events.emit('app:pinStatus', 'NO_PIN');
        }
    },

    async init() {
        try {
            document.body.classList.add('privacy-active');

            this.setupEventListeners();
            await this.comprobarBloqueo(); 
            
            try {
                view.initUI();
            } catch (uiError) {
                Logger.error("Fallo interceptado en InitUI (Ignorado para salvaguardar motor):", uiError);
            }

            try {
                await model.inicializar();
                
                if (model.data && model.data.movimientos) {
                    let modificados = false;
                    model.data.movimientos.forEach((m, idx) => {
                        if (m.id === undefined || m.id === null) {
                            m.id = Date.now() + idx;
                            modificados = true;
                        }
                    });
                    if (modificados) await model.guardarLocal();
                }
            } catch (modelError) {
                Logger.error("Fallo interceptado en el Modelo de Datos:", modelError);
                events.emit('app:toast', { msg: "Error al cargar la base de datos.", type: "error" });
            }

            events.emit('state:tabChanged', TabFSM.state);

            try {
                const dolarTask = api.fetchDolar();
                const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_API_DOLAR')), 3000));
                
                const dolarCache = await Promise.race([dolarTask, timeoutTask]).catch((err) => {
                    Logger.warn("API de Dólar inaccesible o en Timeout. Operando con caché local.", err);
                    return null;
                });

                if(dolarCache) model.setDolarBlue(dolarCache);
            } catch (networkError) {
                Logger.warn("Bloqueo general de Red interceptado.", networkError);
            }
            
            this.actualizarEstadoMercado();
            this.iniciarFetchPrecios();
            
        } catch (err) {
            Logger.error("Falla Crítica en el Arranque del Motor:", err);
            events.emit('app:toast', { msg: "Error fatal en el núcleo del sistema.", type: "error" });
            events.emit('state:tabChanged', 'dashboard'); 
        }
    },

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#btn-eliminar-categoria')) {
                const inputCat = document.getElementById('eco-categoria');
                const tipoActivo = document.getElementById('eco-tipo').value;
                const categoriaABorrar = inputCat?.value.trim();
                
                if(categoriaABorrar) {
                    events.emit('ui:borrar-categoria', { tipo: tipoActivo, categoria: categoriaABorrar });
                    inputCat.value = ""; 
                }
            }
        });

        this.subscribeSafe('ui:borrar-categoria', async (data) => {
            const success = await model.borrarCategoria(data.tipo, data.categoria);
            if(success) {
                events.emit('app:toast', { msg: `Categoría "${data.categoria}" eliminada`, type: "success" });
                view.adaptarFormularioEconomia(); 
            }
        });

        window.addEventListener('network:circuit-breaker', (e) => {
            if (e.detail.state === 'OPEN') {
                events.emit('app:toast', { msg: "Mercado Desconectado (Usando Caché Local)", type: "warning" });
                events.emit('app:marketStatus', false); 
            } else if (e.detail.state === 'CLOSED') {
                events.emit('app:toast', { msg: "Conexión a Mercado Restablecida", type: "success" });
                this.actualizarEstadoMercado();
            }
        });

        this.subscribeSafe('ui:cambiar-pestana', (tabId) => {
            TabFSM.transition(tabId);
            
            if(tabId === 'portafolio') {
                this.actualizarPreciosPortafolioDirecto();
            } else {
                priceStream.unsubscribeAll(); 
            }
            
            if(tabId === 'informes') this.actualizarSimuladorWhatIf();
        });

        const simVentasSlider = document.getElementById('sim-ventas');
        const simBolsaSlider = document.getElementById('sim-bolsa');
        if(simVentasSlider) simVentasSlider.addEventListener('input', () => this.actualizarSimuladorWhatIf());
        if(simBolsaSlider) simBolsaSlider.addEventListener('input', () => this.actualizarSimuladorWhatIf());

        this.subscribeSafe('model:updated', () => {
            UIMetrics.inyectarMetricasFase6(model.data);
            
            const uiState = model.data.uiState;
            
            events.emit('ui:actualizar-distribucion-gastos', { 
                contexto: 'Local', 
                temporalidad: uiState.gastosLocalTemporalidad || 'Mensual', 
                domId: 'wrap-gastos-local' 
            });
            events.emit('ui:actualizar-distribucion-gastos', { 
                contexto: 'Personal', 
                temporalidad: uiState.gastosPersonalTemporalidad || 'Mensual', 
                domId: 'wrap-gastos-personal' 
            });

            if(TabFSM.state === 'informes') this.actualizarSimuladorWhatIf();
            
            if (model.data && model.data.stats && view.actualizarRentabilidadFisica) {
                view.actualizarRentabilidadFisica(model.data.stats, this.state.vistaRentabilidadBruta);
            }
            
            if (model.data && model.data.stats && view.actualizarSankey) {
                view.actualizarSankey(model.data.stats, uiState.sankeyTemporalidad);
            }
        });

        this.subscribeSafe('ui:toggle-moneda', () => model.toggleMoneda());
        
        this.subscribeSafe('ui:toggle-zen', () => {
            this.state.zenMode = !this.state.zenMode;
            events.emit('app:zenMode', this.state.zenMode);
        });

        this.subscribeSafe('ui:set-filtro', (filtro) => {
            this.state.filtroEvolucion = filtro;
            events.emit('state:filtroChanged', filtro);
        });

        this.subscribeSafe('ui:guardar-operacion', (data) => this.guardarOperacion(data));
        this.subscribeSafe('ui:editar-operacion', (id) => this.prepararEdicion(id));
        this.subscribeSafe('ui:cancelar-edicion', () => this.limpiarModoEdicion());

        this.subscribeSafe('ui:deshacer-operacion', () => { model.deshacer(); events.emit('app:toast', { msg: "Operación deshecha", type: "success" }); });
        
        this.subscribeSafe('ui:borrar-operacion', (id) => { 
            model.borrarMovimiento(id); 
            events.emit('app:toast', { msg: "Registro eliminado", type: "success" }); 
        });

        this.subscribeSafe('ui:add-watchlist', (data) => {
            if(!data.activo || isNaN(data.precio) || data.precio<=0) return events.emit('app:toast', { msg:"Datos inválidos", type:"error" });
            model.agregarWatchlist(data.activo, data.precio);
            events.emit('app:toast', { msg:"Agregado a Seguimiento", type:"success" });
            if(TabFSM.state === 'portafolio') this.actualizarPreciosPortafolioDirecto();
        });

        this.subscribeSafe('ui:del-watchlist', (activo) => {
            model.borrarWatchlist(activo);
            events.emit('app:toast', { msg:"Eliminado de Seguimiento", type:"success" });
        });

        this.subscribeSafe('ui:filtrar-historial', (filtros) => { view.aplicarFiltrosHistorial(filtros); });

        this.subscribeSafe('ui:guardar-inflacion', (data) => {
            if(!data.mes || isNaN(data.val)) return events.emit('app:toast', { msg: "Datos inválidos (Use formato: 3.5)", type: "error" });
            model.guardarInflacion(data.mes, data.val);
            events.emit('app:toast', { msg: "Inflación guardada", type: "success" });
        });

        this.subscribeSafe('ui:borrar-inflacion', (mes) => {
            model.borrarInflacion(mes);
            events.emit('app:toast', { msg: "Inflación eliminada", type: "success" });
        });

        this.subscribeSafe('ui:importar-backup', (file) => {
            backup.importar(file, 
                (datos) => { 
                    model._data.movimientos = model.curarDatos(datos); 
                    model.guardarLocal(); 
                    model.procesarMotor();
                    events.emit('app:toast', { msg: "Backup Restaurado y Sincronizado", type: "success" }); 
                },
                () => events.emit('app:toast', { msg: "Archivo Inválido o Dañado", type: "error" })
            );
        });

        this.subscribeSafe('ui:exportar', () => backup.exportar(model.generarBackup())); 
        this.subscribeSafe('ui:borrar-todo', async () => { 
            await storage.clearAll(); 
            localStorage.clear(); 
            setTimeout(() => {
                location.reload(); 
            }, 300);
        });

        this.subscribeSafe('ui:guardar-manual', async () => {
            await model.guardarLocal();
            events.emit('app:toast', { msg: "Sincronización manual forzada", type: "success" }); 
        });

        this.subscribeSafe('ui:verificar-pin', async (pin) => {
            const storedPin = await storage.get('gestor_pin');
            if(pin === storedPin) {
                events.emit('app:pinStatus', 'UNLOCKED');
                events.emit('app:toast', { msg: "Bóveda Abierta", type: "success" });
            } else { 
                events.emit('app:pinStatus', 'ERROR'); 
                events.emit('app:toast', { msg: "PIN Incorrecto", type: "error" }); 
            }
        });

        this.subscribeSafe('ui:guardar-pin', async (pin) => {
            if(pin.length !== 4 || isNaN(pin)) return events.emit('app:toast', { msg: "Debe tener 4 números", type: "error" });
            await storage.set('gestor_pin', pin); 
            events.emit('app:toast', { msg: "Bóveda Cifrada Activada", type: "success" }); 
            await this.comprobarBloqueo();
        });

        this.subscribeSafe('ui:eliminar-pin', async (pinIngresado) => {
            const storedPin = await storage.get('gestor_pin');
            if(pinIngresado === storedPin) { 
                await storage.remove('gestor_pin'); 
                location.reload(); 
            } else { 
                events.emit('app:toast', { msg: "Credenciales Inválidas", type: "error" }); 
            }
        });

        this.subscribeSafe('ui:exportar-pdf', (filtros) => {
            try {
                events.emit('app:toast', { msg: "Generando Reporte Financiero PDF...", type: "success" });
                const datosFiltrados = model.getLibroMayorData(filtros);
                const statsGlobales = model.data.stats;
                if (typeof PDFGenerator !== 'undefined' && PDFGenerator.exportarLibroMayor) {
                    PDFGenerator.exportarLibroMayor(datosFiltrados, filtros, statsGlobales);
                } else {
                    events.emit('app:toast', { msg: "Módulo de Reportes no cargado en memoria", type: "error" });
                }
            } catch (e) {
                Logger.error("Error al compilar PDF:", e);
                events.emit('app:toast', { msg: "Error interno al compilar PDF", type: "error" });
            }
        });

        this.subscribeSafe('ui:cambio-temporalidad-sankey', (temporalidad) => {
            model.setTemporalidadUi('sankeyTemporalidad', temporalidad);
            if (model.data && model.data.stats && view.actualizarSankey) {
                view.actualizarSankey(model.data.stats, temporalidad);
            }
        });

        this.subscribeSafe('ui:cambio-temporalidad-gastos-local', (temporalidad) => {
            model.setTemporalidadUi('gastosLocalTemporalidad', temporalidad);
            events.emit('ui:actualizar-distribucion-gastos', { 
                contexto: 'Local', 
                temporalidad: temporalidad, 
                domId: 'wrap-gastos-local' 
            });
        });

        this.subscribeSafe('ui:cambio-temporalidad-gastos-personal', (temporalidad) => {
            model.setTemporalidadUi('gastosPersonalTemporalidad', temporalidad);
            events.emit('ui:actualizar-distribucion-gastos', { 
                contexto: 'Personal', 
                temporalidad: temporalidad, 
                domId: 'wrap-gastos-personal' 
            });
        });

        this.subscribeSafe('ui:actualizar-distribucion-gastos', (config) => {
            model.solicitarDistribucionGastos(config);
        });

        this.subscribeSafe('model:distributionCalculated', (data) => {
            const { payload, domId } = data;
            if (typeof ChartRenderer !== 'undefined' && ChartRenderer.renderDistribucionGastos) {
                ChartRenderer.renderDistribucionGastos(payload, domId);
            }
            
            UIMetrics.renderListaGastos(
                payload, 
                domId + '-lista', 
                model.data.vistaUSD ? model.data.dolarBlue : 1, 
                model.data.vistaUSD
            );
        });

        document.getElementById('eco-prestamo-id')?.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id && model.data.stats.prestamosDetalle && model.data.stats.prestamosDetalle[id]) {
                const p = model.data.stats.prestamosDetalle[id];
                const restante = p.totalDevolver - p.pagado;
                let cuotasRestantes = p.cuotasTotales - p.cuotasPagadas;
                if (cuotasRestantes <= 0) cuotasRestantes = 1; 
            
                const valorCuota = restante / cuotasRestantes;
                const ecoMonto = document.getElementById('eco-monto');
                if (ecoMonto) {
                    let partes = valorCuota.toFixed(2).split('.');
                    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    ecoMonto.value = partes.join(',');
                }
            } else {
                const ecoMonto = document.getElementById('eco-monto');
                if (ecoMonto) ecoMonto.value = '';
            }
        });
        
        document.getElementById('eco-tipo')?.addEventListener('change', (e) => {
            const tipo = e.target.value;
            const lblMonto = document.getElementById('lbl-monto-eco');
            const wrapMonto = document.getElementById('wrap-monto-eco');
            
            if (tipo === 'Alta Préstamo') {
                if (wrapMonto) wrapMonto.classList.add('is-hidden');
            } else {
                if (wrapMonto) wrapMonto.classList.remove('is-hidden');
                if (lblMonto) {
                    if (tipo === 'Ajuste Stock Inicial') {
                        lblMonto.innerText = 'Costo de la Mercadería a Sumar (ARS)';
                    } else if (tipo === 'Correccion Stock') {
                        lblMonto.innerText = 'Costo Contable EXACTO (Auditoría) (ARS)';
                    } else if (tipo === 'Reparto Sociedad') {
                        lblMonto.innerText = 'Monto Retirado por el Socio (ARS)';
                    } else {
                        lblMonto.innerText = tipo === 'Pago Préstamo' ? 'Valor de la Cuota a Pagar (ARS)' : 'Impacto Bruto del Movimiento (ARS)';
                    }
                }
            }
        });

        const btnRentNeta = document.getElementById('btn-rentabilidad-neta');
        const btnRentBruta = document.getElementById('btn-rentabilidad-bruta');
        
        if (btnRentNeta && btnRentBruta) {
            btnRentNeta.addEventListener('click', () => {
                this.state.vistaRentabilidadBruta = false;
                btnRentNeta.classList.add('active');
                btnRentBruta.classList.remove('active');
                if (model.data && model.data.stats && view.actualizarRentabilidadFisica) {
                    view.actualizarRentabilidadFisica(model.data.stats, this.state.vistaRentabilidadBruta);
                }
            });
            
            btnRentBruta.addEventListener('click', () => {
                this.state.vistaRentabilidadBruta = true;
                btnRentBruta.classList.add('active');
                btnRentNeta.classList.remove('active');
                if (model.data && model.data.stats && view.actualizarRentabilidadFisica) {
                    view.actualizarRentabilidadFisica(model.data.stats, this.state.vistaRentabilidadBruta);
                }
            });
        }
    },

    actualizarSimuladorWhatIf() {
        const s = model.data.stats;
        if (!s) return;

        const inVentas = document.getElementById('sim-ventas');
        const inBolsa = document.getElementById('sim-bolsa');
        const outVentas = document.getElementById('val-sim-ventas');
        const outBolsa = document.getElementById('val-sim-bolsa');
        const resObj = document.getElementById('res-sim-meses');

        if (!inVentas || !inBolsa || !resObj) return;

        let pctVentas = parseFloat(inVentas.value) / 100;
        let pctBolsa = parseFloat(inBolsa.value) / 100;

        outVentas.innerText = `-${(pctVentas * 100).toFixed(0)}%`;
        outBolsa.innerText = `-${(pctBolsa * 100).toFixed(0)}%`;

        let numMeses = s.numMesesOperativos || 1; 
        let ingresoOperativoMensual = s.ingresosLocal / numMeses;
        let egresoTotalMensual = (s.gastosLocal + (s.pagosProveedores || 0) + s.gastosFamiliar + (s.sociedadRetiros || 0)) / numMeses;

        let ingresoEstresado = ingresoOperativoMensual * (1 - pctVentas);
        let deficitMensualEstresado = egresoTotalMensual - ingresoEstresado;

        if (deficitMensualEstresado <= 0) {
            resObj.innerText = "Sustentable";
            resObj.className = "data-font texto-verde";
        } else {
            let liquidezBolsaEstresada = s.capInvertido * (1 - pctBolsa);
            let liquidezDefensivaTotal = s.billetera + s.cajaLocal + liquidezBolsaEstresada;
            
            let mesesSobrevida = liquidezDefensivaTotal / deficitMensualEstresado;
            
            resObj.innerText = `${mesesSobrevida.toFixed(1)} Meses`;
            resObj.className = `data-font ${mesesSobrevida > 6 ? 'texto-verde' : (mesesSobrevida > 3 ? 'texto-warning' : 'texto-rojo')}`;
        }
    },

    actualizarEstadoMercado() {
        // CORRECCIÓN MATEMÁTICA: Anclaje estricto al meridiano de Nueva York ignorando husos locales
        let nyTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
        let day = nyTime.getDay();
        let hours = nyTime.getHours();
        let minutes = nyTime.getMinutes();
        
        // Apertura 09:30 AM / Cierre 16:00 PM estricto
        let isOpen = (day >= 1 && day <= 5) && 
                     ((hours === 9 && minutes >= 30) || (hours > 9 && hours < 16));
        
        events.emit('app:marketStatus', isOpen);
    },

    prepararEdicion(id) {
        // Búsqueda robusta forzando comparación de cadenas.
        // Evita la pérdida de precisión IEEE-754 y fallos de coerción entre DOM String y Number del Modelo
        const mov = model.data.movimientos.find(m => String(m.id) === String(id));
        
        if(!mov) return events.emit('app:toast', { msg: "Error de lectura del registro en base de datos", type: "error" });
        
        this.state.editingId = mov.id;
        TabFSM.transition('operar');
        events.emit('ui:poblar-formulario-edicion', mov);
    },

    limpiarModoEdicion() {
        this.state.editingId = null;
        events.emit('ui:reset-form-operacion');
    },

    guardarOperacion(formData) {
        let isAltaPrestamo = formData.tipo === 'Alta Préstamo';
        
        // CORRECCIÓN: Captura desacomplada mediante DTO (Data Transfer Object)
        let capitalAdicional = isAltaPrestamo ? (formData.capital || 0) : 0;
        let montoOperacion = isAltaPrestamo && capitalAdicional > 0 ? capitalAdicional : formData.monto;

        if(!formData.fecha || isNaN(montoOperacion) || montoOperacion <= 0) { 
            return events.emit('app:toast', { msg: "Impacto monetario inválido o nulo", type: "error" });
        }
        
        let mov = { 
            id: this.state.editingId || crypto.randomUUID(),
            fecha: formData.fecha, 
            fechaMs: new Date(formData.fecha + "T00:00:00").getTime(),
            tipo: formData.tipo, 
            monto: montoOperacion 
        };

        if (formData.notas) mov.notas = formData.notas;

        if(['Compra','Venta','Dividendo'].includes(formData.tipo)) {
            if(!formData.activo) return events.emit('app:toast', { msg: "Identificador de activo (Ticker) ausente", type: "error" });
            mov.activo = formData.activo;
            
            if(formData.cant > 0) mov.cantidad = formData.cant;
            else if (formData.tipo !== 'Dividendo') return events.emit('app:toast', { msg: "El volumen de nominales debe ser superior a cero", type: "error" });

            mov.sector = formData.sector || 'No clasificado';
            
            if(formData.tipo === 'Venta' && !this.state.editingId) { 
                let holding = model.data.portafolio[formData.activo];
                if(!holding || holding.cant < formData.cant) return events.emit('app:toast', { msg: "Insuficiencia de nominales en la cartera activa", type: "error" });
            }
        } 
        else if(formData.tipo === 'Transferencia Ahorro' || formData.tipo === 'Ahorro' || formData.tipo === 'Rescate a Caja') { 
            if(formData.usd > 0) mov.usd = formData.usd;
            mov.contexto = 'Capital'; 
        }
        else if (['Gasto Local', 'Gasto Familiar'].includes(formData.tipo)) {
            mov.categoria = formData.categoria;
            model.guardarCategoria(formData.tipo, formData.categoria);
        } 
        else if (formData.tipo === 'Pago Proveedor') {
            mov.proveedor = formData.proveedor;
            if (formData.valorVentaEstimado && formData.valorVentaEstimado > 0) {
                mov.valorVentaEstimado = formData.valorVentaEstimado;
            }
            if (formData.estadoPago) {
                mov.estadoPago = formData.estadoPago;
            }
            model.guardarProveedor(formData.proveedor);
        } 
        else if (formData.tipo === 'Amortización Deuda a Proveedor') {
            if (!formData.deudaAsociadaId) {
                return events.emit('app:toast', { msg: "Vínculo a deuda pendiente requerido", type: "error" });
            }
            mov.deudaAsociadaId = formData.deudaAsociadaId;
            mov.proveedor = formData.proveedor;
        }
        else if (formData.tipo === 'Ajuste Stock Inicial') {
            if (formData.valorVentaEstimado && formData.valorVentaEstimado > 0) {
                mov.valorVentaEstimado = formData.valorVentaEstimado;
            }
        }
        else if (formData.tipo === 'Reparto Sociedad') {
            mov.socio = formData.proveedor;
            model.guardarProveedor(mov.socio, 'Socio');
        }
        else if (formData.tipo === 'Alta Préstamo') {
            mov.entidad = formData.entidad;
            mov.montoTotalDevolver = formData.montoTotalDevolver;
            mov.capital = montoOperacion;
            mov.cuotas = formData.cuotas || 1;

            if(!mov.entidad) return events.emit('app:toast', { msg: "Entidad emisora no definida", type: "error" });
            
            model.guardarProveedor(mov.entidad, 'Entidad Bancaria');
        } 
        else if (formData.tipo === 'Pago Préstamo') {
            mov.prestamoAsociado = formData.prestamoAsociado;
            if(!mov.prestamoAsociado) return events.emit('app:toast', { msg: "Vínculo a pasivo activo requerido", type: "error" });
        }
        
        if (this.state.editingId) {
            model.actualizarMovimiento(this.state.editingId, mov);
            events.emit('app:toast', { msg: "Transacción modificada con éxito", type: "success" });
            this.limpiarModoEdicion();
        } else {
            model.agregarMovimiento(mov);
            events.emit('app:toast', { msg: "Asiento contable consolidado", type: "success" });
            
            events.emit('ui:reset-form-operacion');
            if (['Gasto Local', 'Gasto Familiar', 'Ingreso Local'].includes(formData.tipo)) {
                events.emit('ui:restaurar-estado-formulario', {
                    tipo: formData.tipo,
                    categoria: formData.categoria || ''
                });
            }

            if (['Compra', 'Dividendo', 'Ahorro'].includes(formData.tipo)) {
                setTimeout(() => { this.actualizarPreciosPortafolioDirecto(); }, 800);
            }
        }
        
        // Limpieza de inputs residuales en DOM
        let capInput = document.getElementById('eco-prestamo-capital');
        if (capInput) capInput.value = '';
        const cuoInput = document.getElementById('eco-prestamo-cuotas');
        if (cuoInput) cuoInput.value = '1';
    },

    iniciarFetchPrecios() { 
        if(TabFSM.state === 'portafolio') {
            this.actualizarPreciosPortafolioDirecto();
        }
    },

    async actualizarPreciosPortafolioDirecto() {
        // LOCK ESTRICTO: Previene el bombardeo a la API si el usuario cambia pestañas frenéticamente
        if (this._isFetchingPrices) return;
        this._isFetchingPrices = true;

        // CORRECCIÓN: Controlador de anulación de peticiones para evitar Memory/Network Leaks
        const abortController = new AbortController();

        try {
            const portafolio = model.data.portafolio;
            const watch = model.data.watchlist || [];
            let activos = Object.keys(portafolio).filter(a => portafolio[a].cant > 0.0001);
            watch.forEach(w => { if(!activos.includes(w.activo)) activos.push(w.activo); });
            
            priceStream.unsubscribeAll(); 
            activos.forEach(ticker => {
                priceStream.subscribe(ticker, (t, result) => {
                    if (result) {
                        let nuevosPrecios = { [t]: { data: result, time: Date.now() } };
                        model.actualizarPreciosPortafolio(nuevosPrecios);
                    }
                });
            });

            // CORRECCIÓN: Inyección de la señal de anulación en el bucle de peticiones
            const fetchTask = (async () => {
                let nuevosPrecios = {};
                for (const ticker of activos) {
                    if (abortController.signal.aborted) break; // Detención estructural inmediata
                    
                    // Nota arquitectónica: Idealmente, api.fetchPrecioUnico debería recibir abortController.signal como 3er parámetro
                    let apiData = await api.fetchPrecioUnico(ticker, model.data.cachePrecios);
                    if (apiData) nuevosPrecios[ticker] = { data: apiData, time: Date.now() };
                }
                return nuevosPrecios;
            })();

            const timeoutTask = new Promise((_, reject) => setTimeout(() => {
                abortController.abort(); // Detonador de aniquilación del hilo de red
                reject(new Error('TIMEOUT_SEGURIDAD_API'));
            }, 15000));

            let nuevosPrecios = await Promise.race([fetchTask, timeoutTask]);

            if(Object.keys(nuevosPrecios).length > 0) {
                model.actualizarPreciosPortafolio(nuevosPrecios);
            }
        } catch (error) {
            if (error.message === 'TIMEOUT_SEGURIDAD_API') {
                console.warn("[Controlador] Ejecutado Watchdog de seguridad (Timeout) en fetch de precios. Hilos secundarios abortados.");
            } else {
                console.error("[Controlador] Fallo en la cascada de fetch de precios:", error);
            }
        } finally {
            this._isFetchingPrices = false;
        }
    },
};

window.addEventListener('DOMContentLoaded', () => controller.init());