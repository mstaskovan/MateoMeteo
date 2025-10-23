// js/main.js

import { aggregateHourlyData, aggregateDailyData } from './aggregation-methods.js';
import { fetchAvailableFiles, getAvailableDateRange } from './data-loader.js';
import { degToCard, formatTimestampToLocalTime, formatTimestampToDayMonth, generateAvailableDataString } from './utils.js'; 

document.addEventListener('DOMContentLoaded', () => {
    const viewMode = document.getElementById('viewMode'); 
    const dateInput = document.getElementById('dateInput'); 
    const loadDataButton = document.getElementById('loadDataButton'); 
    const selectedPeriodSpan = document.getElementById('selected-period'); 
    const jsonOutput = document.getElementById('json-data'); 
    const dashboard = document.getElementById('summary-dashboard'); 
    const availabilityInfo = document.getElementById('data-availability'); 
    let loadedDataCache = {}; 
    let availableFiles = [];

    async function loadAndDisplayData() { 
        const mode = viewMode.value;
        const rawDate = dateInput.value;
        
        if (!rawDate) {
            jsonOutput.innerHTML = '<p class="error">Vyberte prosím dátum alebo mesiac.</p>';
            dashboard.style.display = "none";
            return;
        }

        const [year, month] = rawDate.split("-");
        const fileName = `${year}_${month}.json`;
        const filePath = `data/${fileName}`;
        const displayPeriod = "day" === mode ? rawDate : `${year}-${month}`;
        
        selectedPeriodSpan.textContent = displayPeriod;
        jsonOutput.innerHTML = "<p>Načítavam dáta...</p>";
        dashboard.style.display = "none";
        
        try {
            let data = loadedDataCache[fileName];
            if (!data) {
                const response = await fetch(filePath);
                if (!response.ok) {
                    jsonOutput.innerHTML = `<p class="error">Chyba: Dáta pre ${month}/${year} neboli nájdené.</p>`;
                    return;
                }
                data = await response.json();
                loadedDataCache[fileName] = data;
            }
            
            const aggregationResult = "day" === mode ? aggregateHourlyData(data, rawDate) : aggregateDailyData(data, displayPeriod);
            
            if (!aggregationResult || 0 === aggregationResult.data.length) {
                jsonOutput.innerHTML = `<p>Pre zvolené obdobie ${displayPeriod} neboli nájdené žiadne záznamy.</p>`;
                return;
            }
            
            displaySummaryData(aggregationResult.summary, mode);
            // Použije sa UPRAVENÁ funkcia:
            displayDataInTable(aggregationResult.data, aggregationResult.mode);

        } catch(error) {
            console.error("Nastala chyba pri spracovaní dát:", error);
            jsonOutput.innerHTML = `<p class="error">Vyskytla sa kritická chyba: ${error.message}</p>`;
        }
    }
    
    function displaySummaryData(summary, mode) {
        if (!summary) { dashboard.style.display = 'none'; return; }
        
        // =======================================================
        // ZMENA: Odstránené zátvorky okolo formátovaného času (TOTO UŽ MÁTE)
        // =======================================================
        const timeFormatter = ts => ts ? `${mode === 'day' ? formatTimestampToLocalTime(ts) : formatTimestampToDayMonth(ts)}` : '';

        const updateText = (id, value, unit = '', decimals = 1, time = null) => {
            const valueEl = document.getElementById(id);
            const timeEl = document.getElementById(`${id}-time`);
            if (valueEl) valueEl.textContent = value !== null ? ` ${value.toFixed(decimals)} ${unit}` : ' -';
            if (timeEl) timeEl.textContent = timeFormatter(time);
        };

        updateText('summary-temp-max', summary.tempMax, '°C', 1, summary.tempMaxTime);
        updateText('summary-temp-avg', summary.tempAvg, '°C');
        updateText('summary-temp-min', summary.tempMin, '°C', 1, summary.tempMinTime);
        updateText('summary-hum-max', summary.humMax, '%', 0, summary.humMaxTime);
        updateText('summary-hum-avg', summary.humAvg, '%', 0);
        updateText('summary-hum-min', summary.humMin, '%', 0, summary.humMinTime);
        updateText('summary-press-max', summary.pressMax, 'hPa', 1, summary.pressMaxTime);
        updateText('summary-press-avg', summary.pressAvg, 'hPa');
        updateText('summary-press-min', summary.pressMin, 'hPa', 1, summary.pressMinTime);
        updateText('summary-solar-max', summary.srMax, 'W/m²', 0, summary.srMaxTime);
        updateText('summary-solar-avg', summary.srAvg, 'W/m²', 0);
        updateText('summary-uv-max', summary.uvMax, '', 1, summary.uvMaxTime);
        updateText('summary-uv-avg', summary.uvAvg, '', 1);
        updateText('summary-wind-speed-max', summary.wsMax, 'm/s', 1, summary.wsMaxTime);
        updateText('summary-wind-speed-avg', summary.wsAvg, 'm/s');
        document.getElementById('summary-wind-dir').textContent = degToCard(summary.wdMode);
        updateText('summary-wind-gust-max', summary.wgMax, 'm/s', 1, summary.wgMaxTime);
        updateText('summary-wind-gust-min', summary.wgMin, 'm/s', 1, summary.wgMinTime);
        updateText('summary-rain-max-daily', summary.maxDailyRain, 'mm', 1, summary.maxDailyRainTime);
        document.getElementById('summary-rain-sum').textContent = summary.rainSumOfTotals !== null ? `${summary.rainSumOfTotals.toFixed(1)} mm` : '-';
        dashboard.style.display = 'grid';
    }
    
    // =======================================================
    // --- TÁTO CELÁ FUNKCIA BOLA REFAKTORIZOVANÁ ---
    // (Pridaný 'title' atribút do každej <td> bunky)
    // =======================================================
    function displayDataInTable(data, mode) {
        
        // Definovanie stĺpcov, aby sme ich mohli prechádzať v cykle
        const hourlyHeaders = [
            { label: "Čas", key: "time", align: 'left', decimals: -1 }, // -1 znamená text
            { label: "Teplota (°C)", key: "temp", align: 'right', decimals: 1 },
            { label: "Vlhkosť (%)", key: "hum", align: 'right', decimals: 0 },
            { label: "Tlak (hPa)", key: "press", align: 'right', decimals: 1 },
            { label: "Rýchl. Vetra (m/s)", key: "ws", align: 'right', decimals: 1 },
            { label: "Nárazy Vetra (m/s)", key: "wg", align: 'right', decimals: 1 },
            { label: "Smer Vetra", key: "wd", align: 'center', decimals: -2 }, // -2 znamená smer vetra
            { label: "Zrážky (mm)", key: "rain", align: 'right', decimals: 1 },
            { label: "Priem. Solárne (W/m²)", key: "sr", align: 'right', decimals: 0 },
            { label: "Priem. UV", key: "uv", align: 'right', decimals: 1 }
        ];

        const dailyHeaders = [
            { label: "Deň", key: "day", align: 'left', decimals: -1 },
            { label: "Priem. Teplota (°C)", key: "tempAvg", align: 'right', decimals: 1 },
            { label: "Priem. Vlhkosť (%)", key: "humAvg", align: 'right', decimals: 0 },
Â          { label: "Priem. Tlak (hPa)", key: "pressAvg", align: 'right', decimals: 1 },
            { label: "Priem. Rýchl. (m/s)", key: "wsAvg", align: 'right', decimals: 1 },
            { label: "Max. Náraz (m/s)", key: "wgMax", align: 'right', decimals: 1 },
            { label: "Smer Vetra", key: "wdMode", align: 'center', decimals: -2 },
s          { label: "Zrážky (mm)", key: "rainTotal", align: 'right', decimals: 1 },
            { label: "Priem. Solárne (W/m²)", key: "srAvg", align: 'right', decimals: 0 },
            { label: "Priem. UV", key: "uvAvg", align: 'right', decimals: 1 }
        ];

        const headers = 'hourly' === mode ? hourlyHeaders : dailyHeaders;
Â      const f = (val, dec = 1) => (val !== null ? val.toFixed(dec) : "-");

        let tableHTML = '<table><thead><tr>';
        
        // Vytvorenie hlavičky
        tableHTML += headers.map(h => `<th>${h.label}</th>`).join("");
        tableHTML += "</tr></thead><tbody>";

        // Vytvorenie riadkov
        data.forEach(item => {
            tableHTML += "<tr>";

            // Vytvorenie buniek pre každý stĺpec
            headers.forEach(header => {
                let value;
                let style = `text-align: ${header.align};`; // Štýl pre zarovnanie

                if (header.decimals === -1) { // Text (Čas, Deň)
                    value = item[header.key];
                } else if (header.decimals === -2) { // Smer vetra
                    const wdValue = 'hourly' === mode ? item.wd : item.wdMode;
                    value = degToCard(wdValue);
                } else { // Číslo
                    value = f(item[header.key], header.decimals);
                }

                // --- TOTO JE POŽADOVANÁ ZMENA ---
                // Pridáme `title` atribút do každej `<td>` bunky
                tableHTML += `<td style="${style}" title="${header.label}">${value}</td>`;
s           });

            tableHTML += "</tr>";
        });

        tableHTML += "</tbody></table>";

        // =======================================================
        // --- TOTO JE FINÁLNA ÚPRAVA PRE PRILEPENÚ HLAVIČKU ---
        // =======================================================
        jsonOutput.innerHTML = `<div class="table-scroll-wrapper">${tableHTML}</div>`;
    }
    // =======================================================
    // --- KONIEC REFAKTORIZOVANEJ FUNKCIE ---
    // =======================================================

    function updateDateInputType(minDate = null, maxDate = null) { 
        const mode = viewMode.value;
        const currentDateValue = dateInput.value;
        let [year, month, day] = currentDateValue.split("-");
        
        if ("day" === mode) {
            dateInput.type = "date";
            if (minDate && maxDate) {
                dateInput.min = minDate;
                dateInput.max = maxDate;
            }
            dateInput.value = `${year}-${month}-${day || "01"}`;
        } else {
            dateInput.type = "month";
            if (minDate && maxDate) {
                dateInput.min = minDate.substring(0, 7);
                dateInput.max = maxDate.substring(0, 7);
            }
            dateInput.value = `${year}-${month}`;
        }
    }
    
    async function init() { 
        availableFiles = await fetchAvailableFiles();
        const availableDataText = generateAvailableDataString(availableFiles);
        availabilityInfo.innerHTML = `<p>Dostupné dáta: ${availableDataText}</p>`;
        
        const { min, max } = await getAvailableDateRange(availableFiles);
        
        // Nastavenie predvoleného dátumu na posledný dokončený mesiac
        const today = new Date();
        today.setDate(1); // Ísť na prvý deň aktuálneho mesiaca
        today.setDate(today.getDate() - 1); // Ísť na posledný deň predchádzajúceho mesiaca
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        
        dateInput.value = `${year}-${month}`; // Predvolená hodnota je posledný mesiac
        
        updateDateInputType(min, max);
        
        viewMode.addEventListener("change", () => updateDateInputType(min, max));
        loadDataButton.addEventListener("click", loadAndDisplayData);
        
        // Automatické načítanie dát pri štarte
        if (dateInput.value) {
            setTimeout(loadAndDisplayData, 0); 
        }
    }
    
    init();
});
