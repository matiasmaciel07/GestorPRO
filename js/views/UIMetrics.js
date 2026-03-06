"use strict";
import { ChartRenderer } from './ChartRenderer.js';

export const UIMetrics = {
    
    parseNumber(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        let clean = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    },

    fmtStr(num, db, v) {
        if (isNaN(num)) num = 0;
        let val = v ? num / db : num;
        return val.toLocaleString(v ? 'en-US' : 'es-AR', { 
            minimumFractionDigits: v ? 2 : 0, 
            maximumFractionDigits: v ? 2 : 0 
        });
    },

    fmt(num, db, v) {
        let tag = v ? `<span class="tag--usd">USD</span>` : `<span class="tag--ars">ARS</span>`;
        return `${tag} <span class="data-font privacy-mask" style="display:inline-block; font-weight: 900;">${this.fmtStr(num, db, v)}</span>`;
    },

    animateValue(obj, end, formatter, duration = 800) {
        if (!obj) return;
        
        let start = parseFloat(obj.dataset.currentValue) || 0;
        if (start === end) {
            obj.innerHTML = formatter(end);
            return;
        }

        let startTimestamp = null;
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            const currentProgress = easeOutQuart(progress);
            const currentVal = start + (end - start) * currentProgress;
            
            obj.innerHTML = formatter(currentVal);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = formatter(end);
                obj.dataset.currentValue = end;
            }
        };
        window.requestAnimationFrame(step);
    },

    actualizarFavicon(ganancia) {
        const link = document.getElementById('dynamic-favicon');
        if (!link) return;
        let color = '#8892b0';
        if (ganancia > 0) color = '#00F5A0';
        else if (ganancia < 0) color = '#FF005C';
        
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        link.href = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    },

    /**
     * Renderiza la lista de gastos desglosada por categorías.
     * Sincronizado con la temporalidad del controlador.
     */
    renderListaGastos(datosGenerados, domId, divisor, isUSD) {
        const container = document.getElementById(domId);
        if (!container) return;

        container.innerHTML = '';
        if (!datosGenerados.labels || datosGenerados.labels.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
                <p>No hay registros para este periodo.</p>
            </div>`;
            return;
        }

        let total = datosGenerados.total;
        let combinedData = datosGenerados.labels.map((label, index) => ({
            categoria: label,
            monto: datosGenerados.data[index],
            porcentaje: total > 0 ? ((datosGenerados.data[index] / total) * 100).toFixed(1) : 0
        })).sort((a, b) => b.monto - a.monto);

        const ul = document.createElement('ul');
        ul.className = 'lista-gastos-desglose';
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        ul.style.margin = '0';

        combinedData.forEach(item => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '10px 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            
            li.innerHTML = `
                <div class="gasto-info" style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="gasto-cat" style="font-size: 13px; font-weight: 600; color: var(--text-main);">${item.categoria}</span>
                    <span class="gasto-pct data-font" style="font-size: 10px; color: var(--color-primary);">${item.porcentaje}% del total</span>
                </div>
                <div class="gasto-monto" style="text-align: right;">${this.fmt(item.monto, divisor, isUSD)}</div>
            `;
            ul.appendChild(li);
        });

        container.appendChild(ul);
    },

    actualizarAuditoriaComercial(stats, divisor, isUSD) {
        const safeEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerHTML = val; };
        
        let ingresosDeclarados = stats.ingresosLocal || 0;
        safeEl('val-ingresos-brutos-declarados', this.fmt(ingresosDeclarados, divisor, isUSD));

        let ingresosNetos = stats.ingresosNetosAuditoria !== undefined ? stats.ingresosNetosAuditoria : ingresosDeclarados;
        safeEl('val-ingresos-brutos-netos', this.fmt(ingresosNetos, divisor, isUSD));

        let inventarioBase = stats.inventarioBaseCorregido !== undefined ? stats.inventarioBaseCorregido : 0;
        safeEl('val-inventario-base-corregido', this.fmt(inventarioBase, divisor, isUSD));
    },

    inyectarMetricasFase6(modelData) {
        if (!modelData || !modelData.stats) return;
        const s = modelData.stats;
        const isUSD = modelData.vistaUSD;
        const div = isUSD ? modelData.dolarBlue : 1;

        const safeEl = (id, val) => { const e = document.getElementById(id); if (e) e.innerHTML = val; };

        // Auditoría Comercial Constante
        this.actualizarAuditoriaComercial(s, div, isUSD);

        // Dólar Promedio Histórico
        const lblInvSub1 = document.getElementById('lbl-inv-sub1');
        if(lblInvSub1) lblInvSub1.innerText = 'Dólar Promedio Histórico';
        safeEl('val-inv-sub1', `<span class="data-font privacy-mask">$ ${(s.precioPromedioDolar || 0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>`);

        // Gráfico de Ventas Mensuales Automático
        if (s.ventasMensuales && s.ventasMensuales.labels.length > 0) {
            ChartRenderer.renderVentasMensuales(s.ventasMensuales.labels, s.ventasMensuales.data.map(v => v / div), 'wrap-ventas-mensuales');
        }

        // Valor del Esfuerzo Físico Limpio
        if (s.esfuerzo) {
            safeEl('esfuerzo-mes', this.fmt(s.esfuerzo.mes, div, isUSD));
            safeEl('esfuerzo-semana', this.fmt(s.esfuerzo.semana, div, isUSD));
            safeEl('esfuerzo-dia', this.fmt(s.esfuerzo.dia, div, isUSD));
            safeEl('esfuerzo-hora', this.fmt(s.esfuerzo.hora, div, isUSD));
        }

        // Volatilidad y Riesgo
        if (s.riesgo) {
            safeEl('info-sharpe', `<span class="data-font privacy-mask">${s.riesgo.sharpe}</span>`);
            safeEl('info-sortino', `<span class="data-font privacy-mask">${s.riesgo.sortino}</span>`);
            safeEl('info-volatilidad', `<span class="data-font privacy-mask">${s.riesgo.volatilidad}%</span>`);
        }
    }
};