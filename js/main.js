// js/main.js

import { aggregateHourlyData, aggregateDailyData } from './aggregation-methods.js';
import { degToCard, formatTimestampToLocalDate, formatTimestampToLocalTime } from './utils.js'; 

document.addEventListener('DOMContentLoaded', () => {

    const viewMode = document.getElementById('viewMode');
    const dateInput = document.getElementById('dateInput');
    const loadDataButton = document.getElementById('loadDataButton');
    const selectedPeriodSpan = document.getElementById('selected-period');
    const jsonOutput = document.getElementById('json-data');
    const avgMethodSelector = document.getElementById('avgMethod');
    const windMethodSelector = document.getElementById('windMethod');
    const dashboard = document.getElementById('summary-dashboard');

    let loadedDataCache = {};

    async function loadAndDisplayData() {
        // ... (bez zmeny)
        const mode = viewMode.value, rawDate = dateInput.value, avgMethod = avgMethodSelector.value, windMethod = windMethodSelector.value;
        if (!rawDate) {
            jsonOutput.innerHTML = '<p class="error">Vyberte prosím dátum alebo mesiac.</p>';
            dashboard.style.display = 'none';
            return;
        }
        const [year, month] = rawDate.split('-'), fileName = `${year}_${month}.json`, filePath = `data/${fileName}`, displayPeriod = mode === 'day' ? rawDate : `${year}-${month}`;
        selectedPeriodSpan.textContent = displayPeriod;
        jsonOutput.innerHTML = '<p>Načítavam dáta...</p>';
        dashboard.style.display = 'none';
        try {
            let allData = loadedDataCache[fileName];
            if (!allData) {
                const response = await fetch(filePath);
                if (!response.ok) { jsonOutput.innerHTML = `<p class="error">Chyba: Dáta pre ${month}/${year} neboli nájdené.</p>`; return; }
                allData = await response.json();
                loadedDataCache[fileName] = allData;
            }
            const aggregationResult = mode === 'day' ? aggregateHourlyData(allData, rawDate, avgMethod, windMethod) : aggregateDailyData(allData, displayPeriod, avgMethod, windMethod);
            if (!aggregationResult || aggregationResult.data.length === 0) { jsonOutput.innerHTML = `<p>Pre zvolené obdobie ${displayPeriod} neboli nájdené žiadne záznamy.</p>`; return; }
            displaySummaryData(aggregationResult.summary, mode);
            displayDataInTable(aggregationResult.data, aggregationResult.mode);
        } catch (error) {
            console.error('Nastala chyba pri spracovaní dát:', error);
            jsonOutput.innerHTML = `<p class="error">Vyskytla sa kritická chyba: ${error.message}</p>`;
            dashboard.style.display = 'none';
        }
    }
    
    /**
     * ZMENA: Funkcia plní novú štruktúru vrátane časov/dátumov.
     */
    function displaySummaryData(summary, mode) {
        if (!summary) { dashboard.style.display = 'none'; return; }

        const timeFormatter = (ts) => mode === 'day' ? formatTimestampToLocalTime(ts) : formatTimestampToLocalDate(ts).split('-')[2] + '.';
        
        const updateText = (id, value, unit = '', decimals = 1, time = null) => {
            const el = document.getElementById(id);
            const timeEl = document.getElementById(`${id}-time`);
            if (el) el.textContent = value !== null ? `${value.toFixed(decimals)} ${unit}` : '-';
            if (timeEl) timeEl.textContent = time !== null ? `(${timeFormatter(time)})` : '';
        };

        // Teplota, Vlhkosť, Tlak, Žiarenie
        updateText('summary-temp-max', summary.tempMax, '°C', 1, summary.tempMaxTime);
        updateText('summary-temp-avg', summary.tempAvg, '°C');
        updateText('summary-temp-min', summary.tempMin, '°C', 1, summary.tempMinTime);
        updateText('summary-hum-max', summary.humMax, '%', 0, summary.humMaxTime);
        updateText('summary-hum-avg', summary.humAvg, '%', 0);
        updateText('summary-hum-min', summary.humMin, '%', 0, summary.humMinTime);
        updateText('summary-press-max', summary.pressMax, 'hPa', 1, summary.pressMaxTime);
        updateText('summary-press-avg', summary.pressAvg, 'hPa');
        updateText('summary-press-min', summary.pressMin, 'hPa', 1, summary.pressMinTime);
        updateText('summary-solar', summary.srMax, 'W/m²', 0, summary.srMaxTime);
        updateText('summary-uv', summary.uvMax, '', 1, summary.uvMaxTime);

        // Vietor
        updateText('summary-wind-speed-max', summary.wsMax, 'm/s', 1, summary.wsMaxTime);
        updateText('summary-wind-speed-avg', summary.wsAvg, 'm/s');
        document.getElementById('summary-wind-dir').textContent = degToCard(summary.wdMode);

        // Nárazy
        updateText('summary-wind-gust-max', summary.wgMax, 'm/s', 1, summary.wgMaxTime);
        updateText('summary-wind-gust-min', summary.wgMin, 'm/s', 1, summary.wgMinTime);
        
        // Zrážky
        updateText('summary-rain', summary.rainTotal, 'mm');

        dashboard.style.display = 'grid'; 
    }

    /**
     * ZMENA: Nové poradie stĺpcov a pridaný stĺpec pre nárazy vetra.
     */
    function displayDataInTable(data, mode) {
        let tableHTML = '<table><thead><tr>';
        const headers = mode === 'hourly' 
            ? ['Čas', 'Teplota (°C)', 'Vlhkosť (%)', 'Tlak (hPa)', 'Rýchl. Vetra (m/s)', 'Nárazy Vetra (m/s)', 'Smer Vetra', 'Zrážky (mm)', 'Solárne (W/m²)', 'UV Index']
            : ['Deň', 'Priem. Teplota (°C)', 'Priem. Vlhkosť (%)', 'Priem. Tlak (hPa)', 'Priem. Rýchl. (m/s)', 'Max. Náraz (m/s)', 'Smer Vetra', 'Zrážky (mm)', 'Max. Solárne (W/m²)', 'Max. UV'];
        tableHTML += headers.map(h => `<th>${h}</th>`).join('');
        tableHTML += '</tr></thead><tbody>';

        data.forEach(item => {
            const windDirText = degToCard(mode === 'hourly' ? item.wd : item.wdMode);
            const f = (val, dec = 1) => val !== null ? val.toFixed(dec) : '-';

            if (mode === 'hourly') {
                tableHTML += `<tr>
                    <td>${item.time}</td>
                    <td>${f(item.temp)}</td>
                    <td>${f(item.hum, 0)}</td>
                    <td>${f(item.press)}</td>
                    <td>${f(item.ws)}</td>
                    <td>${f(item.wg)}</td>
                    <td style="text-align:center;">${windDirText}</td>
                    <td>${f(item.rain)}</td>
                    <td>${f(item.sr, 0)}</td>
                    <td>${f(item.uv)}</td>
                </tr>`;
            } else { // daily
                tableHTML += `<tr>
                    <td>${item.day}</td>
                    <td>${f(item.tempAvg)}</td>
                    <td>${f(item.humAvg, 0)}</td>
                    <td>${f(item.pressAvg)}</td>
                    <td>${f(item.wsAvg)}</td>
                    <td>${f(item.wgMax)}</td>
                    <td style="text-align:center;">${windDirText}</td>
                    <td>${f(item.rainTotal)}</td>
                    <td>${f(item.srMax, 0)}</td>
                    <td>${f(item.uvMax)}</td>
                </tr>`;
            }
        });
        tableHTML += '</tbody></table>';
        jsonOutput.innerHTML = tableHTML;
    }

    function updateDateInputType() {
        // ... (bez zmeny)
        const mode=viewMode.value,currentDateValue=dateInput.value;let[year,month,day]=currentDateValue.split("-");(!year||!month)&&(year="2025",month="09"),"day"===mode?(dateInput.type="date",dateInput.value=`${year}-${month}-${day||"01"}`):(dateInput.type="month",dateInput.value=`${year}-${month}`);
    }
    
    function init() {
        // ... (bez zmeny)
        updateDateInputType();
        viewMode.addEventListener('change', updateDateInputType);
        loadDataButton.addEventListener('click', loadAndDisplayData);
        if (dateInput.value) setTimeout(loadAndDisplayData, 0); 
    }
    
    init();
});
