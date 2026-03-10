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

const controller = {
    state: { 
        filtroEvolucion: 'MAX',
        editingId: null,
        zenMode: false,
        vistaRentabilidadBruta: false
    },

    async init() {
        document.body.classList.add('privacy-active');

        this.setupEventListeners();
        await this.comprobarBloqueo(); 
        view.initUI();

        const [dolarCache] = await Promise.all([
            api.fetchDolar(),
            model.inicializar()
        ]);

        this.actualizarEstadoMercado();
        if(dolarCache) model.setDolarBlue(dolarCache);
        
        events.emit('state:tabChanged', TabFSM.state);
        this.iniciarFetchPrecios();
    },

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.id === 'btn-eliminar-categoria') {
                const inputCat = document.getElementById('eco-categoria');
                const tipoActivo = document.getElementById('eco-tipo').value;
                const categoriaABorrar = inputCat.value.trim();
                
                if(categoriaABorrar !== "") {
                    // Emitimos al modelo para depurar el estado global
                    events.emit('ui:borrar-categoria', { tipo: tipoActivo, categoria: categoriaABorrar });
                    inputCat.value = ""; // Limpiamos el UI
                }
            }
        });

        // Manejador del evento
        events.on('ui:borrar-categoria', async (data) => {
            let ctx = data.tipo === 'Gasto Local' ? 'Local' : 'Personal';
            if (model.data.categorias[ctx]) {
                const index = model._rawData.categorias[ctx].findIndex(c => c.toLowerCase() === data.categoria.toLowerCase());
                if(index > -1) {
                    model._rawData.categorias[ctx].splice(index, 1);
                    model._data.categorias = { ...model._rawData.categorias.categorias };
                    await storage.set('gfp_categorias', model._rawData.categorias);
                    events.emit('app:toast', { msg: `Categoría "${data.categoria}" eliminada`, type: "success" });
                    view.adaptarFormularioEconomia(); // Recargamos el form
                }
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

        events.on('ui:cambiar-pestana', (tabId) => {
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

        events.on('model:updated', () => {
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

        events.on('ui:toggle-moneda', () => model.toggleMoneda());
        
        events.on('ui:toggle-zen', () => {
            this.state.zenMode = !this.state.zenMode;
            events.emit('app:zenMode', this.state.zenMode);
        });

        events.on('ui:set-filtro', (filtro) => {
            this.state.filtroEvolucion = filtro;
            events.emit('state:filtroChanged', filtro);
        });

        events.on('ui:guardar-operacion', (data) => this.guardarOperacion(data));
        events.on('ui:editar-operacion', (id) => this.prepararEdicion(id));
        events.on('ui:cancelar-edicion', () => this.limpiarModoEdicion());

        events.on('ui:deshacer-operacion', () => { model.deshacer(); events.emit('app:toast', { msg: "Operación deshecha", type: "success" }); });
        events.on('ui:borrar-operacion', (id) => { model.borrarMovimiento(parseInt(id)); events.emit('app:toast', { msg: "Registro eliminado", type: "success" }); });

        events.on('ui:add-watchlist', (data) => {
            if(!data.activo || isNaN(data.precio) || data.precio<=0) return events.emit('app:toast', { msg:"Datos inválidos", type:"error" });
            model.agregarWatchlist(data.activo, data.precio);
            events.emit('app:toast', { msg:"Agregado a Seguimiento", type:"success" });
            if(TabFSM.state === 'portafolio') this.actualizarPreciosPortafolioDirecto();
        });

        events.on('ui:del-watchlist', (activo) => {
            model.borrarWatchlist(activo);
            events.emit('app:toast', { msg:"Eliminado de Seguimiento", type:"success" });
        });

        events.on('ui:filtrar-historial', (filtros) => { view.aplicarFiltrosHistorial(filtros); });

        events.on('ui:guardar-inflacion', (data) => {
            if(!data.mes || isNaN(data.val)) return events.emit('app:toast', { msg: "Datos inválidos (Use formato: 3.5)", type: "error" });
            model.guardarInflacion(data.mes, data.val);
            events.emit('app:toast', { msg: "Inflación guardada", type: "success" });
        });

        events.on('ui:borrar-inflacion', (mes) => {
            model.borrarInflacion(mes);
            events.emit('app:toast', { msg: "Inflación eliminada", type: "success" });
        });

        events.on('ui:importar-backup', (file) => {
            backup.importar(file, 
                (datos) => { 
                    model._data.movimientos = model.curarDatos(datos); 
                    model.guardarLocal(); 
                    model.procesarMotor();
                    events.emit('app:toast', { msg: "Backup Restaurado", type: "success" }); 
                },
                () => events.emit('app:toast', { msg: "Archivo Inválido", type: "error" })
            );
        });

        events.on('ui:exportar', () => backup.exportar(model.data.movimientos));
        events.on('ui:borrar-todo', () => { storage.clearAll(); location.reload(); });

        events.on('ui:guardar-manual', async () => {
            await model.guardarLocal();
            events.emit('app:toast', { msg: "Cambios guardados correctamente", type: "success" }); 
        });

        events.on('ui:verificar-pin', async (pin) => {
            const storedPin = await storage.get('gestor_pin');
            if(pin === storedPin) {
                events.emit('app:pinStatus', 'UNLOCKED');
                events.emit('app:toast', { msg: "Bóveda Abierta", type: "success" });
            } else { 
                events.emit('app:pinStatus', 'ERROR'); 
                events.emit('app:toast', { msg: "PIN Incorrecto", type: "error" }); 
            }
        });

        events.on('ui:guardar-pin', async (pin) => {
            if(pin.length !== 4 || isNaN(pin)) return events.emit('app:toast', { msg: "Debe tener 4 números", type: "error" });
            await storage.set('gestor_pin', pin); 
            events.emit('app:toast', { msg: "Bóveda Activada", type: "success" }); 
            await this.comprobarBloqueo();
        });

        events.on('ui:eliminar-pin', async (pinIngresado) => {
            const storedPin = await storage.get('gestor_pin');
            if(pinIngresado === storedPin) { 
                await storage.remove('gestor_pin'); 
                location.reload(); 
            } else { 
                events.emit('app:toast', { msg: "PIN Incorrecto", type: "error" }); 
            }
        });

        events.on('ui:exportar-pdf', (filtros) => {
            try {
                events.emit('app:toast', { msg: "Generando Reporte Financiero PDF...", type: "success" });
                const datosFiltrados = model.getLibroMayorData(filtros);
                const statsGlobales = model.data.stats;
                if (typeof PDFGenerator !== 'undefined' && PDFGenerator.exportarLibroMayor) {
                    PDFGenerator.exportarLibroMayor(datosFiltrados, filtros, statsGlobales);
                } else {
                    events.emit('app:toast', { msg: "Módulo de Reportes no disponible aún", type: "error" });
                }
            } catch (e) {
                console.error(e);
                events.emit('app:toast', { msg: "Error interno al compilar PDF", type: "error" });
            }
        });

        // Eventos para Cambio de Temporalidad Modular
        events.on('ui:cambio-temporalidad-sankey', (temporalidad) => {
            model.setTemporalidadUi('sankeyTemporalidad', temporalidad);
            if (model.data && model.data.stats && view.actualizarSankey) {
                view.actualizarSankey(model.data.stats, temporalidad);
            }
        });

        events.on('ui:cambio-temporalidad-gastos-local', (temporalidad) => {
            model.setTemporalidadUi('gastosLocalTemporalidad', temporalidad);
            events.emit('ui:actualizar-distribucion-gastos', { 
                contexto: 'Local', 
                temporalidad: temporalidad, 
                domId: 'wrap-gastos-local' 
            });
        });

        events.on('ui:cambio-temporalidad-gastos-personal', (temporalidad) => {
            model.setTemporalidadUi('gastosPersonalTemporalidad', temporalidad);
            events.emit('ui:actualizar-distribucion-gastos', { 
                contexto: 'Personal', 
                temporalidad: temporalidad, 
                domId: 'wrap-gastos-personal' 
            });
        });

        events.on('ui:actualizar-distribucion-gastos', (config) => {
            const datosGenerados = FinancialMath.calcularDistribucionGastos(
                model._rawData.movimientos, 
                config.contexto, 
                config.temporalidad
            );
            
            if (typeof ChartRenderer !== 'undefined' && ChartRenderer.renderDistribucionGastos) {
                ChartRenderer.renderDistribucionGastos(datosGenerados, config.domId);
            }
            
            UIMetrics.renderListaGastos(
                datosGenerados, 
                config.domId + '-lista', 
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
        let now = new Date();
        let estHours = now.getUTCHours() - 5; 
        let isOpen = (now.getDay() >= 1 && now.getDay() <= 5 && estHours >= 9 && estHours < 16);
        events.emit('app:marketStatus', isOpen);
    },

    prepararEdicion(id) {
        const mov = model.getMovimiento(id);
        if(!mov) return events.emit('app:toast', { msg: "Error al cargar registro", type: "error" });
        
        this.state.editingId = id;
        TabFSM.transition('operar');
        events.emit('ui:poblar-formulario-edicion', mov);
    },

    limpiarModoEdicion() {
        this.state.editingId = null;
        events.emit('ui:reset-form-operacion');
    },

    guardarOperacion(formData) {
        let isAltaPrestamo = formData.tipo === 'Alta Préstamo';
        let capInput = document.getElementById('eco-prestamo-capital');
        let capitalAdicional = capInput && capInput.value ? parseFloat(capInput.value.replace(/\./g, '').replace(',', '.')) : 0;
        
        let montoOperacion = isAltaPrestamo && capitalAdicional > 0 ? capitalAdicional : formData.monto;

        if(!formData.fecha || isNaN(montoOperacion) || montoOperacion <= 0) { 
            return events.emit('app:toast', { msg: "Monto inválido o cero", type: "error" });
        }
        
        let mov = { 
            fecha: formData.fecha, 
            fechaMs: new Date(formData.fecha + "T00:00:00").getTime(),
            tipo: formData.tipo, 
            monto: montoOperacion 
        };

        if (formData.notas) mov.notas = formData.notas;

        if(['Compra','Venta','Dividendo'].includes(formData.tipo)) {
            if(!formData.activo) return events.emit('app:toast', { msg: "Debe proveer un identificador de activo (Ticker)", type: "error" });
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
                return events.emit('app:toast', { msg: "Debe seleccionar la deuda a amortizar", type: "error" });
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
        }
        else if (formData.tipo === 'Alta Préstamo') {
            mov.entidad = formData.entidad;
            mov.montoTotalDevolver = formData.montoTotalDevolver;
            
            let cuotasInput = document.getElementById('eco-prestamo-cuotas');
            mov.capital = montoOperacion;
            mov.cuotas = cuotasInput && cuotasInput.value ? parseInt(cuotasInput.value) : 1;

            if(!mov.entidad) return events.emit('app:toast', { msg: "Falta el nombre de la entidad", type: "error" });
        } 
        else if (formData.tipo === 'Pago Préstamo') {
            mov.prestamoAsociado = formData.prestamoAsociado;
            if(!mov.prestamoAsociado) return events.emit('app:toast', { msg: "Seleccione una deuda activa", type: "error" });
        }
        
        if (this.state.editingId) {
            model.actualizarMovimiento(this.state.editingId, mov);
            events.emit('app:toast', { msg: "Registro actualizado exitosamente", type: "success" });
            this.limpiarModoEdicion();
        } else {
            mov.id = Date.now(); 
            model.agregarMovimiento(mov);
            events.emit('app:toast', { msg: "Operación registrada", type: "success" });
            
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
        
        if (capInput) capInput.value = '';
        const cuoInput = document.getElementById('eco-prestamo-cuotas');
        if (cuoInput) cuoInput.value = '1';
        }
        
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

        let nuevosPrecios = {};
        for (const ticker of activos) {
            let apiData = await api.fetchPrecioUnico(ticker, model.cachePrecios);
            if (apiData) nuevosPrecios[ticker] = { data: apiData, time: Date.now() };
        }
        if(Object.keys(nuevosPrecios).length > 0) model.actualizarPreciosPortafolio(nuevosPrecios);
    },

    async comprobarBloqueo() {
        const pin = await storage.get('gestor_pin');
        if(pin) events.emit('app:pinStatus', 'LOCKED');
        else events.emit('app:pinStatus', 'NO_PIN');
    }
};

window.addEventListener('DOMContentLoaded', () => controller.init());