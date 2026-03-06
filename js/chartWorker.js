"use strict";

self.importScripts('https://cdn.jsdelivr.net/npm/chart.js');

Chart.defaults.color = 'hsl(225, 20%, 61%)';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.elements.line.tension = 0.4; 
Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.point.hoverRadius = 6;
Chart.defaults.scale.grid.color = 'rgba(38, 38, 38, 0.4)';

// CONFIGURACIÓN DE TOOLTIP (Ventana Profesional y Limpia)
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

let evoChart = null;
let currentConfigData = null; 

function createGradient(ctx, color) {
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
    } else if (color.startsWith('rgb')) {
        colorWithAlphaStart = color.replace('rgb', 'rgba').replace(')', ', 0.4)');
        colorWithAlphaEnd = color.replace('rgb', 'rgba').replace(')', ', 0.0)');
    }

    gradient.addColorStop(0, colorWithAlphaStart);
    gradient.addColorStop(1, colorWithAlphaEnd);
    return gradient;
}

function buildChartConfig(ctx, payload) {
    return {
        type: 'line',
        data: {
            labels: payload.fFiltradas,
            datasets: [
                {
                    label: 'Patrimonio Comercial Neto',
                    data: payload.dTotal,
                    borderColor: payload.colors.colorPrimary,
                    backgroundColor: createGradient(ctx, payload.colors.colorPrimary),
                    borderWidth: 3,
                    fill: true,
                    order: 1,
                    spanGaps: false 
                },
                {
                    label: 'Patrimonio Puro (Ahorro Físico)',
                    data: payload.dPuro,
                    borderColor: payload.colors.colorPuro,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    fill: false,
                    order: 2,
                    spanGaps: false
                },
                {
                    label: 'Capital Invertido Bursátil',
                    data: payload.dInv,
                    borderColor: payload.colors.colorAccent,
                    backgroundColor: createGradient(ctx, payload.colors.colorAccent),
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true,
                    order: 3,
                    spanGaps: false
                },
                {
                    label: 'Liquidez en Caja',
                    data: payload.dLiq,
                    borderColor: payload.colors.colorUp,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    fill: false,
                    order: 4,
                    spanGaps: false
                },
                {
                    label: 'Costo de Vida Acumulado',
                    data: payload.dVida,
                    borderColor: payload.colors.colorVida,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    fill: false,
                    order: 5,
                    hidden: true,
                    spanGaps: false
                },
                {
                    label: 'Media Móvil Costo Vida',
                    data: payload.dMediaVida,
                    borderColor: payload.colors.colorMediaVida,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    fill: false,
                    order: 6,
                    hidden: true,
                    spanGaps: true 
                },
                {
                    label: 'Inflación Proyectada',
                    data: payload.dInf,
                    borderColor: payload.colors.colorInf,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    order: 7,
                    hidden: true,
                    spanGaps: true 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
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
                            let formattedValue = currentConfigData.vistaUSD 
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
    };
}

self.onmessage = function(e) {
    const msg = e.data;

    if (msg.type === 'INIT_EVO') {
        const canvas = msg.canvas;
        const ctx = canvas.getContext('2d');
        currentConfigData = { vistaUSD: msg.data.vistaUSD };
        
        const config = buildChartConfig(ctx, msg.data);
        evoChart = new Chart(ctx, config);
        
    } else if (msg.type === 'UPDATE_EVO') {
        if (evoChart) {
            currentConfigData = { vistaUSD: msg.data.vistaUSD };
            
            evoChart.data.labels = msg.data.fFiltradas;
            evoChart.data.datasets[0].data = msg.data.dTotal;
            evoChart.data.datasets[1].data = msg.data.dPuro;
            evoChart.data.datasets[2].data = msg.data.dInv;
            evoChart.data.datasets[3].data = msg.data.dLiq;
            evoChart.data.datasets[4].data = msg.data.dVida;
            evoChart.data.datasets[5].data = msg.data.dMediaVida;
            evoChart.data.datasets[6].data = msg.data.dInf;
            
            evoChart.update('none'); 
        }
    } else if (msg.type === 'TOGGLE_DATASET') {
        if (evoChart) {
            const isVisible = evoChart.isDatasetVisible(msg.index);
            evoChart.setDatasetVisibility(msg.index, !isVisible);
            evoChart.update();
            
            self.postMessage({ 
                type: 'DATASET_TOGGLED', 
                index: msg.index, 
                visible: !isVisible 
            });
        }
    } else if (msg.type === 'RESIZE_CANVAS') {
        if (evoChart) {
            evoChart.resize(msg.width, msg.height);
        }
    }
};