"use strict";
import { storage } from './utils/storage.js';
import { events } from './utils/events.js';
import { CommandManager, AddMovementCommand } from './utils/CommandManager.js';
import { MigrationManager } from './utils/MigrationManager.js';
import { FinancialMath } from './utils/financial.js';

const reactiveProxyHandler = {
    set(target, property, value, receiver) {
        const result = Reflect.set(target, property, value, receiver);
        
        if (model._proxyDebounce) clearTimeout(model._proxyDebounce);
        model._proxyDebounce = setTimeout(() => {
            events.emit('model:updated', model.data);
        }, 10);
        
        return result;
    }
};

export const model = {
    _rawData: { 
        movimientos: [], 
        watchlist: [], 
        proveedores: [],
        categorias: {},
        dolarBlue: 1000, 
        vistaUSD: false, 
        portafolio: {}, 
        stats: {},
        uiState: {
            sankeyTemporalidad: 'Histórico',
            gastosLocalTemporalidad: 'Histórico',
            gastosPersonalTemporalidad: 'Histórico'
        }
    },
    _data: null, 
    cachePrecios: {},
    inflacionINDEC: {}, 
    cmdManager: new CommandManager(),
    worker: null,
    _engineResolver: null,
    _proxyDebounce: null,
    
    _lastFormState: {
        contexto: 'Local',
        categoria: ''
    },

    get data() {
        const clone = structuredClone(this._rawData);
        clone.inflacion = structuredClone(this.inflacionINDEC);
        clone.cachePrecios = structuredClone(this.cachePrecios);
        return Object.freeze(clone); 
    },

    generarBackup() {
        return {
            version: 9,
            movimientos: this._rawData.movimientos,
            inflacionINDEC: this.inflacionINDEC
        };
    },

    async inicializar() {
        this._data = new Proxy(this._rawData, reactiveProxyHandler);

        this.cachePrecios = await storage.get('gfp_precios_cache') || {};
        
        const inflacionGuardada = await storage.get('gfp_inflacion');
        if (inflacionGuardada) this.inflacionINDEC = inflacionGuardada;
        
        const watch = await storage.get('gfp_watchlist');
        if(watch) this._data.watchlist = watch;

        const provs = await storage.get('gfp_proveedores');
        if(provs) this._data.proveedores = provs;
        
        const cats = await storage.get('gfp_categorias');
        if(cats) {
            let migratedCats = { Local: [], Personal: [] };
            
            if (cats['Operativo Local']) migratedCats.Local = cats['Operativo Local'];
            else if (cats['Local']) migratedCats.Local = cats['Local'];
            
            if (cats['Economía Personal']) migratedCats.Personal = cats['Economía Personal'];
            else if (cats['Personal']) migratedCats.Personal = cats['Personal'];

            const idx = migratedCats.Local.indexOf('Proveedores');
            if (idx !== -1) migratedCats.Local[idx] = 'Insumos Menores';

            this._data.categorias = migratedCats;
        } else {
            this._data.categorias = {
                'Local': [
                    "Alquiler de Inmueble", 
                    "Impuestos y Tasas", 
                    "Servicios Básicos (Luz, Agua, Internet)",
                    "Mantenimiento y Reparaciones", 
                    "Suministros Operativos", 
                    "Marketing y Publicidad",
                    "Gastos y Comisiones Financieras", 
                    "Logística y Distribución", 
                    "Seguros Corporativos",
                    "Otros Gastos Operativos"
                ],
                'Personal': [
                    "Vivienda y Servicios Habitacionales", 
                    "Alimentación y Supermercado", 
                    "Transporte y Movilidad",
                    "Salud y Bienestar", 
                    "Educación y Capacitación", 
                    "Entretenimiento y Ocio",
                    "Indumentaria y Calzado", 
                    "Seguros Personales", 
                    "Suscripciones y Membresías",
                    "Otros Gastos Personales"
                ]
            };
            await storage.set('gfp_categorias', this._rawData.categorias);
        }

        this._data.movimientos = await MigrationManager.runMigrations();
        
        this.initWorker();
        await this.procesarMotor(false);
    },

    initWorker() {
        if(this.worker) this.worker.terminate();
        
        this.worker = new Worker('js/worker.js', { type: 'module' });
        
        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            
            if (type === 'ENGINE_RESULT') {
                // Auditoría Comercial Correctiva antes de inyectar al estado global
                const auditoria = FinancialMath.calcularAuditoriaComercial(payload.movimientosOrdenados);
                payload.stats.ingresosNetosAuditoria = auditoria.ingresosBrutosNetos;
                payload.stats.inventarioBaseCorregido = auditoria.inventarioBaseCosto;

                this._data.stats = payload.stats;
                this._data.portafolio = payload.portafolio;
                this._data.movimientos = payload.movimientosOrdenados;
                
                if (this._engineResolver) {
                    this._engineResolver();
                    this._engineResolver = null;
                }
            } else if (type === 'WATCHLIST_RESULT') {
                events.emit('model:watchlistUpdated', payload);
            }
        };

        this.worker.onerror = (err) => {
            console.error("Error en Web Worker:", err);
            if(this._engineResolver) this._engineResolver(err);
        };
    },

    curarDatos(datosCrudos) {
        let arrayMovimientos = Array.isArray(datosCrudos) ? datosCrudos : (datosCrudos.movimientos || []);
        
        if (datosCrudos && !Array.isArray(datosCrudos) && datosCrudos.inflacionINDEC) {
            this.inflacionINDEC = datosCrudos.inflacionINDEC;
            storage.set('gfp_inflacion', this.inflacionINDEC).then(() => {
                events.emit('model:inflacionUpdated', this.inflacionINDEC);
            });
        }

        if (!Array.isArray(arrayMovimientos)) return [];
        return arrayMovimientos.map(item => {
            let mov = { ...item };
            if (!mov.id) mov.id = Date.now() + Math.random();
            if (!mov.fecha) mov.fecha = new Date().toISOString().split('T')[0];
            if (!mov.tipo) mov.tipo = 'Ahorro';
            if (isNaN(mov.monto)) mov.monto = 0;
            if (mov.activo) mov.activo = mov.activo.toString().trim().toUpperCase();
            if (mov.tipo === 'Compra' && !mov.sector) mov.sector = 'Otro';
            if (mov.tipo === 'Pago Proveedor' && !mov.estadoPago) mov.estadoPago = 'Pagado';
            if (mov.deudaAsociadaId === undefined) mov.deudaAsociadaId = null;
            return mov;
        });
    },

    async guardarLocal() { 
        await storage.set('gestor_pro_v9', this._rawData.movimientos);
    },

    async guardarProveedor(nombre, categoriaAsociada = 'General') {
        const nombreLimpio = nombre.trim();
        const existe = this._rawData.proveedores.find(p => p.nombre.toLowerCase() === nombreLimpio.toLowerCase());
        if(!existe) {
            const provsActualizados = [...this._rawData.proveedores, { nombre: nombreLimpio, categoria: categoriaAsociada }];
            this._data.proveedores = provsActualizados; 
            await storage.set('gfp_proveedores', this._rawData.proveedores);
        }
    },
    
    async guardarCategoria(contexto, nombreCategoria) {
        if (!nombreCategoria || typeof nombreCategoria !== 'string') return;
        const nombreLimpio = nombreCategoria.trim();
        if (!nombreLimpio) return;

        let ctx = contexto;
        if (contexto === 'Gasto Local') ctx = 'Local';
        if (contexto === 'Gasto Familiar' || contexto === 'Gasto Personal') ctx = 'Personal';

        if (!this._rawData.categorias[ctx]) {
            this._rawData.categorias[ctx] = [];
        }

        const existe = this._rawData.categorias[ctx].find(c => c.toLowerCase() === nombreLimpio.toLowerCase());
        
        if (!existe) {
            const nuevasCat = [...this._rawData.categorias[ctx], nombreLimpio];
            this._data.categorias = { ...this._rawData.categorias, [ctx]: nuevasCat };
            await storage.set('gfp_categorias', this._rawData.categorias.categorias);
        }
    },
    
    async agregarWatchlist(activo, precio) {
        activo = activo.trim().toUpperCase();
        let existe = this._rawData.watchlist.find(w => w.activo === activo);
        let nuevaWatchlist = [...this._rawData.watchlist];
        
        if(!existe) {
            nuevaWatchlist.push({ activo, precioObjetivo: precio });
        } else {
            let idx = nuevaWatchlist.findIndex(w => w.activo === activo);
            nuevaWatchlist[idx] = { ...nuevaWatchlist[idx], precioObjetivo: precio };
        }
        
        this._data.watchlist = nuevaWatchlist;
        await storage.set('gfp_watchlist', this._rawData.watchlist);
        this.worker.postMessage({ type: 'PROCESS_WATCHLIST', watchlist: this._rawData.watchlist, precios: this.cachePrecios });
    },
    
    async borrarWatchlist(activo) {
        this._data.watchlist = this._rawData.watchlist.filter(w => w.activo !== activo);
        await storage.set('gfp_watchlist', this._rawData.watchlist);
        this.worker.postMessage({ type: 'PROCESS_WATCHLIST', watchlist: this._rawData.watchlist, precios: this.cachePrecios });
    },

    async guardarInflacion(mes, valor) {
        const nuevaInflacion = { ...this.inflacionINDEC, [mes]: valor };
        this.inflacionINDEC = nuevaInflacion;
        await storage.set('gfp_inflacion', this.inflacionINDEC);
        events.emit('model:inflacionUpdated', this.inflacionINDEC);
        this.procesarMotor(false);
    },

    async borrarInflacion(mes) {
        const nuevaInflacion = { ...this.inflacionINDEC };
        delete nuevaInflacion[mes];
        this.inflacionINDEC = nuevaInflacion;
        await storage.set('gfp_inflacion', this.inflacionINDEC);
        events.emit('model:inflacionUpdated', this.inflacionINDEC);
        this.procesarMotor(false); 
    },

    setDolarBlue(precio) {
        this._data.dolarBlue = precio;
    },

    toggleMoneda() {
        this._data.vistaUSD = !this._rawData.vistaUSD;
    },

    setTemporalidadUi(seccion, valor) {
        this._data.uiState = { ...this._rawData.uiState, [seccion]: valor };
    },

    async actualizarPreciosPortafolio(nuevosPrecios) {
        this.cachePrecios = { ...this.cachePrecios, ...nuevosPrecios };
        await storage.set('gfp_precios_cache', this.cachePrecios);
        events.emit('model:preciosUpdated', this.cachePrecios);
        this.worker.postMessage({ type: 'PROCESS_WATCHLIST', watchlist: this._rawData.watchlist, precios: this.cachePrecios });
    },

    async procesarMotor(isDelta = false, mov = null) {
        return new Promise((resolve) => {
            this._engineResolver = resolve;
            
            if (isDelta && mov) {
                this.worker.postMessage({ 
                    type: 'ADD_DELTA', 
                    movimiento: structuredClone(mov),
                    inflacionINDEC: structuredClone(this.inflacionINDEC) 
                });
            } else {
                this.worker.postMessage({ 
                    type: 'FULL_PROCESS', 
                    movimientos: structuredClone(this._rawData.movimientos),
                    inflacionINDEC: structuredClone(this.inflacionINDEC) 
                });
            }
        });
    },

    setLastExpenseState(contexto, categoria) {
        this._lastFormState = { contexto, categoria };
    },

    getLastExpenseState() {
        return this._lastFormState;
    },

    getLibroMayorData(filtros = { temporalidad: 'Histórico', tipo: 'Todos' }) {
        let movimientosBase = [...this._rawData.movimientos];

        if (filtros.tipo && filtros.tipo !== 'Todos') {
            if (filtros.tipo === 'Gasto Local' || filtros.tipo === 'Gasto Personal') {
                const contextoBuscado = filtros.tipo === 'Gasto Local' ? 'Local' : 'Personal';
                movimientosBase = movimientosBase.filter(m => m.tipo === 'Gasto' && m.contexto === contextoBuscado);
            } else {
                movimientosBase = movimientosBase.filter(m => m.tipo === filtros.tipo);
            }
        }

        movimientosBase = FinancialMath.filtrarPorTemporalidad(movimientosBase, filtros.temporalidad);
        movimientosBase.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return movimientosBase;
    },

    getMovimiento(id) {
        return this._rawData.movimientos.find(m => m.id === parseInt(id));
    },

    async agregarMovimiento(mov) {
        if (mov.tipo === 'Gasto') {
            this.setLastExpenseState(mov.contexto || 'Local', mov.categoria || '');
        }

        const command = new AddMovementCommand(this, mov);
        this.cmdManager.execute(command);
    },

    async actualizarMovimiento(id, datosActualizados) {
        const index = this._rawData.movimientos.findIndex(m => m.id === parseInt(id));
        if (index !== -1) {
            let nuevosMovs = [...this._rawData.movimientos];
            nuevosMovs[index] = { ...nuevosMovs[index], ...datosActualizados, id: parseInt(id) };
            this._data.movimientos = nuevosMovs;
            await this.guardarLocal();
            await this.procesarMotor(false); 
        }
    },

    deshacer() {
        this.cmdManager.undo();
    },

    async _addMovimientoSilencioso(mov) {
        let nuevosMovs = [...this._rawData.movimientos, mov];
        this._data.movimientos = nuevosMovs;
        await this.guardarLocal();
        await this.procesarMotor(true, mov);
    },

    async _removeMovimientoSilencioso(id) {
        let nuevosMovs = this._rawData.movimientos.filter(m => m.id !== id);
        this._data.movimientos = nuevosMovs;
        await this.guardarLocal();
        await this.procesarMotor(false);
    },

    borrarMovimiento(id) { 
        this._removeMovimientoSilencioso(parseInt(id));
    }
};