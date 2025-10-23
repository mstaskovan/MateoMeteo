// js/chart-renderer.js
import { WIND_DIRECTIONS } from './utils.js';

let chartInstance = null;
let windRoseInstance = null;

function formatLabel(timestamp, granularity) {
    const date = new Date(timestamp);
    if (granularity === 'hourly') {
        return date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
    }
    if (granularity === 'weekly') {
        const endDate = new Date(timestamp);
        endDate.setDate(endDate.getDate() + 6);
        return `${date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })}`;
    }
    return date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function renderChart(canvasId, aggregatedPeriods, variables, config, granularity, aggregationMethod) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = aggregatedPeriods.map(p => formatLabel(p.timestamp, granularity));
    let datasets = [];
    const yAxes = {};

    // =======================================================
    // --- ZAČIATOK OPRAVENÉHO BLOKU PRE GRAFY ---
    // =======================================================

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
                { type: 'line', label: 'Priemer', data: aggregatedPeriods.map(p => p.values[variable]?.avg), borderColor: '#28a745', yAxisID: 'y', order: 1 },
                { type: 'line', label: 'Minimum', data: aggregatedPeriods.map(p => p.values[variable]?.min), borderColor: '#64b5f6', yAxisID: 'y', pointRadius: 0, borderWidth: 1, fill: '+1' },
                { type: 'line', label: 'Maximum', data: aggregatedPeriods.map(p => p.values[variable]?.max), borderColor: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', yAxisID: 'y', pointRadius: 0, borderWidth: 1, fill: false }
            ];
        }
        yAxes['y'] = { type: 'linear', display: true, position: 'left' };
    
    } else {
        // *** OPRAVA 2: Logika pre kombinovaný graf (dve premenné) ***
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
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: yAxes,
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y !== null ? c.parsed.y.toFixed(1) : '-'}` } } }
        }
    });
    
    // =======================================================
    // --- KONIEC OPRAVENÉHO BLOKU PRE GRAFY ---
    // =======================================================
}

export function renderWindRoseChart(canvasId, windRoseData) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (windRoseInstance) windRoseInstance.destroy();

    windRoseInstance = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: WIND_DIRECTIONS,
            datasets: [{
                label: 'Frekvencia smeru vetra',
                data: windRoseData,
                backgroundColor: [
                    'rgba(0, 123, 255, 0.7)','rgba(23, 162, 184, 0.7)','rgba(40, 167, 69, 0.7)','rgba(255, 193, 7, 0.7)',
                    'rgba(220, 53, 69, 0.7)','rgba(108, 117, 125, 0.7)','rgba(0, 123, 255, 0.7)','rgba(23, 162, 184, 0.7)',
                    'rgba(40, 167, 69, 0.7)','rgba(255, 193, 7, 0.7)','rgba(220, 53, 69, 0.7)','rgba(108, 117, 125, 0.7)',
                    'rgba(0, 123, 255, 0.7)','rgba(23, 162, 184, 0.7)','rgba(40, 167, 69, 0.7)','rgba(255, 193, 7, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { ticks: { backdropColor: 'rgba(255, 255, 255, 0.75)', callback: (value) => value + ' %' } } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw.toFixed(1)} %` } } }
        }
    });
}
