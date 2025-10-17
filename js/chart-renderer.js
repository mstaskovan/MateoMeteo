// js/chart-renderer.js

let chartInstance = null;

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

    // Režim 1: Detailná analýza (len 1 premenná)
    if (variables.length === 1) {
        const variable = variables[0];
        const varConfig = config[variable];
        
        datasets = [
            // =======================================================
            // ZMENA: Krivka PRIEMERU je teraz vždy zelená a má jednoduchý názov
            // =======================================================
            {
                label: 'Priemer', // Zjednodušený názov
                data: aggregatedPeriods.map(p => p.values[variable]?.avg),
                borderColor: '#28a745', // Napevno nastavená zelená farba
                yAxisID: 'y',
                order: 1
            },
            // Krivka MINIMA
            {
                label: 'Minimum',
                data: aggregatedPeriods.map(p => p.values[variable]?.min),
                borderColor: '#64b5f6',
                yAxisID: 'y',
                pointRadius: 0,
                borderWidth: 1,
                fill: '+1'
            },
            // Krivka MAXIMA
            {
                label: 'Maximum',
                data: aggregatedPeriods.map(p => p.values[variable]?.max),
                borderColor: '#f87171',
                backgroundColor: 'rgba(248, 113, 113, 0.1)',
                yAxisID: 'y',
                pointRadius: 0,
                borderWidth: 1,
                fill: false
            }
        ];
        yAxes['y'] = { type: 'linear', display: true, position: 'left' };

    // Režim 2: Korelačná analýza (zostáva bez zmeny)
    } else {
        const uniqueYAxisIDs = [...new Set(variables.map(v => config[v].yAxisID))];
        datasets = variables.map(variable => {
            const varConfig = config[variable];
            return {
                label: varConfig.label,
                data: aggregatedPeriods.map(p => p.values[variable]?.[aggregationMethod[variable]]),
                borderColor: varConfig.color,
                backgroundColor: `${varConfig.color}20`,
                yAxisID: varConfig.yAxisID,
            };
        });
        uniqueYAxisIDs.forEach((id, index) => {
            yAxes[id] = {
                type: 'linear', display: true, position: index === 0 ? 'left' : 'right',
                grid: { drawOnChartArea: index === 0 }
            };
        });
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: yAxes,
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y !== null ? c.parsed.y.toFixed(1) : '-'}` } } }
        }
    });
}
