// js/chart-renderer.js

let chartInstance = null;

export function renderChart(canvasId, dailyData, variables, config) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const datasets = variables.map(variable => {
        const varConfig = config[variable];
        return {
            label: varConfig.label,
            data: dailyData.map(d => d.values[variable]),
            borderColor: varConfig.color,
            backgroundColor: `${varConfig.color}20`, // Priesvitná farba pre pozadie
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            yAxisID: varConfig.yAxisID,
        };
    });

    const yAxes = {};
    const uniqueYAxisIDs = [...new Set(datasets.map(ds => ds.yAxisID))];

    uniqueYAxisIDs.forEach((id, index) => {
        yAxes[id] = {
            type: 'linear',
            display: true,
            position: index === 0 ? 'left' : 'right',
            grid: {
                drawOnChartArea: index === 0, // Mriežku kreslíme len pre prvú os
            },
        };
    });
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyData.map(d => d.date.split('-').reverse().join('.')),
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: yAxes,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}
