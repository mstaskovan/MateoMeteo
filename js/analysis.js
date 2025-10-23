// js/analysis.js
import { fetchAvailableFiles, getAvailableDateRange, loadDataForRange } from './data-loader.js';
import { aggregateCustomRange } from './custom-aggregation.js';
import { renderChart, renderWindRoseChart } from './chart-renderer.js';

// --- UPRAVENÝ RIADOK: Importujeme novú funkciu 'formatTimestampToDisplayDate' ---
import { formatTimestampToDisplayDate, generateAvailableDataString } from './utils.js';

const VARIABLES = {
    temp: { label: 'Teplota (°C)', unit: '°C', color: '#007bff', yAxisID: 'y' },
    hum: { label: 'Vlhkosť (%)', unit: '%', color: '#17a2b8', yAxisID: 'y1' },
    press: { label: 'Tlak (hPa)', unit: 'hPa', color: '#6f42c1', yAxisID: 'y1' },
    rain: { label: 'Zrážky (mm)', unit: 'mm', color: '#28a745', yAxisID: 'y1' },
    ws: { label: 'Rýchlosť vetra (m/s)', unit: 'm/s', color: '#fd7e14', yAxisID: 'y' },
    wg: { label: 'Nárazy vetra (m/s)', unit: 'm/s', color: '#dc3545', yAxisID: 'y' },
    sr: { label: 'Solárne žiarenie (W/m²)', unit: 'W/m²', color: '#ffc107', yAxisID: 'y' },
    uv: { label: 'UV Index', unit: '', color: '#9e3bc7', yAxisID: 'y1' },
};

