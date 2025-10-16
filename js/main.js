// js/main.js

import { aggregateHourlyData, aggregateDailyData } from './aggregation-methods.js';
// ZMENA: Importujeme nové funkcie
import { fetchAvailableFiles, getAvailableDateRange } from './data-loader.js';
import { degToCard, formatTimestampToLocalTime, formatTimestampToDayMonth, generateAvailableDataString } from './utils.js'; 

document.addEventListener('DOMContentLoaded', () => {

    const viewMode = document.getElementById('viewMode');
    const dateInput = document.getElementById('dateInput');
    const loadDataButton = document.getElementById('loadDataButton');
    const selectedPeriodSpan = document.getElementById('selected-period');
    const jsonOutput = document.getElementById('json-data');
    const dashboard = document.getElementById('summary-dashboard');
    const availabilityInfo = document.getElementById('data-availability'); // NOVÝ ELEMENT

    let loadedDataCache = {};
    let availableFiles = []; // NOVÁ Premenná

    async function loadAndDisplayData() {
        const mode = viewMode.value;
        const rawDate = dateInput.value;
        
        if (!rawDate) {
            jsonOutput.innerHTML = '<p class="error">Vyberte prosím dátum alebo mesiac.</p>';
            dashboard.style.display = 'none';
            return;
        }
        
        const [year, month] = rawDate.split('-');
        const fileName = `${year}_${month}.json`;
        const filePath = `data/${fileName}`;
        const displayPeriod = mode === 'day' ? rawDate : `${year}-${month}`;
        
        selectedPeriodSpan.textContent = displayPeriod;
        jsonOutput.innerHTML = '<p>Načítavam dáta...</p>';
        dashboard.style.display = 'none';

        try {
            // Použijeme už načítaný zoznam súborov
            const data = await loadDataForRange(rawDate, rawDate, availableFiles);

            if (data.length === 0) {
                 jsonOutput.innerHTML = `<p>Pre zvolené obdobie ${displayPeriod} neboli nájdené žiadne záznamy.</p>`;
                 return;
            }
            
            const aggregationResult = mode === 'day'
                ? aggregateHourlyData(data, rawDate)
                : aggregateDailyData(data, displayPeriod);
            
            displaySummaryData(aggregationResult.summary, mode);
            displayDataInTable(aggregationResult.data, aggregationResult.mode);

        } catch (error) {
            console.error('Nastala chyba pri spracovaní dát:', error);
            jsonOutput.innerHTML = `<p class="error">Vyskytla sa kritická chyba: ${error.message}</p>`;
        }
    }
    
    // Funkcia na načítanie dát pre hlavný prehľad (zjednodušená verzia)
    async function loadDataForRange(fromDate, toDate, fileList) {
        const fromMonth = fromDate.substring(0, 7);
        const toMonth = toDate.substring(0, 7);
        
        const monthsToLoad = new Set();
        fileList.forEach(file => {
            const month = file.replace('.json', '').replace('_', '-');
            if (month >= fromMonth && month <= toMonth) monthsToLoad.add(file);
        });

        let allData = [];
        for (const file of monthsToLoad) {
            if (loadedDataCache[file]) {
                allData.push(...loadedDataCache[file]);
            } else {
                const response = await fetch(`data/${file}`);
                const data = await response.json();
                loadedDataCache[file] = data;
                allData.push(...data);
            }
        }
        return allData.flat();
    }
    
    // Funkcie displaySummaryData a displayDataInTable zostávajú bez zmeny...
    function displaySummaryData(summary, mode) { if (!summary) { dashboard.style.display = 'none'; return; } const timeFormatter = (ts) => ts ? `(${mode === 'day' ? formatTimestampToLocalTime(ts) : formatTimestampToDayMonth(ts)})` : ''; const updateText = (id, value, unit = '', decimals = 1, time = null) => { const valueEl = document.getElementById(id); const timeEl = document.getElementById(`${id}-time`); if (valueEl) valueEl.textContent = value !== null ? ` ${value.toFixed(decimals)} ${unit}` : ' -'; if (timeEl) timeEl.textContent = timeFormatter(time); }; updateText('summary-temp-max', summary.tempMax, '°C', 1, summary.tempMaxTime); updateText('summary-temp-avg', summary.tempAvg, '°C'); updateText('summary-temp-min', summary.tempMin, '°C', 1, summary.tempMinTime); updateText('summary-hum-max', summary.humMax, '%', 0, summary.humMaxTime); updateText('summary-hum-avg', summary.humAvg, '%', 0); updateText('summary-hum-min', summary.humMin, '%', 0, summary.humMinTime); updateText('summary-press-max', summary.pressMax, 'hPa', 1, summary.pressMaxTime); updateText('summary-press-avg', summary.pressAvg, 'hPa'); updateText('summary-press-min', summary.pressMin, 'hPa', 1, summary.pressMinTime); updateText('summary-solar-max', summary.srMax, 'W/m²', 0, summary.srMaxTime); updateText('summary-solar-avg', summary.srAvg, 'W/m²', 0); updateText('summary-uv-max', summary.uvMax, '', 1, summary.uvMaxTime); updateText('summary-uv-avg', summary.uvAvg, '', 1); updateText('summary-wind-speed-max', summary.wsMax, 'm/s', 1, summary.wsMaxTime); updateText('summary-wind-speed-avg', summary.wsAvg, 'm/s'); document.getElementById('summary-wind-dir').textContent = degToCard(summary.wdMode); updateText('summary-wind-gust-max', summary.wgMax, 'm/s', 1, summary.wgMaxTime); updateText('summary-wind-gust-min', summary.wgMin, 'm/s', 1, summary.wgMinTime); document.getElementById('summary-rain-max-daily').textContent = summary.rainTotal !== null ? `${summary.rainTotal.toFixed(1)} mm` : '-'; document.getElementById('summary-rain-sum').textContent = summary.rainSumOfTotals !== null ? `${summary.rainSumOfTotals.toFixed(1)} mm` : '-'; dashboard.style.display = 'grid'; }
    function displayDataInTable(data, mode) { let tableHTML = '<table><thead><tr>'; const headers = mode === 'hourly' ? ['Čas', 'Teplota (°C)', 'Vlhkosť (%)', 'Tlak (hPa)', 'Rýchl. Vetra (m/s)', 'Nárazy Vetra (m/s)', 'Smer Vetra', 'Zrážky (mm)', 'Priem. Solárne (W/m²)', 'Priem. UV'] : ['Deň', 'Priem. Teplota (°C)', 'Priem. Vlhkosť (%)', 'Priem. Tlak (hPa)', 'Priem. Rýchl. (m/s)', 'Max. Náraz (m/s)', 'Smer Vetra', 'Zrážky (mm)', 'Max. Solárne (W/m²)', 'Max. UV']; tableHTML += headers.map(h => `<th>${h}</th>`).join(''); tableHTML += '</tr></thead><tbody>'; data.forEach(item => { const windDirText = degToCard(mode === 'hourly' ? item.wd : item.wdMode); const f = (val, dec = 1) => val !== null ? val.toFixed(dec) : '-'; if (mode === 'hourly') { tableHTML += `<tr><td>${item.time}</td><td>${f(item.temp)}</td><td>${f(item.hum, 0)}</td><td>${f(item.press)}</td><td>${f(item.ws)}</td><td>${f(item.wg)}</td><td style="text-align:center;">${windDirText}</td><td>${f(item.rain)}</td><td>${f(item.sr, 0)}</td><td>${f(item.uv)}</td></tr>`; } else { tableHTML += `<tr><td>${item.day}</td><td>${f(item.tempAvg)}</td><td>${f(item.humAvg, 0)}</td><td>${f(item.pressAvg)}</td><td>${f(item.wsAvg)}</td><td>${f(item.wgMax)}</td><td style="text-align:center;">${windDirText}</td><td>${f(item.rainTotal)}</td><td>${f(item.srMax, 0)}</td><td>${f(item.uvMax)}</td></tr>`; } }); tableHTML += '</tbody></table>'; jsonOutput.innerHTML = tableHTML; }
    
    // ZMENA: úprava funkcie na nastavenie min/max atribútov
    function updateDateInputType(minDate = null, maxDate = null) {
        const mode = viewMode.value;
        const currentDateValue = dateInput.value;
        let [year, month, day] = currentDateValue.split('-');
        
        if (mode === 'day') {
            dateInput.type = 'date';
            if(minDate && maxDate) {
                dateInput.min = minDate;
                dateInput.max = maxDate;
            }
            if (!day) dateInput.value = `${year}-${month}-01`;

        } else { // mode === 'month'
            dateInput.type = 'month';
            if(minDate && maxDate) {
                dateInput.min = minDate.substring(0, 7);
                dateInput.max = maxDate.substring(0, 7);
            }
        }
    }
    
    async function init() {
        // Logika z `analysis.js` prenesená sem
        availableFiles = await fetchAvailableFiles();
        const availableDataText = generateAvailableDataString(availableFiles);
        availabilityInfo.innerHTML = `<p>Dostupné dáta: ${availableDataText}</p>`;
        
        const { min, max } = await getAvailableDateRange(availableFiles);

        updateDateInputType(min, max);
        
        viewMode.addEventListener('change', () => updateDateInputType(min, max));
        loadDataButton.addEventListener('click', loadAndDisplayData);
        
        // Prvé načítanie dát po úvodnom nastavení
        if (dateInput.value) {
            // Predvolene nastavíme na posledný dostupný mesiac
            if (max) dateInput.value = max.substring(0, 7);
            updateDateInputType(min, max);
            setTimeout(loadAndDisplayData, 0); 
        }
    }
    
    init();
});
