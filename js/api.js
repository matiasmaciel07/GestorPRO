"use strict";
import { AppError, ErrorHandler } from './utils/ErrorHandler.js';

const ENDPOINTS = {
    DOLAR_BLUE: 'https://dolarapi.com/v1/dolares/blue',
    YAHOO_FINANCE: (ticker) => `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=200d&interval=1d`,
    BINANCE: (symbol) => `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=200`,
    FCI_ARGENTINA: 'https://api.argentinadatos.com/v1/finanzas/fci/cafci/valores',
    PROXY: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
};

class CircuitBreaker {
    constructor(failureThreshold = 3, resetTimeout = 60000) {
        this.state = 'CLOSED'; 
        this.failures = 0;
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
        this.nextAttempt = null;
    }

    recordSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.failures = 0;
            this.notifyStateChange();
        } else {
            this.failures = 0;
        }
    }

    recordFailure() {
        this.failures++;
        if (this.state === 'CLOSED' && this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            this.notifyStateChange();
        } else if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            this.notifyStateChange();
        }
    }

    canRequest() {
        if (this.state === 'CLOSED') return true;
        if (this.state === 'OPEN') {
            if (Date.now() >= this.nextAttempt) {
                this.state = 'HALF_OPEN';
                this.notifyStateChange();
                return true;
            }
            return false; 
        }
        return true; 
    }

    notifyStateChange() {
        window.dispatchEvent(new CustomEvent('network:circuit-breaker', { detail: { state: this.state } }));
    }
}

class APIManager {
    constructor() {
        if (APIManager.instance) return APIManager.instance;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitDelay = 350; 
        this.abortControllers = new Map();
        this.hardTimeoutMs = 15000; // Timeout de 15 segundos para evitar peticiones zombie
        
        this.circuitBreaker = new CircuitBreaker();
        APIManager.instance = this;
    }

    async fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
        if (!this.circuitBreaker.canRequest()) {
            throw new Error('CIRCUIT_OPEN');
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 429 && retries > 0) {
                    await this.sleep(backoff);
                    return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                throw new Error(`HTTP Status: ${response.status}`);
            }
            
