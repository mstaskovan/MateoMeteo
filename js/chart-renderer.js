// js/chart-renderer.js
import { formatLabel } from './utils.js';

let chartInstance = null; // Globálna referencia na inštanciu grafu

/**
 * Zničí existujúcu inštanciu grafu, ak existuje.
 */
export function destroyChart() {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}

/**
 * Vykreslí graf na základe agregovaných dát.
 * @param {string} canvasId - ID elementu <canvas>
 * @param {Array} aggregatedPeriods - Dáta z custom-aggregation.js
 * @param {Array} variables - Pole vybraných premenných (napr. ['temp'])
 * @param {Object} config - Konfigurácia premenných (farby, osi...)
 * @param {string} granularity - 'hourly', 'daily', 'weekly'
 * @param {Object} aggregationMethod - Metódy agregácie (napr. {temp: 'avg'})
 */
export function renderChart(canvasId, aggregatedPeriods, variables, config, granularity, aggregationMethod) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = aggregatedPeriods.map(p => formatLabel(p.timestamp, granularity));
    let datasets = [];
    const yAxes = {};

    // Určíme základný typ grafu. Ak sú v ňom zrážky, základ bude "bar".
    const baseType = variables.includes('rain') ? 'bar' : 'line';

    if (variables.length === 1) {
        const variable = variables[0];
        
        if (variable === 'rain') {
            // *** OPRAVA 1: Logika pre samostatný graf zrážok ***
            const method = aggregationMethod[variable]; // Malo by byť 'sum'
            datasets = [
                { 
                    type: 'bar',
                    label: 'Úhrn zrážok', 
                    data: aggregatedPeriods.map(p => p.values[variable]?.[method]), 
                    backgroundColor: `${config[variable].color}B3`, // Mierne priehľadná
                    borderColor: config[variable].color,
                    borderWidth: 1,
                    yAxisID: 'y' 
                }
            ];
        } else {
            // *** Pôvodná logika pre ostatné premenné (teplota, tlak, atď.) ***
            datasets = [
                { 
                    label: 'Priemer', 
                    data: aggregatedPeriods.map(p => p.values[variable]?.avg), 
                    borderColor: '#28a745', 
                    yAxisID: 'y', 
                    order: 1,
                    type: 'line'
                },
                { 
                    label: 'Minimum', 
                    data: aggregatedPeriods.map(p => p.values[variable]?.min), 
                    borderColor: '#64b5f6', 
                    yAxisID: 'y', 
                    pointRadius: 0, 
                    borderWidth: 1, 
                    fill: '+1',
                    type: 'line'
                },
                { 
                    label: 'Maximum', 
                    data: aggregatedPeriods.map(p => p.values[variable]?.max), 
                    borderColor: '#f87171', 
                    backgroundColor: 'rgba(248, 113, 113, 0.1)', 
                    yAxisID: 'y', 
                    pointRadius: 0, 
                    borderWidth: 1, 
                    fill: false,
                    type: 'line' 
                }
            ];
        }
        yAxes['y'] = { type: 'linear', display: true, position: 'left' };
    
    } else {
        // *** OPRAVA 2: Logika pre kombinovaný graf ***
        const uniqueYAxisIDs = [...new Set(variables.map(v => config[v].yAxisID))];
        datasets = variables.map(variable => {
            const varConfig = config[variable];
            
            // Ak je premenná 'rain', typ je 'bar', inak 'line'
            const type = (variable === 'rain') ? 'bar' : 'line';
            
            return {
                type: type, // Typ špecifický pre dataset
                label: varConfig.label,
                data: aggregatedPeriods.map(p => p.values[variable]?.[aggregationMethod[variable]]),
                borderColor: varConfig.color,
                backgroundColor: (type === 'bar') ? `${varConfig.color}B3` : `${varConfig.color}20`,
                yAxisID: varConfig.yAxisID,
                order: (type === 'line') ? 0 : 1 // Čiary sa vykreslia nad stĺpce
            };
        });
        uniqueYAxisIDs.forEach((id, index) => {
            yAxes[id] = { type: 'linear', display: true, position: index === 0 ? 'left' : 'right', grid: { drawOnChartArea: index === 0 } };
        });
    }

    chartInstance = new Chart(ctx, {
        type: baseType, // Tu použijeme základný typ (bar alebo line)
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, 
            interaction: { 
                mode: 'index', 
                intersect: false 
            },
            scales: yAxes,
            plugins: { 
                tooltip: { 
                    callbacks: { 
                        label: (c) => `${c.dataset.label}: ${c.parsed.y !== null ? c.parsed.y.toFixed(1) : '-'}` 
                    } 
                } 
            }
        }
    });
}
