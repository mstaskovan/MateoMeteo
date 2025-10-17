// js/chart-renderer.js
import { WIND_DIRECTIONS } from './utils.js';

let chartInstance = null;
let windRoseInstance = null; // Nová premenná pre druhý graf

function formatLabel(timestamp, granularity) { /* ... (bez zmeny) ... */ const date=new Date(timestamp);if("hourly"===granularity)return date.toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"});if("weekly"===granularity){const endDate=new Date(timestamp);return endDate.setDate(endDate.getDate()+6),`${date.toLocaleDateString("sk-SK",{day:"2-digit",month:"2-digit"})} - ${endDate.toLocaleDateString("sk-SK",{day:"2-digit",month:"2-digit"})}`}return date.toLocaleDateString("sk-SK",{day:"2-digit",month:"2-digit",year:"numeric"})}

export function renderChart(canvasId, aggregatedPeriods, variables, config, granularity, aggregationMethod) {
    // ... (Táto funkcia zostáva bez zmeny, ale je tu pre úplnosť)
    const ctx=document.getElementById(canvasId).getContext("2d");chartInstance&&chartInstance.destroy();const labels=aggregatedPeriods.map(p=>formatLabel(p.timestamp,granularity));let datasets=[];const yAxes={};if(1===variables.length){const variable=variables[0];datasets=[{label:"Priemer",data:aggregatedPeriods.map(p=>p.values[variable]?.avg),borderColor:"#28a745",yAxisID:"y",order:1},{label:"Minimum",data:aggregatedPeriods.map(p=>p.values[variable]?.min),borderColor:"#64b5f6",yAxisID:"y",pointRadius:0,borderWidth:1,fill:"+1"},{label:"Maximum",data:aggregatedPeriods.map(p=>p.values[variable]?.max),borderColor:"#f87171",backgroundColor:"rgba(248, 113, 113, 0.1)",yAxisID:"y",pointRadius:0,borderWidth:1,fill:!1}],yAxes.y={type:"linear",display:!0,position:"left"}}else{const uniqueYAxisIDs=[...new Set(variables.map(v=>config[v].yAxisID))];datasets=variables.map(variable=>{const varConfig=config[variable];return{label:varConfig.label,data:aggregatedPeriods.map(p=>p.values[variable]?.[aggregationMethod[variable]]),borderColor:varConfig.color,backgroundColor:`${varConfig.color}20`,yAxisID:varConfig.yAxisID}}),uniqueYAxisIDs.forEach((id,index)=>{yAxes[id]={type:"linear",display:!0,position:0===index?"left":"right",grid:{drawOnChartArea:0===index}})}chartInstance=new Chart(ctx,{type:"line",data:{labels,datasets},options:{responsive:!0,maintainAspectRatio:!1,interaction:{mode:"index",intersect:!1},scales:yAxes,plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${null!==c.parsed.y?c.parsed.y.toFixed(1):"-"}`}}}}})}

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
                    'rgba(0, 123, 255, 0.7)', 'rgba(23, 162, 184, 0.7)', 'rgba(40, 167, 69, 0.7)', 'rgba(255, 193, 7, 0.7)',
                    'rgba(220, 53, 69, 0.7)', 'rgba(108, 117, 125, 0.7)', 'rgba(0, 123, 255, 0.7)', 'rgba(23, 162, 184, 0.7)',
                    'rgba(40, 167, 69, 0.7)', 'rgba(255, 193, 7, 0.7)', 'rgba(220, 53, 69, 0.7)', 'rgba(108, 117, 125, 0.7)',
                    'rgba(0, 123, 255, 0.7)', 'rgba(23, 162, 184, 0.7)', 'rgba(40, 167, 69, 0.7)', 'rgba(255, 193, 7, 0.7)'
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
