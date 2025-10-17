// js/chart-renderer.js
import { WIND_DIRECTIONS } from './utils.js';

let chartInstance = null;
let windRoseInstance = null;

function formatLabel(timestamp, granularity) { /* ... bez zmeny ... */ }

export function renderChart(canvasId, aggregatedPeriods, variables, config, granularity, aggregationMethod) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = aggregatedPeriods.map(p => formatLabel(p.timestamp, granularity));
    let datasets = [];
    const yAxes = {};
    
    const isRainChart = variables.length === 1 && variables[0] === 'rain';

    if (isRainChart) {
        const varConfig = config['rain'];
        datasets.push({
            type: 'bar',
            label: varConfig.label,
            data: aggregatedPeriods.map(p => p.values.rain?.sum),
            backgroundColor: `${varConfig.color}90`,
            borderColor: varConfig.color,
            yAxisID: 'y',
        });
        yAxes['y'] = { type: 'linear', display: true, position: 'left', beginAtZero: true };
    } else if (variables.length === 1) {
        const variable = variables[0];
        datasets = [
            { label: 'Priemer', data: aggregatedPeriods.map(p => p.values[variable]?.avg), borderColor: '#28a745', yAxisID: 'y', order: 1 },
            { label: 'Minimum', data: aggregatedPeriods.map(p => p.values[variable]?.min), borderColor: '#64b5f6', yAxisID: 'y', pointRadius: 0, borderWidth: 1, fill: '+1' },
            { label: 'Maximum', data: aggregatedPeriods.map(p => p.values[variable]?.max), borderColor: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', yAxisID: 'y', pointRadius: 0, borderWidth: 1, fill: false }
        ];
        yAxes['y'] = { type: 'linear', display: true, position: 'left' };
    } else {
        const uniqueYAxisIDs = [...new Set(variables.map(v => config[v].yAxisID))];
        datasets = variables.map(variable => {
            const varConfig = config[variable];
            return {
                type: 'line',
                label: varConfig.label,
                data: aggregatedPeriods.map(p => p.values[variable]?.[aggregationMethod[variable]]),
                borderColor: varConfig.color,
                backgroundColor: `${varConfig.color}20`,
                yAxisID: varConfig.yAxisID,
            };
        });
        uniqueYAxisIDs.forEach((id, index) => { yAxes[id] = { type: 'linear', display: true, position: index === 0 ? 'left' : 'right', grid: { drawOnChartArea: index === 0 } }; });
    }

    chartInstance = new Chart(ctx, {
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: yAxes,
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y !== null ? c.parsed.y.toFixed(1) : '-'}` } } }
        }
    });
}

export function renderWindRoseChart(canvasId, windRoseData) { /* ... bez zmeny ... */ }
