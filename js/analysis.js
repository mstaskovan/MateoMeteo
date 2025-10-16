// js/analysis.js
import { fetchAvailableFiles, getAvailableDateRange, loadDataForRange } from './data-loader.js';
import { aggregateCustomRange } from './custom-aggregation.js';
import { renderChart } from './chart-renderer.js';
import { formatTimestampToLocalDate, generateAvailableDataString } from './utils.js';

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
    const availabilityInfo = document.getElementById('data-availability-analysis');
    
    let availableFiles = [];

    function populateSecondVariableSelect() { /* ... (bez zmeny) ... */ const selectedVar1=variableSelect1.value;variableSelect2.innerHTML="";const noneOption=document.createElement("option");noneOption.value="none",noneOption.textContent="Žiadna",variableSelect2.appendChild(noneOption);for(const[key,config]of Object.entries(VARIABLES))if(key!==selectedVar1){const option=document.createElement("option");option.value=key,option.textContent=config.label,variableSelect2.appendChild(option)}}

    async function init() {
        availableFiles = await fetchAvailableFiles();
        
        const availableDataText = generateAvailableDataString(availableFiles);
        if (availabilityInfo) {
            availabilityInfo.innerHTML = `<p>Dostupné dáta: ${availableDataText}</p>`;
        }

        const { min, max } = await getAvailableDateRange(availableFiles);

        // =======================================================
        // ZMENA: Nastavenie predvoleného rozsahu na posledných 12 mesiacov
        // =======================================================
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const today = new Date();
        // Dátum "do" je posledný deň predchádzajúceho mesiaca
        const endDate = new Date(today.getFullYear(), today.getMonth(), 0);

        // Dátum "od" je o 12 mesiacov skôr, nastavený na prvý deň daného mesiaca
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);
        
        const lastDayValue = formatDate(endDate);
        const firstDayValue = formatDate(startDate);
        // =======================================================
        
        if (min && max) {
            dateFromInput.min = min; dateFromInput.max = max;
            dateToInput.min = min; dateToInput.max = max;
            
            // Aplikujeme vypočítané predvolené hodnoty
            dateFromInput.value = firstDayValue;
            dateToInput.value = lastDayValue;
        } else {
            analyzeButton.disabled = true;
            placeholder.innerHTML = `<p>Neboli nájdené žiadne dátové súbory. Skontrolujte súbor manifest.json.</p>`;
        }

        populateSecondVariableSelect();
        analyzeButton.addEventListener('click', handleAnalysis);
        variableSelect1.addEventListener('change', populateSecondVariableSelect);
    }

    async function handleAnalysis() { /* ... (bez zmeny) ... */ const var1=variableSelect1.value,var2=variableSelect2.value,from=dateFromInput.value,to=dateToInput.value;if(!from||!to||from>to)return void alert("Zvoľte platný rozsah dátumov.");placeholder.style.display="block",placeholder.innerHTML="<p>Analyzujem dáta...</p>",outputSection.style.display="none";try{const data=await loadDataForRange(from,to,availableFiles);if(0===data.length)return void(placeholder.innerHTML="<p>Pre zvolený rozsah neboli nájdené žiadne dáta.</p>");const variablesToProcess=[var1];"none"!==var2&&variablesToProcess.push(var2);const result=aggregateCustomRange(data,variablesToProcess);displaySummary(result.summaries,variablesToProcess),renderChart("analysisChart",result.dailyData,variablesToProcess,VARIABLES);let title=VARIABLES[var1].label;"none"!==var2&&(title+=` a ${VARIABLES[var2].label}`),variableNameSpan.textContent=title,placeholder.style.display="none",outputSection.style.display="block"}catch(error){console.error("Chyba pri analýze:",error),placeholder.innerHTML=`<p class="error">Nastala chyba: ${error.message}</p>`}}
    function displaySummary(summaries, variables) { /* ... (bez zmeny) ... */ let html="";variables.forEach(variable=>{const summary=summaries[variable],config=VARIABLES[variable],f=(val,dec=1)=>null!==val?val.toFixed(dec):"-",t=ts=>ts?`(${formatTimestampToLocalDate(ts)})`:"";html+="rain"===variable?`<div class="summary-box"><h4>Štatistiky Zrážok</h4><div class="data-points"><div class="data-point data-point-max"><span>Najvyšší denný úhrn</span><span class="value">${f(summary.max,1)} mm</span><span class="timestamp">${t(summary.maxTime)}</span></div><div class="data-point data-point-avg"><span>Priemerný denný úhrn</span><span class="value">${f(summary.avg,1)} mm</span></div></div><div class="data-point"><span>Celkový úhrn</span><span class="value">${f(summary.total,1)} mm</span></div></div>`:`<div class="summary-box"><h4>Štatistiky (${config.label})</h4><div class="data-points"><div class="data-point data-point-max"><span>Maximum</span><span class="value">${f(summary.max)} ${config.unit}</span><span class="timestamp">${t(summary.maxTime)}</span></div><div class="data-point data-point-avg"><span>Priemer</span><span class="value">${f(summary.avg)} ${config.unit}</span></div><div class="data-point data-point-min"><span>Minimum</span><span class="value">${f(summary.min)} ${config.unit}</span><span class="timestamp">${t(summary.minTime)}</span></div></div></div>`}),summaryContainer.innerHTML=html}

    init();
});

