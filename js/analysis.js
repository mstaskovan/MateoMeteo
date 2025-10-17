// js/analysis.js
// ... (importy a konštanta VARIABLES zostávajú bez zmeny) ...

document.addEventListener('DOMContentLoaded', async () => {
    // ... (definície premenných zostávajú bez zmeny) ...

    function populateSecondVariableSelect() { /* ... bez zmeny ... */ }
    async function init() { /* ... bez zmeny ... */ }
    
    async function handleAnalysis() {
        // ... (logika zostáva bez zmeny, až po displaySummary) ...
        
        // ZMENA: Upravíme, aby sme do výpočtu vždy pridali 'rr', ak sú zvolené zrážky
        const variablesToProcess = [var1];
        if (var2 !== 'none') variablesToProcess.push(var2);
        if (var1 === 'rain' && !variablesToProcess.includes('rr')) variablesToProcess.push('rr');

        const result = aggregateCustomRange(data, variablesToProcess, rangeInDays);
            
        displaySummary(result.summaries, variablesToProcess, result.granularity);
        // ... (zvyšok funkcie bez zmeny) ...
    }

    function displaySummary(summaries, variables, granularity) {
        let html = '';
        // Odfiltrujeme pomocnú premennú 'rr', aby sa pre ňu nevytváral box
        variables.filter(v => v !== 'rr').forEach(variable => {
            const summary = summaries[variable];
            const config = VARIABLES[variable];
            const f = (val, dec = 1) => (val !== null ? val.toFixed(dec) : '-');
            const t = (ts) => (ts ? `${formatDateTime(ts, 'DD.MM.YYYY HH:mm')}` : '');
            let minLabel = "Minimum";
            if (variable === 'ws' || variable === 'wg') minLabel = "Minimum > 0";

            html += `<div class="summary-box"><h4>Súhrn (${config.label})</h4><div class="data-points">`;
            
            if (variable === 'rain') {
                const periodLabel = granularity === 'hourly' ? 'hodinový' : 'denný';
                html += `<div class="data-point data-point-avg"><span>Celkový úhrn</span><span class="value">${f(summary.total, 1)} mm</span></div>
                         <div class="data-point data-point-max"><span>Najvyšší ${periodLabel} úhrn</span><span class="value">${f(summary.max, 1)} mm</span><span class="timestamp">${formatDateTime(summary.maxTime, "DD.MM.YYYY")}</span></div>
                         <div class="data-point data-point-max"><span>Max. intenzita</span><span class="value">${f(summaries.rr?.max, 1)} mm/h</span></div>`; // NOVÝ RIADOK
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
