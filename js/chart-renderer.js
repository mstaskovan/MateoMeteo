// js/chart-renderer.js
import { WIND_DIRECTIONS } from './utils.js';

let chartInstance = null;
let windRoseInstance = null;

function formatLabel(timestamp, granularity) { /* ... bez zmeny ... */ }

export function renderChart(canvasId, aggregatedPeriods, variables, config, granularity, aggregationMethod) {
    // ... (Táto funkcia zostáva bez zmeny, ale je tu pre úplnosť)
}

/**
 * NOVÁ FUNKCIA: Vykreslí graf veternej ružice.
 */
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
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    ticks: {
                        backdropColor: 'rgba(255, 255, 255, 0.75)',
                        callback: function(value) { return value + ' %' }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw.toFixed(1)} %`;
                        }
                    }
                }
            }
        }
    });
}
