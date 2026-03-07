"use strict";
import { UIMetrics } from './UIMetrics.js';
import { FinancialMath } from '../utils/financial.js';

// -----------------------------------------------------------------------------
// FASE 2: PLUGIN CUSTOM PARA GLOW NEÓN DIRECTO EN CANVAS (DEPURADO)
// -----------------------------------------------------------------------------
const NeonGlowPlugin = {
    id: 'neonGlow',
    beforeDatasetDraw(chart, args, pluginOptions) {
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLightMode) return; 
        
        // Blindaje: Solo aplicamos Glow a curvas y donas. 
        // Esto previene la corrupción del contexto y el bloque negro en Sankey o barras.
        if (chart.config.type !== 'line' && chart.config.type !== 'doughnut') return;
        
        const ctx = chart.ctx;
        ctx.save();
        const dataset = chart.data.datasets[args.index];
        
        let color = dataset.borderColor || dataset.backgroundColor;
        if (Array.isArray(color)) color = color[0];
        
        // Inyección de filtro Drop-Shadow en el contexto 2D
        ctx.shadowColor = color || 'transparent';
        ctx.shadowBlur = chart.config.type === 'line' ? 12 : 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    },
    afterDatasetDraw(chart, args, pluginOptions) {
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLightMode) return;
        
        // Blindaje de restauración simétrica
        if (chart.config.type !== 'line' && chart.config.type !== 'doughnut') return;
        
        chart.ctx.restore();
    }
};

Chart.register(NeonGlowPlugin);

// -----------------------------------------------------------------------------
// CONFIGURACIÓN GLOBAL CYBER-FINANCE / CANDY UI PARA GRÁFICOS
// -----------------------------------------------------------------------------
Chart.defaults.color = '#8B95A5'; // Texto Subtexto Starlight
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.elements.line.tension = 0.4; // Curvas fluidas y orgánicas
Chart.defaults.elements.point.radius = 0; // Puntos ocultos por defecto
Chart.defaults.elements.point.hoverRadius = 8; // Círculo sólido al interactuar
Chart.defaults.elements.point.hoverBorderWidth = 4;
Chart.defaults.elements.point.hoverBackgroundColor = '#FFFFFF'; // Centro luminoso
Chart.defaults.scale.grid.color = 'rgba(139, 149, 165, 0.15)'; 
Chart.defaults.scale.grid.borderDash = [5, 5]; // Cuadrículas Punteadas/Discontinuas

Chart.defaults.interaction.mode = 'index';
Chart.defaults.interaction.intersect = false;

// Tooltips de Alto Contraste (Modo Bóveda/Glassmorphism)
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 20, 26, 0.95)'; 
Chart.defaults.plugins.tooltip.titleColor = '#6045F4'; // Primario
Chart.defaults.plugins.tooltip.bodyColor = '#F8F9FA'; // Blanco puro para lectura clara
Chart.defaults.plugins.tooltip.titleFont = { size: 13, family: "'Inter', sans-serif", weight: '900' };
Chart.defaults.plugins.tooltip.bodyFont = { size: 14, family: "'Roboto Mono', monospace", weight: 'bold' };
Chart.defaults.plugins.tooltip.padding = 16;
Chart.defaults.plugins.tooltip.cornerRadius = 16; // Squircle tooltip
Chart.defaults.plugins.tooltip.boxPadding = 10;
Chart.defaults.plugins.tooltip.borderColor = 'rgba(96, 69, 244, 0.5)'; // Borde primario
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.usePointStyle = true; 

const chartInstances = {};

// Paleta Estratégica de 15 Colores Vibrantes (Diseño 70/30)
const paletaEstrategica = [
    '#6045F4', // Primario
    '#00FF95', // Menta Neón
    '#FF4D8A', // Categorías (Plasma)
    '#2CE6D6', // Cyan Data
    '#FCA311', // Naranja Alerta
    '#7C13A4', // Púrpura Barras
    '#FF871A', // Curva Naranja
    '#1AA7EC', // Azul Etiquetas
    '#F71735', // Rojo Plasma
    '#09FBFF', // Inversiones Cyan
    '#D403E1', // Origen Magenta
    '#E5FF00', // Activo Amarillo
    '#FF17A7', // Deudas Rosa
    '#13ADED', // Borde Celeste
    '#460071'  // Destino Violeta Oscuro
];

