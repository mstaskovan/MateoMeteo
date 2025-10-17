// js/main.js
import { aggregateHourlyData, aggregateDailyData } from './aggregation-methods.js';
import { fetchAvailableFiles, getAvailableDateRange } from './data-loader.js';
// ZMENA: Importujeme novú funkciu
import { degToCard, formatDateTime, generateAvailableDataString } from './utils.js'; 

document.addEventListener('DOMContentLoaded', () => {
    const viewMode = document.getElementById('viewMode'); const dateInput = document.getElementById('dateInput'); const loadDataButton = document.getElementById('loadDataButton'); const selectedPeriodSpan = document.getElementById('selected-period'); const jsonOutput = document.getElementById('json-data'); const dashboard = document.getElementById('summary-dashboard'); const availabilityInfo = document.getElementById('data-availability'); let loadedDataCache = {}; let availableFiles = [];

    async function loadAndDisplayData() {
        const mode = viewMode.value;
        const rawDate = dateInput.value;
        
        if (!rawDate) {
            jsonOutput.innerHTML = '<p class="error">Vyberte prosím dátum alebo mesiac.</p>';
            dashboard.style.display = 'none';
            return;
        }

        // =======================================================
        // ZMENA: Formátovanie textu pre zvolené obdobie
        // =======================================================
        if (mode === 'day') {
            selectedPeriodSpan.textContent = formatDateTime(rawDate, 'DD. MM. YYYY');
        } else {
            selectedPeriodSpan.textContent = formatDateTime(rawDate, 'Month YYYY');
        }
        // =======================================================
        
        const [year, month] = rawDate.split('-');
        const fileName = `${year}_${month}.json`;
        jsonOutput.innerHTML = "<p>Načítavam dáta...</p>";
        dashboard.style.display = "none";

        try {
            let data = loadedDataCache[fileName];
            if (!data) {
                const response = await fetch(`data/${fileName}`);
                if (!response.ok) { jsonOutput.innerHTML = `<p class="error">Chyba: Dáta pre ${month}/${year} neboli nájdené.</p>`; return; }
                data = await response.json();
                loadedDataCache[fileName] = data;
            }
            const aggregationResult = mode === "day" ? aggregateHourlyData(data, rawDate) : aggregateDailyData(data, rawDate.substring(0, 7));
            if (!aggregationResult || aggregationResult.data.length === 0) { jsonOutput.innerHTML = `<p>Pre zvolené obdobie neboli nájdené žiadne záznamy.</p>`; return; }
            displaySummaryData(aggregationResult.summary, mode);
            displayDataInTable(aggregationResult.data, aggregationResult.mode);
        } catch (error) { console.error("Nastala chyba pri spracovaní dát:", error); jsonOutput.innerHTML = `<p class="error">Vyskytla sa kritická chyba: ${error.message}</p>`; }
    }
    
    function displaySummaryData(summary, mode) {
        if (!summary) { dashboard.style.display = 'none'; return; }
        const timeFormatter = ts => ts ? (mode === 'day' ? formatDateTime(ts, 'HH:mm') : formatDateTime(ts, 'DD.MM.')) : '';
        const updateText = (id, value, unit = '', decimals = 1, time = null) => {
            const valueEl = document.getElementById(id); const timeEl = document.getElementById(`${id}-time`);
            if (valueEl) valueEl.textContent = value !== null ? ` ${value.toFixed(decimals)} ${unit}` : ' -';
            if (timeEl) timeEl.textContent = timeFormatter(time);
        };
        updateText('summary-temp-max', summary.tempMax, '°C', 1, summary.tempMaxTime); updateText('summary-temp-avg', summary.tempAvg, '°C'); updateText('summary-temp-min', summary.tempMin, '°C', 1, summary.tempMinTime); updateText('summary-hum-max', summary.humMax, '%', 0, summary.humMaxTime); updateText('summary-hum-avg', summary.humAvg, '%', 0); updateText('summary-hum-min', summary.humMin, '%', 0, summary.humMinTime); updateText('summary-press-max', summary.pressMax, 'hPa', 1, summary.pressMaxTime); updateText('summary-press-avg', summary.pressAvg, 'hPa'); updateText('summary-press-min', summary.pressMin, 'hPa', 1, summary.pressMinTime); updateText('summary-solar-max', summary.srMax, 'W/m²', 0, summary.srMaxTime); updateText('summary-solar-avg', summary.srAvg, 'W/m²', 0); updateText('summary-uv-max', summary.uvMax, '', 1, summary.uvMaxTime); updateText('summary-uv-avg', summary.uvAvg, '', 1); updateText('summary-wind-speed-max', summary.wsMax, 'm/s', 1, summary.wsMaxTime); updateText('summary-wind-speed-avg', summary.wsAvg, 'm/s'); document.getElementById('summary-wind-dir').textContent = degToCard(summary.wdMode); updateText('summary-wind-gust-max', summary.wgMax, 'm/s', 1, summary.wgMaxTime); updateText('summary-wind-gust-min', summary.wgMin, 'm/s', 1, summary.wgMinTime);
        updateText('summary-rain-max-daily', summary.maxDailyRain, 'mm', 1, summary.maxDailyRainTime);
        document.getElementById('summary-rain-sum').textContent = summary.rainSumOfTotals !== null ? `${summary.rainSumOfTotals.toFixed(1)} mm` : '-';
        dashboard.style.display = 'grid';
    }
    
    function displayDataInTable(data, mode) { /* ... (bez zmeny) ... */ }
    function updateDateInputType(minDate = null, maxDate = null) { /* ... (bez zmeny) ... */ }
    async function init() {
        availableFiles = await fetchAvailableFiles();
        const availableDataText = generateAvailableDataString(availableFiles);
        availabilityInfo.innerHTML = `<p>Dostupné dáta: ${availableDataText}</p>`;
        const { min, max } = await getAvailableDateRange(availableFiles);
        const today = new Date(); today.setMonth(today.getMonth() - 1);
        const year = today.getFullYear(), month = String(today.getMonth() + 1).padStart(2, '0');
        dateInput.value = `${year}-${month}`;
        updateDateInputType(min, max);
        viewMode.addEventListener('change', () => updateDateInputType(min, max));
        loadDataButton.addEventListener('click', loadAndDisplayData);
        if (dateInput.value) setTimeout(loadAndDisplayData, 0);
    }
    init();
});
