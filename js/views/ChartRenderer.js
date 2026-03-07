"use strict";
import { UIMetrics } from './UIMetrics.js';
import { FinancialMath } from '../utils/financial.js';

// -----------------------------------------------------------------------------
// CONFIGURACIÓN GLOBAL PROFESIONAL PARA TODOS LOS GRÁFICOS (UI Unificada)
// -----------------------------------------------------------------------------
Chart.defaults.color = 'hsl(225, 20%, 61%)';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.elements.line.tension = 0.4; 
Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.point.hoverRadius = 6;
Chart.defaults.scale.grid.color = 'rgba(38, 38, 38, 0.4)';

Chart.defaults.interaction.mode = 'index';
Chart.defaults.interaction.intersect = false;

// Tooltips Neutros, Limpios y Corporativos
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)'; 
Chart.defaults.plugins.tooltip.titleColor = '#94a3b8'; 
Chart.defaults.plugins.tooltip.bodyColor = '#f8fafc'; 
Chart.defaults.plugins.tooltip.titleFont = { size: 13, family: "'Inter', sans-serif", weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { size: 14, family: "'Roboto Mono', monospace", weight: 'normal' };
Chart.defaults.plugins.tooltip.padding = 16;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.boxPadding = 8;
Chart.defaults.plugins.tooltip.borderColor = 'rgba(51, 65, 85, 0.8)'; 
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.usePointStyle = true; 

const chartInstances = {};

export const ChartRenderer = {
    
    _createGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        let colorWithAlphaStart = color;
        let colorWithAlphaEnd = 'transparent';

        if (color.startsWith('hsl')) {
            colorWithAlphaStart = color.replace(')', ', 0.4)').replace('hsl', 'hsla');
            colorWithAlphaEnd = color.replace(')', ', 0.0)').replace('hsl', 'hsla');
        } else if (color.startsWith('#')) {
            let r = parseInt(color.substring(1,3), 16);
            let g = parseInt(color.substring(3,5), 16);
            let b = parseInt(color.substring(5,7), 16);
            colorWithAlphaStart = `rgba(${r}, ${g}, ${b}, 0.4)`;
            colorWithAlphaEnd = `rgba(${r}, ${g}, ${b}, 0.0)`;
        } else if (color.startsWith('rgba')) {
            colorWithAlphaStart = color.replace(/[\d\.]+\)$/g, '0.4)');
            colorWithAlphaEnd = color.replace(/[\d\.]+\)$/g, '0.0)');
        }

        gradient.addColorStop(0, colorWithAlphaStart);
        gradient.addColorStop(1, colorWithAlphaEnd);
        return gradient;
    },

    renderVentasMensuales(labels, dataIngresos, dataCostoVida, wrapDOMId) {
        const wrap = document.getElementById(wrapDOMId);
        if (!wrap) return;

        if (!labels || labels.length === 0) {
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><span>Sin datos de ventas</span></div>';
            return;
        }

        let canvas = wrap.querySelector('canvas');
        if (!canvas) {
            wrap.innerHTML = '<canvas></canvas>';
            canvas = wrap.querySelector('canvas');
        }

        const ctx = canvas.getContext('2d');
        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
        const colorUp = getCSS('--color-up', '#00F5A0');
        const colorWarning = getCSS('--color-warning', 'hsl(50, 100%, 50%)');
        
        if (chartInstances[wrapDOMId]) chartInstances[wrapDOMId].destroy();

        const displayLabels = labels.map(lbl => {
            const parts = lbl.split('-');
            if(parts.length !== 2) return lbl;
            const date = new Date(parts[0], parseInt(parts[1])-1, 1);
            return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).replace('.', '');
        });

        chartInstances[wrapDOMId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Promedio Costo de Vida',
                        data: dataCostoVida,
                        borderColor: colorWarning,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [4, 4],
                        pointRadius: 2,
                        pointBackgroundColor: colorWarning,
                        tension: 0.3,
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Ingreso Operativo Total',
                        data: dataIngresos,
                        backgroundColor: colorUp,
                        borderRadius: 4,
                        borderWidth: 0,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: { 
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: { usePointStyle: true, boxWidth: 8, font: {size: 11} }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                return ` ${label}: $` + context.parsed.y.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0});
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } },
                    y: { 
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            callback: function(value) {
                                if(value >= 1000000) return '$' + (value/1000000).toFixed(1) + 'M';
                                if(value >= 1000) return '$' + (value/1000).toFixed(0) + 'k';
                                return '$' + value;
                            },
                            font: { family: "'Roboto Mono', monospace", size: 11 }
                        }
                    }
                }
            }
        });
    },

    renderEvolucion(modelData, filter) {
        const wrap = document.getElementById('wrap-evolucion');
        if (!wrap || !modelData.stats.historyFechas) return;

        let fechas = modelData.stats.historyFechas;
        let pTotal = modelData.stats.historyPatrimonioConStock || modelData.stats.historyPatrimonio; 
        let pLiq = modelData.stats.historyLiquidez;
        let pInv = modelData.stats.historyInvertido;
        let pPuro = modelData.stats.historyPatrimonioPuro || [];
        let pVida = modelData.stats.historyCostoVida || [];
        let pInf = modelData.stats.historyInflacion || [];
        let pMediaVida = modelData.stats.historyMediaVida || []; 

        if (fechas.length === 0) {
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted); flex-direction:column;"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><span>Sin datos históricos registrados</span></div>';
            return;
        }

        let limite = 0;
        let hoy = new Date();
        if (filter === '1M') limite = new Date(hoy.setMonth(hoy.getMonth() - 1)).toISOString().split('T')[0];
        else if (filter === '3M') limite = new Date(hoy.setMonth(hoy.getMonth() - 3)).toISOString().split('T')[0];
        else if (filter === '6M') limite = new Date(hoy.setMonth(hoy.getMonth() - 6)).toISOString().split('T')[0];
        else if (filter === 'YTD') limite = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0];
        
        let fFiltradas = [], dTotal = [], dLiq = [], dInv = [], dPuro = [], dVida = [], dInf = [], dMediaVida = [];
        
        for (let i = 0; i < fechas.length; i++) {
            if (filter === 'MAX' || fechas[i] >= limite) {
                fFiltradas.push(fechas[i]);
                let divisor = modelData.vistaUSD ? modelData.dolarBlue : 1;
                
                dTotal.push(pTotal[i] !== null ? pTotal[i] / divisor : null);
                dLiq.push(pLiq[i] !== null ? pLiq[i] / divisor : null);
                dInv.push(pInv[i] !== null ? pInv[i] / divisor : null);
                dPuro.push(pPuro[i] !== null ? pPuro[i] / divisor : null);
                dVida.push(pVida[i] !== null ? pVida[i] / divisor : null);
                dMediaVida.push(pMediaVida[i] !== null ? pMediaVida[i] / divisor : null);
                dInf.push(pInf[i] !== null ? pInf[i] / divisor : null);
            }
        }

        let canvasContainer = wrap.querySelector('#evolucion-canvas-container');
        if (!canvasContainer) {
            wrap.innerHTML = `
                <div id="custom-chart-legend" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; padding-bottom: 15px; margin-bottom: 5px; border-bottom: 1px solid var(--border-color);"></div>
                <div id="evolucion-canvas-container" style="position: relative; height: calc(100% - 50px); width: 100%;">
                    <canvas id="chartEvolucion"></canvas>
                </div>
            `;
            canvasContainer = wrap.querySelector('#evolucion-canvas-container');
            this._buildCustomLegendSkeleton('custom-chart-legend');
        }
        
        let canvas = canvasContainer.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
        
        const colors = {
            colorPrimary: getCSS('--color-primary', 'hsl(191, 100%, 50%)'),
            colorUp: getCSS('--color-up', 'hsl(159, 100%, 48%)'),
            colorAccent: getCSS('--color-accent', 'hsl(283, 100%, 50%)'),
            colorPuro: getCSS('--color-puro', 'hsl(0, 0%, 90%)'),
            colorVida: getCSS('--color-down', 'hsl(338, 100%, 50%)'),
            colorMediaVida: getCSS('--color-warning', 'hsl(50, 100%, 50%)'),
            colorInf: getCSS('--color-orange', 'hsl(24, 100%, 50%)')
        };

        const datasetsConfig = [
            { label: 'Patrimonio Comercial Neto', data: dTotal, borderColor: colors.colorPrimary, backgroundColor: this._createGradient(ctx, colors.colorPrimary), borderWidth: 3, fill: true, order: 1, spanGaps: false },
            { label: 'Patrimonio Puro (Ahorro Físico)', data: dPuro, borderColor: colors.colorPuro, backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 4], fill: false, order: 2, spanGaps: false },
            { label: 'Capital Invertido Bursátil', data: dInv, borderColor: colors.colorAccent, backgroundColor: this._createGradient(ctx, colors.colorAccent), borderWidth: 2, borderDash: [5, 5], fill: true, order: 3, spanGaps: false },
            { label: 'Liquidez en Caja', data: dLiq, borderColor: colors.colorUp, backgroundColor: 'transparent', borderWidth: 2, fill: false, order: 4, spanGaps: false },
            { label: 'Costo de Vida Acumulado', data: dVida, borderColor: colors.colorVida, backgroundColor: 'transparent', borderWidth: 1.5, fill: false, order: 5, hidden: true, spanGaps: false },
            { label: 'Media Móvil Costo Vida', data: dMediaVida, borderColor: colors.colorMediaVida, backgroundColor: 'transparent', borderWidth: 2, borderDash: [2, 2], fill: false, order: 6, hidden: true, spanGaps: true },
            { label: 'Inflación Proyectada', data: dInf, borderColor: colors.colorInf, backgroundColor: 'transparent', borderWidth: 2, borderDash: [5, 5], fill: false, order: 7, hidden: true, spanGaps: true }
        ];

        if (chartInstances['chartEvolucion']) {
            const chart = chartInstances['chartEvolucion'];
            chart.data.labels = fFiltradas;
            datasetsConfig.forEach((ds, idx) => {
                chart.data.datasets[idx].data = ds.data;
            });
            
            chart.options.plugins.tooltip.callbacks.label = function(context) {
                if (context.parsed.y === null) return null; 
                let label = context.dataset.label || '';
                let v = context.parsed.y;
                let formattedValue = modelData.vistaUSD 
                    ? 'USD ' + v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) 
                    : '$ ' + v.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0});
                return ` ${label}: ${formattedValue}`;
            };

            chart.update('none');
        } else {
            chartInstances['chartEvolucion'] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: fFiltradas,
                    datasets: datasetsConfig
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    animation: { duration: 800, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    let rawDate = context[0].label;
                                    if(!rawDate) return '';
                                    let d = new Date(rawDate + "T00:00:00");
                                    let formatted = d.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
                                },
                                label: function(context) {
                                    if (context.parsed.y === null) return null; 
                                    let label = context.dataset.label || '';
                                    let v = context.parsed.y;
                                    let formattedValue = modelData.vistaUSD 
                                        ? 'USD ' + v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) 
                                        : '$ ' + v.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0});
                                    return ` ${label}: ${formattedValue}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            border: { display: false },
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
                                    return value;
                                },
                                font: { family: "'Roboto Mono', monospace", size: 11 }
                            }
                        }
                    }
                }
            });
        }
    },

    _buildCustomLegendSkeleton(legendContainerId) {
        const legendContainer = document.getElementById(legendContainerId);
        if (!legendContainer || legendContainer.innerHTML !== "") return;

        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;

        const legendItems = [
            { index: 0, label: 'Patrimonio Comercial Neto', color: getCSS('--color-primary', 'hsl(191, 100%, 50%)'), hidden: false, tooltip: 'La suma total de liquidez operativa, capital bursátil y valoración del inventario.' },
            { index: 1, label: 'Patrimonio Puro (Ahorro Físico)', color: getCSS('--color-puro', 'hsl(0, 0%, 90%)'), hidden: false, tooltip: 'El flujo de capital aportado excluyendo rendimientos generados o ingresos por ventas.' },
            { index: 2, label: 'Capital Invertido Bursátil', color: getCSS('--color-accent', 'hsl(283, 100%, 50%)'), hidden: false, tooltip: 'El valor actual de mercado de todos los activos en el portafolio de inversión.' },
            { index: 3, label: 'Liquidez en Caja', color: getCSS('--color-up', 'hsl(159, 100%, 48%)'), hidden: false, tooltip: 'Capital circulante no invertido, disponible para cobertura de pasivos operativos.' },
            { index: 4, label: 'Costo de Vida Acumulado', color: getCSS('--color-down', 'hsl(338, 100%, 50%)'), hidden: true, tooltip: 'Sumatoria histórica de todos los egresos personales y comerciales.' },
            { index: 5, label: 'Media Móvil Costo Vida', color: getCSS('--color-warning', 'hsl(50, 100%, 50%)'), hidden: true, tooltip: 'Promedio móvil mensual del índice de egresos generales calculado sobre el histórico.' },
            { index: 6, label: 'Inflación Proyectada', color: getCSS('--color-orange', 'hsl(24, 100%, 50%)'), hidden: true, tooltip: 'Índice base estadístico para el cálculo del rendimiento real del patrimonio neto.' }
        ];

        let html = '';
        legendItems.forEach(item => {
            html += `
                <div class="custom-legend-item" data-index="${item.index}" style="display: flex; align-items: center; gap: 8px; cursor: pointer; opacity: ${item.hidden ? 0.4 : 1}; transition: opacity 0.2s;">
                    <div class="legend-color-box" style="width: 14px; height: 14px; border-radius: 4px; background-color: ${item.color}; border: 1px solid rgba(255,255,255,0.1); pointer-events: none;"></div>
                    <span class="legend-text" style="font-size: 11px; color: var(--text-main); font-weight: 600; pointer-events: none;">${item.label}</span>
                    <span data-tooltip-title="${item.label}" data-tooltip-desc="${item.tooltip}" class="legend-tooltip-icon custom-tooltip-trigger" style="color: var(--color-primary); background: var(--bg-input); border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; border: 1px solid var(--border-color); z-index: 10; cursor: help;">?</span>
                </div>
            `;
        });

        legendContainer.innerHTML = html;

        // Inyección dinámica de Estilos de Tooltip Flotante para escritorio y móvil
        if (!document.getElementById('custom-legend-styles')) {
            const style = document.createElement('style');
            style.id = 'custom-legend-styles';
            style.innerHTML = `
                .floating-legend-tooltip {
                    position: absolute; background: rgba(15, 23, 42, 0.98); color: #f8fafc; padding: 12px; border-radius: 8px;
                    font-size: 11px; line-height: 1.5; border: 1px solid var(--border-color); box-shadow: 0 10px 20px -3px rgba(0,0,0,0.7);
                    z-index: 9999; pointer-events: none; width: 240px; transition: opacity 0.2s, transform 0.2s; opacity: 0; transform: translateY(5px);
                }
                .floating-legend-tooltip.active {
                    opacity: 1; transform: translateY(0);
                }
                .floating-legend-tooltip strong { color: var(--color-primary); display: block; margin-bottom: 4px; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
            `;
            document.head.appendChild(style);
        }

        const floatingTooltip = document.createElement('div');
        floatingTooltip.className = 'floating-legend-tooltip';
        document.body.appendChild(floatingTooltip);

        let hideTimeout;

        const showTooltip = (helpIcon, title, desc) => {
            clearTimeout(hideTimeout);
            floatingTooltip.innerHTML = `<strong>${title}</strong>${desc}`;
            
            // Calculo seguro de colisión con los bordes de la pantalla (Lógica responsiva)
            const rect = helpIcon.getBoundingClientRect();
            let leftPos = rect.left + window.scrollX - (240 / 2) + (rect.width / 2);
            const topPos = rect.top + window.scrollY - 10;

            if (leftPos < 10) leftPos = 10;
            if (leftPos + 240 > window.innerWidth - 10) leftPos = window.innerWidth - 250;

            floatingTooltip.style.left = `${leftPos}px`;
            
            // Forzamos un micro-retraso para leer la altura renderizada y alinear correctamente arriba
            requestAnimationFrame(() => {
                floatingTooltip.style.top = `${topPos - floatingTooltip.offsetHeight}px`;
                floatingTooltip.classList.add('active');
            });
        };

        const hideTooltip = () => {
            hideTimeout = setTimeout(() => {
                floatingTooltip.classList.remove('active');
            }, 100);
        };

        // Lógica de Eventos Multidispositivo (Hover y Touch)
        legendContainer.querySelectorAll('.custom-legend-item').forEach(item => {
            const helpIcon = item.querySelector('.legend-tooltip-icon');
            const title = helpIcon.getAttribute('data-tooltip-title');
            const desc = helpIcon.getAttribute('data-tooltip-desc');

            helpIcon.addEventListener('mouseenter', () => showTooltip(helpIcon, title, desc));
            helpIcon.addEventListener('mouseleave', hideTooltip);

            helpIcon.addEventListener('touchstart', (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                if (floatingTooltip.classList.contains('active')) {
                    hideTooltip();
                } else {
                    showTooltip(helpIcon, title, desc);
                }
            });

            item.addEventListener('click', function(e) {
                if (e.target.classList.contains('legend-tooltip-icon')) return;
                
                let idx = parseInt(this.getAttribute('data-index'));
                const chart = chartInstances['chartEvolucion'];
                
                if (chart) {
                    const isVisible = chart.isDatasetVisible(idx);
                    chart.setDatasetVisibility(idx, !isVisible);
                    chart.update();
                    this.style.opacity = !isVisible ? "1" : "0.4";
                }
            });
        });

        // Ocultar tooltip al hacer scroll o tocar fuera
        window.addEventListener('scroll', hideTooltip, { passive: true });
        document.addEventListener('touchstart', (e) => {
            if (!e.target.classList.contains('legend-tooltip-icon')) hideTooltip();
        }, { passive: true });
    },

    renderDona(sectorData, actData) {
        const wrapSec = document.getElementById('wrap-dona');
        const wrapAct = document.getElementById('wrap-dona-act');
        if (!wrapSec || !wrapAct) return;

        const commonOptions = {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            animation: { duration: 1000, animateScale: true, easing: 'easeOutExpo' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let value = context.parsed;
                            let total = context.dataset.data.reduce((a, b) => a + b, 0);
                            let pct = ((value / total) * 100).toFixed(1) + '%';
                            return ` ${context.label}: $${value.toLocaleString('es-AR', {maximumFractionDigits:0})} (${pct})`;
                        }
                    }
                }
            },
            elements: { arc: { borderWidth: 0, hoverOffset: 8 } }
        };

        const paleta = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f97316', '#6366f1'];
        
        let secLabels = Object.keys(sectorData);
        let secValues = Object.values(sectorData);
        if (secValues.length === 0) {
            wrapSec.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);"><span class="skeleton" style="width:100px;height:100px;border-radius:50%;"></span></div>';
        } else {
            let canvasSec = wrapSec.querySelector('canvas');
            if (!canvasSec) { wrapSec.innerHTML = '<canvas id="chartSector"></canvas>'; canvasSec = wrapSec.querySelector('canvas'); }
            if (chartInstances['chartSector']) chartInstances['chartSector'].destroy();
            chartInstances['chartSector'] = new Chart(canvasSec.getContext('2d'), {
                type: 'doughnut', data: { labels: secLabels, datasets: [{ data: secValues, backgroundColor: paleta }] }, options: commonOptions
            });
        }

        let actLabels = Object.keys(actData);
        let actValues = Object.values(actData);
        if (actValues.length === 0) {
            wrapAct.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);"><span class="skeleton" style="width:100px;height:100px;border-radius:50%;"></span></div>';
        } else {
            let canvasAct = wrapAct.querySelector('canvas');
            if (!canvasAct) { wrapAct.innerHTML = '<canvas id="chartActivo"></canvas>'; canvasAct = wrapAct.querySelector('canvas'); }
            if (chartInstances['chartActivo']) chartInstances['chartActivo'].destroy();
            chartInstances['chartActivo'] = new Chart(canvasAct.getContext('2d'), {
                type: 'doughnut', data: { labels: actLabels, datasets: [{ data: actValues, backgroundColor: paleta }] }, options: commonOptions
            });
        }
    },

    renderDistribucionGastos(chartData, wrapDOMId) {
        const wrap = document.getElementById(wrapDOMId);
        if (!wrap) return;

        if (!chartData || !chartData.data || chartData.data.length === 0 || chartData.total === 0) {
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted); flex-direction:column;"><svg width="40" height="40" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><span>Sin datos en el período</span></div>';
            return;
        }

        let canvas = wrap.querySelector('canvas');
        if (!canvas) {
            wrap.innerHTML = '<canvas></canvas>';
            canvas = wrap.querySelector('canvas');
        }

        if (chartInstances[wrapDOMId]) {
            chartInstances[wrapDOMId].destroy();
        }

        const paleta = [
            '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
            '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#14b8a6', 
            '#64748b', '#eab308', '#d946ef'
        ];

        chartInstances[wrapDOMId] = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{ data: chartData.data, backgroundColor: paleta, borderWidth: 0, hoverOffset: 8 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '72%',
                animation: { duration: 900, animateScale: true, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let value = context.parsed;
                                let total = chartData.total;
                                let pct = ((value / total) * 100).toFixed(1) + '%';
                                return ` $${value.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})} (${pct})`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Dibuja el Sankey Operativo adaptándose a la temporalidad seleccionada.
     * Implementa Motor de Conservación de Energía Estricto (Balanceo Matemático Perfilado).
     */
    renderSankeyOperativo(stats, temporalidad, isUSD, dBlue) {
        const wrap = document.getElementById('sankey-wrap');
        if (!wrap) return;
        
        let canvas = wrap.querySelector('canvas');
        if (!canvas) {
            wrap.innerHTML = '<canvas id="chartSankey"></canvas>';
            canvas = wrap.querySelector('canvas');
        }

        const ctx = canvas.getContext('2d');
        if (chartInstances['chartSankey']) chartInstances['chartSankey'].destroy();

        const div = isUSD ? dBlue : 1;
        
        const aplicarPromedio = (monto) => {
            const prom = FinancialMath.calcularPromediosDesglosados(monto * div, temporalidad, []);
            let val;
            if (temporalidad.toLowerCase() === 'anual') val = prom.mes / div;
            else if (temporalidad.toLowerCase() === 'mensual') val = prom.semana / div;
            else if (temporalidad.toLowerCase() === 'semanal') val = prom.dia / div;
            else if (temporalidad.toLowerCase() === 'diario') val = prom.hora / div;
            else val = monto;
            return Math.max(0, val);
        };

        const ingresosBrutos = aplicarPromedio((stats.ingresosLocal || 0) / div);
        const gastosLocales = aplicarPromedio((stats.gastosLocal || 0) / div);
        const pagosProv = aplicarPromedio((stats.pagosProveedores || 0) / div);
        const gastosPersonales = aplicarPromedio((stats.gastosFamiliar || 0) / div);
        const inver = aplicarPromedio((stats.totalAhorrado || 0) / div);

        if (ingresosBrutos === 0 && gastosLocales === 0 && pagosProv === 0) {
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);"><svg width="48" height="48" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><span>Sin flujo financiero en esta temporalidad</span></div>';
            return;
        }

        // 2. Motor de Conservación de Energía (Balanceo Algorítmico)
        const costosOperativos = gastosLocales + pagosProv;
        const sumatoriaSalidas = gastosPersonales + inver;
        
        let flujoLibreReal = 0;
        let deficitOperativo = 0;
        let deficitEstructural = 0;
        let excedente = 0;

        const links = [];

        // Fase de Ingresos y Costos Operativos
        if (ingresosBrutos >= costosOperativos) {
            flujoLibreReal = ingresosBrutos - costosOperativos;
            if (costosOperativos > 0) links.push({ source: 'Ingresos', target: 'Costos Op.', value: costosOperativos });
            if (flujoLibreReal > 0) links.push({ source: 'Ingresos', target: 'Flujo Libre', value: flujoLibreReal });
        } else {
            deficitOperativo = costosOperativos - ingresosBrutos;
            if (ingresosBrutos > 0) links.push({ source: 'Ingresos', target: 'Costos Op.', value: ingresosBrutos });
            links.push({ source: 'Ahorros Previos', target: 'Costos Op.', value: deficitOperativo });
        }

        // Fase de Distribución de Flujo Libre hacia Egresos Finales
        if (sumatoriaSalidas > flujoLibreReal) {
            deficitEstructural = sumatoriaSalidas - flujoLibreReal;
            if (deficitEstructural > 0) links.push({ source: 'Ahorros Previos', target: 'Flujo Libre', value: deficitEstructural });
            if (gastosPersonales > 0) links.push({ source: 'Flujo Libre', target: 'G. Personal', value: gastosPersonales });
            if (inver > 0) links.push({ source: 'Flujo Libre', target: 'Inversión', value: inver });
        } else {
            excedente = flujoLibreReal - sumatoriaSalidas;
            if (gastosPersonales > 0) links.push({ source: 'Flujo Libre', target: 'G. Personal', value: gastosPersonales });
            if (inver > 0) links.push({ source: 'Flujo Libre', target: 'Inversión', value: inver });
            if (excedente > 0) links.push({ source: 'Flujo Libre', target: 'Excedente Líquido', value: excedente });
        }

        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
        const baseColors = {
            'Ingresos': getCSS('--color-primary', '#00F5A0'),
            'Costos Op.': getCSS('--color-down', '#FF005C'),
            'Flujo Libre': getCSS('--color-up', '#10b981'),
            'G. Personal': getCSS('--color-warning', '#f59e0b'),
            'Inversión': getCSS('--color-accent', '#8b5cf6'),
            'Ahorros Previos': '#64748b',
            'Excedente Líquido': '#0ea5e9'
        };

        const uniqueNodeIds = [...new Set(links.flatMap(l => [l.source, l.target]))];
        const nodesData = uniqueNodeIds.reduce((acc, id) => {
            acc[id] = baseColors[id] || '#cbd5e1';
            return acc;
        }, {});

        const sankeyConfig = {
            type: 'sankey',
            data: {
                datasets: [{
                    label: `Balance del Flujo (${temporalidad})`,
                    data: links,
                    colorFrom: (c) => c.dataset.data[c.dataIndex].source,
                    colorTo: (c) => c.dataset.data[c.dataIndex].target,
                    colorMode: 'gradient', alpha: 0.6,
                    labels: uniqueNodeIds.reduce((acc, id) => { acc[id] = id; return acc; }, {}),
                    nodeColors: nodesData,
                    borderWidth: 0, nodeBorderWidth: 1, nodeBorderColor: 'rgba(255,255,255,0.1)'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                font: { family: "'Inter', sans-serif", size: 11 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const l = context.raw;
                                return `${l.source} → ${l.target}: $${l.value.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}`;
                            }
                        }
                    }
                }
            }
        };

        chartInstances['chartSankey'] = new Chart(ctx, sankeyConfig);
    },

    renderDrawdown(dataFechas, dataDD) {
        const wrap = document.getElementById('wrap-drawdown');
        if (!wrap) return;

        if (!dataFechas || dataFechas.length === 0) {
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);">Sin datos para calcular caída</div>';
            return;
        }

        let canvas = wrap.querySelector('canvas');
        if (!canvas) {
            wrap.innerHTML = '<canvas id="chartDrawdown"></canvas>';
            canvas = wrap.querySelector('canvas');
        }

        const ctx = canvas.getContext('2d');
        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
        const colorDown = getCSS('--color-down', '#FF005C');
        
        if (chartInstances['chartDrawdown']) chartInstances['chartDrawdown'].destroy();

        chartInstances['chartDrawdown'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataFechas,
                datasets: [{
                    label: 'Drawdown (%)', data: dataDD,
                    borderColor: colorDown, backgroundColor: this._createGradient(ctx, colorDown),
                    borderWidth: 2, fill: 'origin', pointRadius: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 800 },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                    y: { 
                        position: 'right', max: 0, grid: { color: 'rgba(255, 0, 92, 0.1)' },
                        ticks: { callback: function(v) { return v.toFixed(0) + '%'; }, font: { family: "'Roboto Mono', monospace" } }
                    }
                }
            }
        });
    },

    renderCalculadora(labels, dAp, dInt, canvasId, c1, c2, wrapDOM) {
        if (!wrapDOM) return;

        let canvas = wrapDOM.querySelector('canvas');
        if (!canvas) {
            wrapDOM.innerHTML = `<canvas id="${canvasId}"></canvas>`;
            canvas = wrapDOM.querySelector('canvas');
        }

        if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

        chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Capital Aportado', data: dAp, backgroundColor: c1, borderRadius: 4 },
                    { label: 'Interés Compuesto', data: dInt, backgroundColor: c2, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutBack' },
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { 
                        stacked: true, border: { display: false },
                        ticks: {
                            callback: function(value) {
                                if(value >= 1000000) return '$' + (value/1000000).toFixed(1) + 'M';
                                if(value >= 1000) return '$' + (value/1000).toFixed(0) + 'k';
                                return '$' + value;
                            },
                            font: { family: "'Roboto Mono', monospace" }
                        }
                    }
                }
            }
        });
    },

    drawDashboardSparkline(canvasId, dataArr, colorHex) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !dataArr || dataArr.length === 0) return;

        if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

        const ctx = canvas.getContext('2d');
        const labels = Array.from({length: dataArr.length}, (_, i) => i);

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ data: dataArr, borderColor: colorHex, borderWidth: 2, pointRadius: 0, pointHoverRadius: 0, tension: 0.3 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 1000 },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false, min: Math.min(...dataArr) * 0.99, max: Math.max(...dataArr) * 1.01 } },
                layout: { padding: { top: 2, bottom: 2 } }
            }
        });
    },

    drawSparkline(canvasId, dataArr, colorHex) {
        const container = document.getElementById(canvasId);
        if (!container || !dataArr || dataArr.length === 0) return;

        let canvas = container.querySelector('canvas');
        if (!canvas) {
            container.innerHTML = '<canvas style="width:100%; height:100%;"></canvas>';
            canvas = container.querySelector('canvas');
        }

        if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

        const ctx = canvas.getContext('2d');
        const labels = Array.from({length: dataArr.length}, (_, i) => i);

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ data: dataArr, borderColor: colorHex, borderWidth: 1.5, pointRadius: 0, tension: 0.2 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                layout: { padding: 1 }
            }
        });
    }
};