export const ChartRenderer = {
    
    _createGradient(ctx, color) {
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        let colorWithAlphaStart, colorWithAlphaEnd;

        if (color.startsWith('#')) {
            let r = parseInt(color.substring(1,3), 16) || 0;
            let g = parseInt(color.substring(3,5), 16) || 0;
            let b = parseInt(color.substring(5,7), 16) || 0;
            
            if (isLightMode) {
                // Gradientes Pastel Intenso hacia blanco
                colorWithAlphaStart = `rgba(${r}, ${g}, ${b}, 0.5)`;
                colorWithAlphaEnd = `rgba(255, 255, 255, 0.5)`;
            } else {
                // Fading profundo hacia transparente
                colorWithAlphaStart = `rgba(${r}, ${g}, ${b}, 0.6)`;
                colorWithAlphaEnd = `rgba(${r}, ${g}, ${b}, 0.0)`;
            }
        } else if (color.startsWith('rgba')) {
            colorWithAlphaStart = color.replace(/[\d\.]+\)$/g, isLightMode ? '0.5)' : '0.6)');
            colorWithAlphaEnd = color.replace(/[\d\.]+\)$/g, isLightMode ? '0.0)' : '0.0)');
        } else {
            colorWithAlphaStart = color;
            colorWithAlphaEnd = 'transparent';
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
        
        const colorUp = getCSS('--color-up', '#00FF95');
        const colorWarning = getCSS('--color-warning', '#FCA311');
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        
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
                        label: 'Costo de Vida (Límite)',
                        data: dataCostoVida,
                        borderColor: colorWarning,
                        backgroundColor: 'transparent',
                        borderWidth: 3, 
                        borderDash: [6, 6],
                        pointRadius: 4,
                        pointBackgroundColor: colorWarning,
                        pointBorderColor: '#FFF',
                        pointBorderWidth: 2,
                        tension: 0.4,
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Ingreso Operativo Total',
                        data: dataIngresos,
                        backgroundColor: colorUp,
                        borderRadius: 8,
                        borderWidth: isLightMode ? 2 : 0, 
                        borderColor: isLightMode ? '#FFFFFF' : 'transparent',
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 1000, easing: 'easeOutExpo' },
                plugins: { 
                    legend: { 
                        display: true, position: 'top',
                        labels: { usePointStyle: true, boxWidth: 10, font: {size: 12, weight: 'bold', family: "'Inter', sans-serif"} }
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
                    x: { 
                        grid: { display: false }, 
                        ticks: { font: { size: 11, weight: 'bold', family: "'Inter', sans-serif" }, maxRotation: 45, minRotation: 0 } 
                    },
                    y: { 
                        beginAtZero: true, border: { display: false },
                        ticks: {
                            callback: function(value) {
                                if(value >= 1000000) return '$' + (value/1000000).toFixed(1) + 'M';
                                if(value >= 1000) return '$' + (value/1000).toFixed(0) + 'k';
                                return '$' + value;
                            },
                            font: { family: "'Roboto Mono', monospace", size: 12, weight: 'bold' }
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
                <div id="custom-chart-legend" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; padding-bottom: 20px; margin-bottom: 10px; border-bottom: 1px dashed var(--border-color);"></div>
                <div id="evolucion-canvas-container" style="position: relative; height: calc(100% - 65px); width: 100%;">
                    <canvas id="chartEvolucion"></canvas>
                </div>
            `;
            canvasContainer = wrap.querySelector('#evolucion-canvas-container');
            this._buildCustomLegendSkeleton('custom-chart-legend');
        }
        
        let canvas = canvasContainer.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        
        const colors = {
            colorPrimary: getCSS('--color-primary', '#6045F4'),
            colorUp: getCSS('--color-up', '#00FF95'),
            colorAccent: getCSS('--color-accent', '#FF4D8A'),
            colorPuro: isLightMode ? '#0A0D14' : '#FFFFFF',
            colorVida: getCSS('--color-down', '#F71735'),
            colorMediaVida: getCSS('--color-warning', '#FCA311'),
            colorInf: getCSS('--color-orange', '#FF871A')
        };

        const datasetsConfig = [
            { label: 'Patrimonio Comercial Neto', data: dTotal, borderColor: colors.colorPrimary, backgroundColor: this._createGradient(ctx, colors.colorPrimary), borderWidth: 4, fill: true, order: 1, spanGaps: false, pointHoverBorderColor: '#FFF' },
            { label: 'Patrimonio Puro (Ahorro Físico)', data: dPuro, borderColor: colors.colorPuro, backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 6], fill: false, order: 2, spanGaps: false },
            { label: 'Capital Invertido Bursátil', data: dInv, borderColor: colors.colorAccent, backgroundColor: this._createGradient(ctx, colors.colorAccent), borderWidth: 3, borderDash: [8, 4], fill: isLightMode, order: 3, spanGaps: false },
            { label: 'Liquidez en Caja', data: dLiq, borderColor: colors.colorUp, backgroundColor: this._createGradient(ctx, colors.colorUp), borderWidth: 3, fill: isLightMode, order: 4, spanGaps: false },
            { label: 'Costo de Vida Acumulado', data: dVida, borderColor: colors.colorVida, backgroundColor: 'transparent', borderWidth: 2, fill: false, order: 5, hidden: true, spanGaps: false },
            { label: 'Media Móvil Costo Vida', data: dMediaVida, borderColor: colors.colorMediaVida, backgroundColor: 'transparent', borderWidth: 3, borderDash: [4, 4], fill: false, order: 6, hidden: true, spanGaps: true },
            { label: 'Inflación Proyectada', data: dInf, borderColor: colors.colorInf, backgroundColor: 'transparent', borderWidth: 3, borderDash: [5, 5], fill: false, order: 7, hidden: true, spanGaps: true }
        ];

        if (chartInstances['chartEvolucion']) {
            const chart = chartInstances['chartEvolucion'];
            chart.data.labels = fFiltradas;
            datasetsConfig.forEach((ds, idx) => {
                chart.data.datasets[idx].data = ds.data;
                chart.data.datasets[idx].backgroundColor = ds.backgroundColor;
                chart.data.datasets[idx].fill = ds.fill;
                chart.data.datasets[idx].borderColor = ds.borderColor;
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
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    animation: { duration: 1200, easing: 'easeOutQuart' },
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
                            ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 12, weight: 'bold', family: "'Inter', sans-serif" } }
                        },
                        y: {
                            beginAtZero: true, border: { display: false },
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
                                    return value;
                                },
                                font: { family: "'Roboto Mono', monospace", size: 12, weight: 'bold' }
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
            { index: 0, label: 'Patrimonio Comercial Neto', color: getCSS('--color-primary', '#6045F4'), hidden: false, tooltip: 'La suma total de liquidez operativa, capital bursátil y valoración del inventario.' },
            { index: 1, label: 'Patrimonio Puro (Ahorro Físico)', color: getCSS('--text-main', '#FFFFFF'), hidden: false, tooltip: 'El flujo de capital aportado excluyendo rendimientos generados o ingresos por ventas.' },
            { index: 2, label: 'Capital Invertido Bursátil', color: getCSS('--color-accent', '#FF4D8A'), hidden: false, tooltip: 'El valor actual de mercado de todos los activos en el portafolio de inversión.' },
            { index: 3, label: 'Liquidez en Caja', color: getCSS('--color-up', '#00FF95'), hidden: false, tooltip: 'Capital circulante no invertido, disponible para cobertura de pasivos operativos.' },
            { index: 4, label: 'Costo de Vida Acumulado', color: getCSS('--color-down', '#F71735'), hidden: true, tooltip: 'Sumatoria histórica de todos los egresos personales y comerciales.' },
            { index: 5, label: 'Media Móvil Costo Vida', color: getCSS('--color-warning', '#FCA311'), hidden: true, tooltip: 'Promedio móvil mensual del índice de egresos generales calculado sobre el histórico.' },
            { index: 6, label: 'Inflación Proyectada', color: getCSS('--color-orange', '#FF871A'), hidden: true, tooltip: 'Índice base estadístico para el cálculo del rendimiento real del patrimonio neto.' }
        ];

        let html = '';
        legendItems.forEach(item => {
            html += `
                <div class="custom-legend-item" data-index="${item.index}" style="display: flex; align-items: center; gap: 8px; cursor: pointer; opacity: ${item.hidden ? 0.4 : 1}; transition: all 0.2s; padding: 4px 8px; border-radius: 8px;">
                    <div class="legend-color-box" style="width: 16px; height: 16px; border-radius: 6px; background-color: ${item.color}; border: 1px solid rgba(255,255,255,0.2); pointer-events: none;"></div>
                    <span class="legend-text" style="font-size: 12px; color: var(--text-main); font-weight: 800; pointer-events: none; letter-spacing: 0.5px;">${item.label}</span>
                    <span data-tooltip-title="${item.label}" data-tooltip-desc="${item.tooltip}" class="legend-tooltip-icon custom-tooltip-trigger" style="color: var(--color-primary); background: var(--bg-input); border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; border: 1px solid var(--border-color); z-index: 10; cursor: help;">?</span>
                </div>
            `;
        });

        legendContainer.innerHTML = html;

        if (!document.getElementById('custom-legend-styles')) {
            const style = document.createElement('style');
            style.id = 'custom-legend-styles';
            style.innerHTML = `
                .floating-legend-tooltip {
                    position: absolute; background: rgba(17, 20, 26, 0.98); color: #F8F9FA; padding: 16px; border-radius: 16px;
                    font-size: 12px; line-height: 1.6; border: 1px solid var(--color-primary); box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(96, 69, 244, 0.2);
                    z-index: 9999; pointer-events: none; width: 260px; transition: opacity 0.2s, transform 0.2s; opacity: 0; transform: translateY(10px);
                }
                [data-theme="light"] .floating-legend-tooltip {
                    background: #FFFFFF; color: #0A0D14; box-shadow: 0 10px 30px rgba(74, 53, 196, 0.15);
                }
                .floating-legend-tooltip.active { opacity: 1; transform: translateY(0); }
                .floating-legend-tooltip strong { color: var(--color-primary); display: block; margin-bottom: 6px; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; }
                .custom-legend-item:hover { background: var(--bg-hover); transform: translateY(-2px); }
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
            
            const rect = helpIcon.getBoundingClientRect();
            let leftPos = rect.left + window.scrollX - (260 / 2) + (rect.width / 2);
            const topPos = rect.top + window.scrollY - 10;

            if (leftPos < 10) leftPos = 10;
            if (leftPos + 260 > window.innerWidth - 10) leftPos = window.innerWidth - 270;

            floatingTooltip.style.left = `${leftPos}px`;
            
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

        legendContainer.querySelectorAll('.custom-legend-item').forEach(item => {
            const helpIcon = item.querySelector('.legend-tooltip-icon');
            const title = helpIcon.getAttribute('data-tooltip-title');
            const desc = helpIcon.getAttribute('data-tooltip-desc');

            helpIcon.addEventListener('mouseenter', () => showTooltip(helpIcon, title, desc));
            helpIcon.addEventListener('mouseleave', hideTooltip);

            helpIcon.addEventListener('touchstart', (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                if (floatingTooltip.classList.contains('active')) hideTooltip();
                else showTooltip(helpIcon, title, desc);
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

        window.addEventListener('scroll', hideTooltip, { passive: true });
        document.addEventListener('touchstart', (e) => {
            if (!e.target.classList.contains('legend-tooltip-icon')) hideTooltip();
        }, { passive: true });
    },

    renderDona(sectorData, actData) {
        const wrapSec = document.getElementById('wrap-dona');
        const wrapAct = document.getElementById('wrap-dona-act');
        if (!wrapSec || !wrapAct) return;

        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

        const commonOptions = {
            responsive: true, maintainAspectRatio: false, 
            cutout: '80%', 
            animation: { duration: 1200, animateScale: true, easing: 'easeOutExpo' },
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
            elements: { 
                arc: { 
                    borderWidth: isLightMode ? 2 : 0, 
                    borderColor: isLightMode ? '#FFFFFF' : 'transparent', 
                    borderRadius: 15,
                    hoverOffset: 12 
                } 
            }
        };
        
        let secLabels = Object.keys(sectorData);
        let secValues = Object.values(sectorData);
        if (secValues.length === 0) {
            wrapSec.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);"><span class="skeleton" style="width:120px;height:120px;border-radius:50%;"></span></div>';
        } else {
            let canvasSec = wrapSec.querySelector('canvas');
            if (!canvasSec) { wrapSec.innerHTML = '<canvas id="chartSector"></canvas>'; canvasSec = wrapSec.querySelector('canvas'); }
            if (chartInstances['chartSector']) chartInstances['chartSector'].destroy();
            chartInstances['chartSector'] = new Chart(canvasSec.getContext('2d'), {
                type: 'doughnut', data: { labels: secLabels, datasets: [{ data: secValues, backgroundColor: paletaEstrategica }] }, options: commonOptions
            });
        }

        let actLabels = Object.keys(actData);
        let actValues = Object.values(actData);
        if (actValues.length === 0) {
            wrapAct.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted);"><span class="skeleton" style="width:120px;height:120px;border-radius:50%;"></span></div>';
        } else {
            let canvasAct = wrapAct.querySelector('canvas');
            if (!canvasAct) { wrapAct.innerHTML = '<canvas id="chartActivo"></canvas>'; canvasAct = wrapAct.querySelector('canvas'); }
            if (chartInstances['chartActivo']) chartInstances['chartActivo'].destroy();
            chartInstances['chartActivo'] = new Chart(canvasAct.getContext('2d'), {
                type: 'doughnut', data: { labels: actLabels, datasets: [{ data: actValues, backgroundColor: paletaEstrategica }] }, options: commonOptions
            });
        }
    },

    renderDistribucionGastos(chartData, wrapDOMId) {
        const wrap = document.getElementById(wrapDOMId);
        if (!wrap) return;

        if (!chartData || !chartData.data || chartData.data.length === 0 || chartData.total === 0) {
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted); flex-direction:column;"><svg width="40" height="40" style="margin-bottom:10px; opacity:0.5;"><use href="#icon-empty"></use></svg><span style="font-weight:bold;">Sin datos en el período</span></div>';
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

        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

        chartInstances[wrapDOMId] = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{ 
                    data: chartData.data, 
                    backgroundColor: paletaEstrategica, 
                    borderWidth: isLightMode ? 2 : 0, 
                    borderColor: isLightMode ? '#FFFFFF' : 'transparent',
                    borderRadius: 15,
                    hoverOffset: 12 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '80%',
                animation: { duration: 1000, animateScale: true, easing: 'easeOutQuart' },
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

        const costosOperativos = gastosLocales + pagosProv;
        const sumatoriaSalidas = gastosPersonales + inver;
        
        let flujoLibreReal = 0;
        let deficitOperativo = 0;
        let deficitEstructural = 0;
        let excedente = 0;

        const links = [];

        if (ingresosBrutos >= costosOperativos) {
            flujoLibreReal = ingresosBrutos - costosOperativos;
            if (costosOperativos > 0) links.push({ source: 'Ingresos', target: 'Costos Op.', value: costosOperativos });
            if (flujoLibreReal > 0) links.push({ source: 'Ingresos', target: 'Flujo Libre', value: flujoLibreReal });
        } else {
            deficitOperativo = costosOperativos - ingresosBrutos;
            if (ingresosBrutos > 0) links.push({ source: 'Ingresos', target: 'Costos Op.', value: ingresosBrutos });
            links.push({ source: 'Ahorros Previos', target: 'Costos Op.', value: deficitOperativo });
        }

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
            'Ingresos': getCSS('--color-up', '#00FF95'),
            'Costos Op.': getCSS('--color-down', '#F71735'),
            'Flujo Libre': getCSS('--color-primary', '#6045F4'),
            'G. Personal': getCSS('--color-orange', '#FF871A'),
            'Inversión': getCSS('--color-accent', '#FF4D8A'),
            'Ahorros Previos': getCSS('--border-color', '#2A2F3A'),
            'Excedente Líquido': getCSS('--color-chart', '#2CE6D6')
        };

        const uniqueNodeIds = [...new Set(links.flatMap(l => [l.source, l.target]))];
        const nodesData = uniqueNodeIds.reduce((acc, id) => {
            acc[id] = baseColors[id] || '#FFFFFF';
            return acc;
        }, {});

        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

        const sankeyConfig = {
            type: 'sankey',
            data: {
                datasets: [{
                    label: `Balance del Flujo (${temporalidad})`,
                    data: links,
                    colorFrom: (c) => c.dataset.data[c.dataIndex].source,
                    colorTo: (c) => c.dataset.data[c.dataIndex].target,
                    colorMode: 'gradient', alpha: 0.85, 
                    labels: uniqueNodeIds.reduce((acc, id) => { acc[id] = id; return acc; }, {}),
                    nodeColors: nodesData,
                    borderWidth: isLightMode ? 2 : 0, 
                    borderColor: '#000000',
                    nodeBorderWidth: isLightMode ? 2 : 1, 
                    nodeBorderColor: isLightMode ? '#000000' : 'rgba(255,255,255,0.3)'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                font: { family: "'Inter', sans-serif", size: 12, weight: 'bold' },
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
            wrap.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted); font-weight:bold;">Sin datos para calcular caída</div>';
            return;
        }

        let canvas = wrap.querySelector('canvas');
        if (!canvas) {
            wrap.innerHTML = '<canvas id="chartDrawdown"></canvas>';
            canvas = wrap.querySelector('canvas');
        }

        const ctx = canvas.getContext('2d');
        const getCSS = (varName, fallBack) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallBack;
        const colorDown = getCSS('--color-down', '#F71735');
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        
        if (chartInstances['chartDrawdown']) chartInstances['chartDrawdown'].destroy();

        chartInstances['chartDrawdown'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataFechas,
                datasets: [{
                    label: 'Drawdown (%)', data: dataDD,
                    borderColor: colorDown, backgroundColor: this._createGradient(ctx, colorDown),
                    borderWidth: 3, fill: 'origin', pointRadius: 0, tension: 0.3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 1000 },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { weight: 'bold', family: "'Inter', sans-serif" } } },
                    y: { 
                        position: 'right', max: 0, grid: { color: isLightMode ? 'rgba(217, 4, 41, 0.1)' : 'rgba(247, 23, 53, 0.1)' },
                        ticks: { callback: function(v) { return v.toFixed(0) + '%'; }, font: { family: "'Roboto Mono', monospace", weight: 'bold' } }
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

        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        
        chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Capital Aportado', data: dAp, backgroundColor: c1, borderRadius: 8, borderWidth: isLightMode?2:0, borderColor: '#000' },
                    { label: 'Interés Compuesto', data: dInt, backgroundColor: c2, borderRadius: 8, borderWidth: isLightMode?2:0, borderColor: '#000' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutBack' },
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { weight: 'bold', family: "'Inter', sans-serif" } } } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { font: { weight: 'bold', family: "'Inter', sans-serif" } } },
                    y: { 
                        stacked: true, border: { display: false },
                        ticks: {
                            callback: function(value) {
                                if(value >= 1000000) return '$' + (value/1000000).toFixed(1) + 'M';
                                if(value >= 1000) return '$' + (value/1000).toFixed(0) + 'k';
                                return '$' + value;
                            },
                            font: { family: "'Roboto Mono', monospace", weight: 'bold' }
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
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    data: dataArr, 
                    borderColor: colorHex, 
                    backgroundColor: isLightMode ? this._createGradient(ctx, colorHex) : 'transparent',
                    borderWidth: 3, 
                    fill: isLightMode,
                    pointRadius: 0, pointHoverRadius: 0, tension: 0.4 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 1200 },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false, min: Math.min(...dataArr) * 0.99, max: Math.max(...dataArr) * 1.01 } },
                layout: { padding: { top: 4, bottom: 4 } }
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
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    data: dataArr, 
                    borderColor: colorHex, 
                    backgroundColor: isLightMode ? this._createGradient(ctx, colorHex) : 'transparent',
                    borderWidth: 2, 
                    fill: isLightMode,
                    pointRadius: 0, tension: 0.3 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                layout: { padding: 2 }
            }
        });
    }
};