document.addEventListener('DOMContentLoaded', async () => {
    const variableSelect1 = document.getElementById('variableSelect1');
    const variableSelect2 = document.getElementById('variableSelect2');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const analyzeButton = document.getElementById('analyzeButton');
    const outputSection = document.getElementById('analysis-output');
    const placeholder = document.getElementById('placeholder-analysis');
    const summaryContainer = document.getElementById('analysis-summary');
    const variableNameSpan = document.getElementById('variable-name');
    const availabilityInfo = document.getElementById('data-availability-analysis');
    const windRoseContainer = document.getElementById('wind-rose-container');
    
    let availableFiles = [];

    function populateSecondVariableSelect() {
        const selectedVar1 = variableSelect1.value;
        const currentVar2 = variableSelect2.value;
        variableSelect2.innerHTML = '';
        
        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = 'Žiadna';
        variableSelect2.appendChild(noneOption);
        
        let isCurrentVar2Compatible = false;
        for (const [key, config] of Object.entries(VARIABLES)) {
            if (key !== selectedVar1) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = config.label;
                variableSelect2.appendChild(option);
                if (key === currentVar2) {
                    isCurrentVar2Compatible = true;
                }
            }
        }
        variableSelect2.value = isCurrentVar2Compatible ? currentVar2 : 'none';
    }

    async function init() {
        Object.keys(VARIABLES).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = VARIABLES[key].label;
            variableSelect1.appendChild(option);
        });

        availableFiles = await fetchAvailableFiles();
        const availableDataText = generateAvailableDataString(availableFiles);
        if (availabilityInfo) {
            availabilityInfo.innerHTML = `<p>Dostupné dáta: ${availableDataText}</p>`;
        }
        
        const { min, max } = await getAvailableDateRange(availableFiles);
        if (min && max) {
            dateFromInput.min = min;
            dateFromInput.max = max;
            dateToInput.min = min;
            dateToInput.max = max;

            const formatDate = (d) => d.toISOString().split('T')[0];
            const endDate = new Date();
            endDate.setDate(0); // Posledný deň predch. mesiaca
            const startDate = new Date(endDate);
            startDate.setMonth(startDate.getMonth() - 11);
            startDate.setDate(1);
            dateFromInput.value = formatDate(startDate);
            dateToInput.value = formatDate(endDate);
        } else {
            analyzeButton.disabled = true;
            placeholder.innerHTML = `<p>Neboli nájdené žiadne dátové súbory.</p>`;
        }

        populateSecondVariableSelect();
        analyzeButton.addEventListener('click', handleAnalysis);
        variableSelect1.addEventListener('change', populateSecondVariableSelect);
    }
    
    async function handleAnalysis() {
        const var1 = variableSelect1.value;
        const var2 = variableSelect2.value;
        const from = dateFromInput.value;
        const to = dateToInput.value;
        if (!from || !to || from > to) {
            alert('Zvoľte platný rozsah dátumov.');
            return;
        }
        
        const rangeInDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24) + 1;
        placeholder.style.display = 'block';
        placeholder.innerHTML = '<p>Analyzujem dáta...</p>';
        outputSection.style.display = 'none';
        windRoseContainer.style.display = 'none';

        try {
            const data = await loadDataForRange(from, to, availableFiles);
            if (data.length === 0) {
                placeholder.innerHTML = '<p>Pre zvolený rozsah neboli nájdené žiadne dáta.</p>';
                return;
            }
            
            const variablesToProcess = [var1];
            if (var2 !== 'none') {
                variablesToProcess.push(var2);
            }

            const result = aggregateCustomRange(data, variablesToProcess, rangeInDays);
            
            displaySummary(result.summaries, variablesToProcess);
            renderChart('analysisChart', result.aggregatedPeriods, variablesToProcess, VARIABLES, result.granularity, result.aggregationMethod);
            
            if ((var1 === 'ws' || var1 === 'wg') && result.windRoseData) {
                renderWindRoseChart('windRoseChart', result.windRoseData);
                windRoseContainer.style.display = 'block';
            }
            
            let title = VARIABLES[var1].label;
            if (var2 !== 'none') {
                title += ` vs. ${VARIABLES[var2].label}`;
            }
            variableNameSpan.textContent = title;
            
            placeholder.style.display = 'none';
            outputSection.style.display = 'block';
        } catch (error) {
            console.error('Chyba pri analýze:', error);
            placeholder.innerHTML = `<p class="error">Nastala chyba: ${error.message}</p>`;
        }
    }

    function displaySummary(summaries, variables) {
        let html = '';
        variables.forEach(variable => {
            const summary = summaries[variable];
            const config = VARIABLES[variable];
            const f = (val, dec = 1) => (val !== null ? val.toFixed(dec) : '-');
            
            // --- UPRAVENÝ RIADOK: Používame 'formatTimestampToDisplayDate' ---
            const t = (ts) => (ts ? `${formatTimestampToDisplayDate(ts)}` : '');

            let minLabel = 'Minimum';
            if (variable === 'ws' || variable === 'wg') {
                minLabel = 'Minimum > 0';
            }

            html += `<div class="summary-box"><h4>Súhrn - ${config.label}</h4><div class="data-points">`;
            
            if (variable === 'rain') {
                html += `<div class="data-point data-point-avg"><span>Celkový úhrn</span><span class="value">${f(summary.total, 1)} mm</span></div>
                         <div class="data-point data-point-max"><span>Najvyšší denný úhrn</span><span class="value">${f(summary.max, 1)} mm</span><span class="timestamp">${t(summary.maxTime)}</span></div>`;
            } else {
                 html += `<div class="data-point data-point-max"><span>Maximum</span><span class="value">${f(summary.max, 1)} ${config.unit}</span><span class="timestamp">${t(summary.maxTime)}</span></div>
                          <div class="data-point data-point-avg"><span>Priemer</span><span class="value">${f(summary.avg, 1)} ${config.unit}</span></div>
                          <div class="data-point data-point-min"><span>${minLabel}</span><span class="value">${f(summary.min, 1)} ${config.unit}</span><span class="timestamp">${t(summary.minTime)}</span></div>`;
            }
            html += `</div></div>`;
        });
        summaryContainer.innerHTML = html;
    }

    init();
});
