// js/analysis.js
import { fetchAvailableFiles, getAvailableDateRange, loadDataForRange } from './data-loader.js';
import { aggregateCustomRange } from './custom-aggregation.js';
import { renderChart, renderWindRoseChart } from './chart-renderer.js';
import { formatDateTime, generateAvailableDataString } from './utils.js';

const VARIABLES = {
    // ... (konštanta VARIABLES zostáva bez zmeny)
};

document.addEventListener('DOMContentLoaded', async () => {
    // ... definície premenných ...
    
    let availableFiles = [];

    function populateSecondVariableSelect() { /* ... bez zmeny ... */ }
    async function init() { /* ... bez zmeny ... */ }
    
    async function handleAnalysis() {
        const var1 = variableSelect1.value;
        const var2 = variableSelect2.value;
        const from = dateFromInput.value;
        const to = dateToInput.value;
        if (!from || !to || from > to) { alert('Zvoľte platný rozsah dátumov.'); return; }
        
        const rangeInDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24) + 1;
        placeholder.style.display = 'block'; placeholder.innerHTML = '<p>Analyzujem dáta...</p>';
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
            analysisPeriodSpan.textContent = `od ${formatDateTime(from, 'DD. MM. YYYY')} do ${formatDateTime(to, 'DD. MM. YYYY')}`;
            
            placeholder.style.display = 'none';
            outputSection.style.display = 'block';
        } catch (error) {
            console.error('Chyba pri analýze:', error);
            placeholder.innerHTML = `<p class="error">Nastala chyba: ${error.message}</p>`;
        }
    }

    function displaySummary(summaries, variables) { /* ... bez zmeny ... */ }

    init();
});