            this.circuitBreaker.recordSuccess();
            return await response.json();
            
        } catch (error) {
            if (error.name !== 'AbortError' && error.message !== 'HARD_TIMEOUT') {
                this.circuitBreaker.recordFailure();
            }
            
            if (retries > 0 && error.name !== 'AbortError' && error.message !== 'HARD_TIMEOUT' && this.circuitBreaker.state !== 'OPEN') {
                await this.sleep(backoff);
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw error;
        }
    }

    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    enqueueRequest(url, options = {}, key) {
        return new Promise((resolve, reject) => {
            if (!this.circuitBreaker.canRequest()) {
                return reject(new Error('CIRCUIT_OPEN'));
            }
            this.requestQueue.push({ url, options, key, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const batch = this.requestQueue.splice(0, 3);
            await Promise.all(batch.map(async (req) => {
                if (req.key && this.abortControllers.has(req.key)) {
                    this.abortControllers.get(req.key).abort();
                }
                
                const controller = new AbortController();
                if (req.key) this.abortControllers.set(req.key, controller);
                req.options.signal = controller.signal;

                // Watchdog de seguridad contra conexiones colgadas
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    req.reject(new Error('HARD_TIMEOUT'));
                }, this.hardTimeoutMs);

                try {
                    const data = await this.fetchWithRetry(req.url, req.options);
                    clearTimeout(timeoutId);
                    req.resolve(data);
                } catch (error) {
                    clearTimeout(timeoutId);
                    req.reject(error);
                } finally {
                    if (req.key) this.abortControllers.delete(req.key);
                }
            }));
            if (this.requestQueue.length > 0) await this.sleep(this.rateLimitDelay);
        }
        this.isProcessingQueue = false;
    }

    async fetchDolar() {
        try { 
            const json = await this.enqueueRequest(ENDPOINTS.DOLAR_BLUE, {}, 'dolar_blue');
            return json.venta;
        } catch(e) { 
            if (e.message !== 'CIRCUIT_OPEN' && e.name !== 'AbortError' && e.message !== 'HARD_TIMEOUT') {
                ErrorHandler.handle(new AppError("No se pudo actualizar el Dólar Blue", 'NETWORK_API', e));
            }
            return null; 
        }
    }

    calcularSMA(history, period) {
        if (!history || history.length < period) return null;
        const slice = history.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    async fetchPrecioUnico(ticker, cachePrecios) {
        let cache = cachePrecios[ticker];
        let forceCache = this.circuitBreaker.state === 'OPEN';
        
        if(cache && (forceCache || (Date.now() - cache.time < 1800000))) return cache.data; 

        ticker = ticker.toUpperCase().trim();
        let price = null;
        let history = [];
        
        try {
            if (ticker.endsWith('USDT')) {
                const json = await this.enqueueRequest(ENDPOINTS.BINANCE(ticker), {}, `crypto_${ticker}`);
                if (!Array.isArray(json) || json.length === 0) throw new Error("Datos Binance inválidos");
                price = parseFloat(json[json.length - 1][4]);
                history = json.map(k => parseFloat(k[4]));
            } 
            else if (ticker.startsWith('FCI:')) {
                return null;
            } 
            else {
                let searchTicker = ticker;
                let isCedear = false;

                if (!ticker.endsWith('.BA')) {
                    searchTicker = `${ticker}.BA`;
                    isCedear = true;
                }
                
                const urlFinal = ENDPOINTS.PROXY(ENDPOINTS.YAHOO_FINANCE(searchTicker));
                const json = await this.enqueueRequest(urlFinal, {}, `precio_${ticker}`);
                
                if(!json || !json.chart || !json.chart.result) throw new Error("Formato de respuesta inválido");
                let result = json.chart.result[0];
                price = result.meta.regularMarketPrice;
                history = result.indicators.quote[0].close.filter(p => p !== null) || [];
                
                let originalPrice = null;
                if (isCedear) {
                    try {
                        const urlOriginal = ENDPOINTS.PROXY(ENDPOINTS.YAHOO_FINANCE(ticker));
                        const jsonOriginal = await this.enqueueRequest(urlOriginal, {}, `precio_orig_${ticker}`);
                        originalPrice = jsonOriginal.chart.result[0].meta.regularMarketPrice;
                    } catch (e) {
                        console.warn(`[DATA_API] Fallo al obtener cotización madre (USD) para ${ticker}:`, e.message);
                    }
                }

                return { price, history, sma50: this.calcularSMA(history, 50), sma200: this.calcularSMA(history, 200), originalPrice };
            }
        } catch(e) {
            if (cache) return cache.data;
            if (e.message !== 'CIRCUIT_OPEN' && e.name !== 'AbortError' && e.message !== 'HARD_TIMEOUT') {
                console.warn(`[DATA_API] Fallo cotización de ${ticker}:`, e.message);
            }
            return null;
        }
    }
}

class PriceStreamManager {
    constructor(apiInstance) {
        this.api = apiInstance;
        this.subscribers = new Map();
        this.activeTickers = new Set();
        this.streamInterval = null;
        this.isWebSocketMode = false;
    }

    subscribe(ticker, callback) {
        ticker = ticker.toUpperCase().trim();
        this.subscribers.set(ticker, callback);
        this.activeTickers.add(ticker);
        this.startStream();
    }

    unsubscribeAll() {
        this.subscribers.clear();
        this.activeTickers.clear();
        this.stopStream();
    }

    startStream() {
        if (this.isWebSocketMode) return;
        
        if (!this.streamInterval && this.activeTickers.size > 0) {
            this.streamInterval = setInterval(() => this.pollPrecios(), 60000);
        }
    }

    stopStream() {
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }
    }

    async pollPrecios() {
        let dummyCache = {}; 
        for (const ticker of this.activeTickers) {
            const result = await this.api.fetchPrecioUnico(ticker, dummyCache);
            if (result && this.subscribers.has(ticker)) {
                this.subscribers.get(ticker)(ticker, result);
            }
        }
    }
}

export const api = new APIManager();
export const priceStream = new PriceStreamManager(api);