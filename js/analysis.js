// js/analysis.js
import { getAvailableDateRange, loadDataForRange } from './data-loader.js';
import { aggregateCustomRange } from './custom-aggregation.js';
import { renderChart } from './chart-renderer.js';
import { formatTimestampToLocalDate } from './utils.js';

// Konfigurácia premenných pre dynamický výber a graf
const VARIABLES = {
    temp: { label: 'Teplota (°C)', unit: '°C', color: '#007bff', yAxisID: 'y' },
    hum: { label: 'Vlhkosť (%)', unit: '%', color: '#17a2b8', yAxisID: 'y1' },
    press: { label: 'Tlak (hPa)', unit: 'hPa', color: '#6f42c1', yAxisID: 'y1' },
    rain: { label: 'Zrážky (mm)', unit: 'mm', color: '#28a745', yAxisID: 'y1' },
    ws: { label: 'Rýchlosť vetra (m/s)', unit: 'm/s', color: '#fd7e14', yAxisID: 'y' },
    wg: { label: 'Nárazy vetra (m/s)', unit: 'm/s', color: '#dc3545', yAxisID: 'y' },
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
    const availableFiles = ['2025_08.json', '2025_09.json'];

    function populateSecondVariableSelect() {
        const selectedVar1 = variableSelect1.value;
        const selectedConfig1 = VARIABLES[selectedVar1];
        
        // Vymažeme staré možnosti
        variableSelect2.innerHTML = '';
        
        // Pridáme možnosť "Žiadna"
        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = 'Žiadna';
        variableSelect2.appendChild(noneOption);

        // Pridáme len kompatibilné možnosti
        for (const [key, config] of Object.entries(VARIABLES)) {
            if (key !== selectedVar1) { // Nezobrazíme tú istú premennú
                const option = document.createElement('option');
                option.value = key;
                option.textContent = config.label;
                variableSelect2.appendChild(option);
            }
        }
    }

    async function init() {
        const { min, max } = await getAvailableDateRange(availableFiles);
        if (min && max) {
            dateFromInput.min = min; dateFromInput.max = max;
            dateToInput.min = min; dateToInput.max = max;
            dateFromInput.value = min; dateToInput.value = max;
        }
        populateSecondVariableSelect(); // Naplníme druhý select pri štarte
        analyzeButton.addEventListener('click', handleAnalysis);
        variableSelect1.addEventListener('change', populateSecondVariableSelect);
    }

    async function handleAnalysis() {
        const var1 = variableSelect1.value;
        const var2 = variableSelect2.value;
        const from = dateFromInput.value;
        const to = dateToInput.value;
        
        if (!from || !to || from > to) { alert('Zvoľte platný rozsah dátumov.'); return; }

        placeholder.innerHTML = '<p>Analyzujem dáta...</p>';
        outputSection.style.display = 'none';

        try {
            const data = await loadDataForRange(from, to, availableFiles);
            if (data.length === 0) { placeholder.innerHTML = '<p>Pre zvolený rozsah neboli nájdené žiadne dáta.</p>'; return; }
            
            const variablesToProcess = [var1];
            if (var2 !== 'none') variablesToProcess.push(var2);

            const result = aggregateCustomRange(data, variablesToProcess);
            
            displaySummary(result.summaries, variablesToProcess);
            renderChart('analysisChart', result.dailyData, variablesToProcess, VARIABLES);
            
            let title = VARIABLES[var1].label;
            if (var2 !== 'none') title += ` a ${VARIABLES[var2].label}`;
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
            const f = (val, dec=1) => (val !== null ? val.toFixed(dec) : '-');
            const t = (ts) => (ts ? `(${formatTimestampToLocalDate(ts)})` : '');

            if (variable === 'rain') {
                html += `
                <div class="summary-box"><h4>Štatistiky Zrážok</h4><div class="data-points">
                    <div class="data-point"><span>Celkový úhrn</span><span class="value">${f(summary.total, 1)} mm</span></div>
                    <div class="data-point"><span>Najvyšší denný úhrn</span><span class="value">${f(summary.max, 1)} mm</span><span class="timestamp">${t(summary.maxTime)}</span></div>
                    <div class="data-point"><span>Priemerný denný úhrn</span><span class="value">${f(summary.avg, 1)} mm</span></div>
                </div></div>`;
            } else {
                 html += `
                 <div class="summary-box"><h4>Štatistiky (${config.label})</h4><div class="data-points">
                    <div class="data-point"><span>Maximum</span><span class="value">${f(summary.max)} ${config.unit}</span><span class="timestamp">${t(summary.maxTime)}</span></div>
                    <div class="data-point"><span>Priemer</span><span class="value">${f(summary.avg)} ${config.unit}</span></div>
                    <div class="data-point"><span>Minimum</span><span class="value">${f(summary.min)} ${config.unit}</span><span class="timestamp">${t(summary.minTime)}</span></div>
                </div></div>`;
            }
        });
        summaryContainer.innerHTML = html;
    }

    init();
});