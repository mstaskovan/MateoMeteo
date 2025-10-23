// js/aggregation-methods.js

import { LOCAL_OFFSET_HOURS, formatTimestampToLocalDate } from './utils.js';

/**
 * OPRAVENÁ FUNKCIA: Určí najčastejší smer vetra.
 */
function calculateWindMode(items) {
    const wdCounts = new Map();
    const MIN_WIND_SPEED_FILTER = 0.5; // Zjednotené s custom-aggregation.js

    items.forEach(item => {
        if (item.ws !== null && item.ws >= MIN_WIND_SPEED_FILTER && item.wd !== null) {
            wdCounts.set(item.wd, (wdCounts.get(item.wd) || 0) + 1);
        }
    });

    let modeWD = null;
    let maxCount = 0;
    wdCounts.forEach((count, wd) => {
        if (count > maxCount) {
            maxCount = count;
            modeWD = wd;
        }
    });
    return modeWD;
}

/**
 * OPRAVENÁ VERZIA: Hlavná funkcia pre výpočet súhrnných štatistík (OKREM ZRÁŽOK).
 * VŽDY VRACIA OBJEKT, NIKDY NULL.
 */
function calculateOverallSummary(items) {
    // Inicializácia s null hodnotami ako predvolenými
    const defaultSummary = { tempAvg: null, tempMax: null, tempMaxTime: null, tempMin: null, tempMinTime: null, humAvg: null, humMax: null, humMaxTime: null, humMin: null, humMinTime: null, pressAvg: null, pressMax: null, pressMaxTime: null, pressMin: null, pressMinTime: null, wsAvg: null, wsMax: null, wsMaxTime: null, wgMax: null, wgMaxTime: null, wgMin: null, wgMinTime: null, srAvg: null, srMax: null, srMaxTime: null, uvAvg: null, uvMax: null, uvMaxTime: null, wdMode: null };

    if (!items || items.length === 0) {
        return defaultSummary; // Vráti objekt s null hodnotami, ak nie sú dáta
    }
    
    const metrics = { temp: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null }, hum: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null }, press: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null }, ws: { sum: 0, count: 0, max: -Infinity, maxT: null }, wg: { min: Infinity, minT: null, max: -Infinity, maxT: null }, sr: { sum: 0, count: 0, max: -Infinity, maxT: null }, uv: { sum: 0, count: 0, max: -Infinity, maxT: null } };
    
    items.forEach(item => {
        const t = item.t;
        ['temp', 'hum', 'press'].forEach(key => {
            if (item[key] !== null && typeof item[key] !== 'undefined') {
                metrics[key].sum += item[key];
                metrics[key].count++;
                if (item[key] > metrics[key].max) { metrics[key].max = item[key]; metrics[key].maxT = t; }
                if (item[key] < metrics[key].min) { metrics[key].min = item[key]; metrics[key].minT = t; }
            }
        });
        if (item.ws !== null && typeof item.ws !== 'undefined') {
            metrics.ws.sum += item.ws;
            metrics.ws.count++;
            if (item.ws > metrics.ws.max) { metrics.ws.max = item.ws; metrics.ws.maxT = t; }
        }
        if (item.wg !== null && typeof item.wg !== 'undefined') {
             // Upravená logika pre wgMin, aby brala aj nulu, ak je to jediná hodnota
            if (metrics.wg.min === Infinity && item.wg >= 0) { metrics.wg.min = item.wg; metrics.wg.minT = t; }
            // Ale ak už máme platné minimum, hľadáme len minimum > 0
            else if (item.wg > 0 && item.wg < metrics.wg.min) { metrics.wg.min = item.wg; metrics.wg.minT = t; }
            
            if (item.wg > metrics.wg.max) { metrics.wg.max = item.wg; metrics.wg.maxT = t; }
        }
        if (item.sr !== null && typeof item.sr !== 'undefined') {
            metrics.sr.sum += item.sr;
            metrics.sr.count++;
            if (item.sr > metrics.sr.max) { metrics.sr.max = item.sr; metrics.sr.maxT = t; }
        }
        if (item.uv !== null && typeof item.uv !== 'undefined') {
            metrics.uv.sum += item.uv;
            metrics.uv.count++;
            if (item.uv > metrics.uv.max) { metrics.uv.max = item.uv; metrics.uv.maxT = t; }
        }
    });

    // Ak po iterácii zostalo wg.min ako Infinity (napr. boli len nárazy == 0), nastavíme ho na null
    if (metrics.wg.min === Infinity) {
        metrics.wg.min = null;
        metrics.wg.minT = null;
    }

    return {
        tempAvg: metrics.temp.count > 0 ? metrics.temp.sum / metrics.temp.count : null,
        tempMax: metrics.temp.max !== -Infinity ? metrics.temp.max : null,
        tempMaxTime: metrics.temp.maxT,
        tempMin: metrics.temp.min !== Infinity ? metrics.temp.min : null,
        tempMinTime: metrics.temp.minT,
        humAvg: metrics.hum.count > 0 ? metrics.hum.sum / metrics.hum.count : null,
        humMax: metrics.hum.max !== -Infinity ? metrics.hum.max : null,
        humMaxTime: metrics.hum.maxT,
        humMin: metrics.hum.min !== Infinity ? metrics.hum.min : null,
        humMinTime: metrics.hum.minT,
        pressAvg: metrics.press.count > 0 ? metrics.press.sum / metrics.press.count : null,
        pressMax: metrics.press.max !== -Infinity ? metrics.press.max : null,
        pressMaxTime: metrics.press.maxT,
        pressMin: metrics.press.min !== Infinity ? metrics.press.min : null,
        pressMinTime: metrics.press.minT,
        wsAvg: metrics.ws.count > 0 ? metrics.ws.sum / metrics.ws.count : null,
        wsMax: metrics.ws.max !== -Infinity ? metrics.ws.max : null,
        wsMaxTime: metrics.ws.maxT,
        wgMax: metrics.wg.max !== -Infinity ? metrics.wg.max : null,
        wgMaxTime: metrics.wg.maxT,
        wgMin: metrics.wg.min, // Už ošetrené vyššie
        wgMinTime: metrics.wg.minT,
        srAvg: metrics.sr.count > 0 ? metrics.sr.sum / metrics.sr.count : null,
        srMax: metrics.sr.max !== -Infinity ? metrics.sr.max : null,
        srMaxTime: metrics.sr.maxT,
        uvAvg: metrics.uv.count > 0 ? metrics.uv.sum / metrics.uv.count : null,
        uvMax: metrics.uv.max !== -Infinity ? metrics.uv.max : null,
        uvMaxTime: metrics.uv.maxT,
        wdMode: calculateWindMode(items) // calculateWindMode už zvláda prázdne pole
    };
}


/**
 * FINÁLNA VERZIA: Pomocná funkcia na výpočet prírastkov zrážok,
 * ktorá správne ošetruje NULL hodnoty (výpadky dát).
 */
function calculateRainIncrements(data) {
    const sortedData = [...data].sort((a, b) => a.t - b.t);
    const rainIncrements = new Map();
    let lastValidRain = null;

    for (let i = 0; i < sortedData.length; i++) {
        const curr = sortedData[i];
        
        if (curr.rain === null || typeof curr.rain === 'undefined') {
            continue; // Preskočíme neplatné/chýbajúce záznamy
        }

        // Ak je to prvý platný záznam, ktorý nájdeme
        if (lastValidRain === null) {
            lastValidRain = curr.rain;
            // Prvý záznam dňa (alebo po sérii null) môže sám o sebe predstavovať prírastok (ak bol reset o polnoci)
            // Musíme skontrolovať, či to nie je úplne prvý záznam v dátach (index 0)
            // a či predchádzajúci záznam (ak existuje) mal rain = null. Vtedy berieme curr.rain ako prírastok.
            // Jednoduchšie: Ak je lastValidRain null A curr.rain > 0, berieme to ako prírastok.
             if (curr.rain > 0) {
                 rainIncrements.set(curr.t, curr.rain);
             }
            continue;
        }

        // Máme predchádzajúcu platnú hodnotu, môžeme porovnávať
        const increment = curr.rain < lastValidRain ? curr.rain : curr.rain - lastValidRain;
        
        if (increment > 0) {
            rainIncrements.set(curr.t, increment);
        }
        
        // Aktualizujeme poslednú platnú hodnotu pre ďalšiu iteráciu
        lastValidRain = curr.rain;
    }
    return rainIncrements;
}


export function aggregateHourlyData(data, rawDate) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t) === rawDate);
    // Dátové položky, ktoré majú platné dáta pre súhrn (napr. temp)
    // Upravené: stačí, ak aspoň JEDNA hodnota nie je null, aby sme rátali súhrn
    const validItemsForSummary = filteredData.filter(item => item.temp !== null || item.hum !== null || item.press !== null || item.ws !== null || item.wg !== null || item.sr !== null || item.uv !== null);
    
    // Summary teraz VŽDY bude objekt vďaka úprave calculateOverallSummary
    const summary = calculateOverallSummary(validItemsForSummary); 
    
    // Ak NEEXISTUJÚ ŽIADNE dáta pre daný deň, vrátime prázdnu štruktúru
    if (filteredData.length === 0) {
       return { data: [], mode: 'hourly', summary: summary }; // summary bude default objekt s null
    }

    // --- Vypočítame prírastky zrážok pre celý deň ---
    const rainIncrements = calculateRainIncrements(filteredData);

    const hourlyDataMap = new Map();
    // Zoskupíme všetky položky, vrátane tých s null hodnotami (pre zrážky)
    filteredData.forEach(item => { 
        // Vypočítame hodinu na základe UTC a lokálneho offsetu
        const itemDate = new Date(item.t);
        const localHour = (itemDate.getUTCHours() + LOCAL_OFFSET_HOURS) % 24; 
        const hourKey = String(localHour).padStart(2, '0'); // Kľúč ako string '00', '01', ... '23'

        if (!hourlyDataMap.has(hourKey)) {
             // rawItems pre výpočet priemerov (len non-null), allItems pre zrážky (všetky)
            hourlyDataMap.set(hourKey, { rawItems: [], allItems: [] });
        }
        hourlyDataMap.get(hourKey).allItems.push(item); 
        // Pridáme len platné položky do rawItems pre ostatné metriky
        if (item.temp !== null || item.hum !== null || item.press !== null || item.ws !== null || item.wg !== null || item.sr !== null || item.uv !== null) {
            hourlyDataMap.get(hourKey).rawItems.push(item);
        }
    });
    
    const aggregatedData = [];
    let totalRainSum = 0;
    let maxHourlyRain = 0;
    let maxHourlyRainTime = null;

    // Musíme prejsť všetkých 24 hodín ('00' až '23')
    for (let hour = 0; hour < 24; hour++) {
        const hourKey = String(hour).padStart(2, '0');
        const record = hourlyDataMap.get(hourKey);
        
        // Spočítame Temp, Hum, atď. len ak máme dáta (record nie je undefined a rawItems nie je prázdne)
        const hourSummary = (record && record.rawItems.length > 0) 
            ? calculateOverallSummary(record.rawItems) 
            : {}; // Bezpečný fallback pre prázdne hodiny

        // Sčítame 10-min prírastky, ktoré patria do tejto hodiny
        let hourRainTotal = 0;
        if (record && record.allItems.length > 0) {
            // Použijeme allItems pre zrážky
            record.allItems.forEach(item => {
                if (rainIncrements.has(item.t)) {
                    hourRainTotal += rainIncrements.get(item.t);
                }
            });
        }
        hourRainTotal = Math.round(hourRainTotal * 10) / 10;

        totalRainSum += hourRainTotal;
        if (hourRainTotal > maxHourlyRain) {
            maxHourlyRain = hourRainTotal;
            // Nájdeme prvý timestamp z danej hodiny ako reprezentatívny čas
             const firstTimestampOfHour = record?.allItems[0]?.t;
             maxHourlyRainTime = firstTimestampOfHour || new Date(`${rawDate}T${hourKey}:00:00`).getTime(); // Fallback
        }
        
        aggregatedData.push({ 
            time: `${hourKey}:00`, 
            // Použijeme hodnoty z hourSummary alebo null, ak neboli dáta
            temp: hourSummary.tempAvg ?? null, 
            hum: hourSummary.humAvg ?? null, 
            press: hourSummary.pressAvg ?? null, 
            ws: hourSummary.wsAvg ?? null, 
            wg: hourSummary.wgMax ?? null, // Pre hodinový náraz berieme max z danej hodiny
            wd: hourSummary.wdMode ?? null, 
            rain: hourRainTotal, 
            sr: hourSummary.srAvg ?? null, 
            uv: hourSummary.uvAvg ?? null, 
        });
    }
    
    // Pridáme súhrn zrážok do celkového súhrnu (ktorý už existuje a nie je null)
    summary.rainSumOfTotals = Math.round(totalRainSum * 10) / 10;
    // V dennom (hodinovom) prehľade chceme max HODINOVÝ úhrn
    summary.maxDailyRain = maxHourlyRain; 
    summary.maxDailyRainTime = maxHourlyRainTime;

    return { data: aggregatedData, mode: 'hourly', summary };
}

export function aggregateDailyData(data, selectedMonth) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t).startsWith(selectedMonth));
    // Upravené: stačí, ak aspoň JEDNA hodnota nie je null, aby sme rátali súhrn
    const validItemsForSummary = filteredData.filter(item => item.temp !== null || item.hum !== null || item.press !== null || item.ws !== null || item.wg !== null || item.sr !== null || item.uv !== null);
    
    // Summary teraz VŽDY bude objekt
    const summary = calculateOverallSummary(validItemsForSummary);

    // Ak NEEXISTUJÚ ŽIADNE dáta pre daný mesiac, vrátime prázdnu štruktúru
    if (filteredData.length === 0) {
       return { data: [], mode: 'daily', summary: summary }; // summary bude default objekt s null
    }
    
    // --- LOGIKA VÝPOČTU ZRÁŽOK PRE MESIAC ---
    const rainIncrements = calculateRainIncrements(filteredData);
    // --- KONIEC LOGIKY ---

    const dailyDataMap = new Map();
    filteredData.forEach(item => { 
        const dayKey = formatTimestampToLocalDate(item.t); 
        if (!dailyDataMap.has(dayKey)) {
             // rawItems pre výpočet priemerov (len non-null), allItems pre zrážky (všetky)
            dailyDataMap.set(dayKey, { day: dayKey.split('-')[2], rawItems: [], allItems: [] }); 
        }
        // Uložíme všetky položky dňa pre výpočet zrážok
        dailyDataMap.get(dayKey).allItems.push(item);
        
        // Pridávame len platné záznamy do rawItems pre ostatné metriky
        if (item.temp !== null || item.hum !== null || item.press !== null || item.ws !== null || item.wg !== null || item.sr !== null || item.uv !== null) {
            dailyDataMap.get(dayKey).rawItems.push(item); 
        }
    });
    
    const aggregatedData = [];
    let totalRainSum = 0;
    
    Array.from(dailyDataMap.keys()).sort().forEach(dayKey => {
        const record = dailyDataMap.get(dayKey);
        // daySummary bude vždy objekt
        const daySummary = calculateOverallSummary(record.rawItems);
        
        // Sčítame 10-min prírastky, ktoré patria do tohto dňa
        let dayRainTotal = 0;
        record.allItems.forEach(item => {
            if (rainIncrements.has(item.t)) {
                dayRainTotal += rainIncrements.get(item.t);
            }
        });
        dayRainTotal = Math.round(dayRainTotal * 10) / 10;

        totalRainSum += dayRainTotal;
        
        aggregatedData.push({ 
            day: record.day, 
            // Použijeme hodnoty z daySummary alebo null, ak neboli dáta
            tempAvg: daySummary.tempAvg ?? null, 
            humAvg: daySummary.humAvg ?? null, 
            pressAvg: daySummary.pressAvg ?? null, 
            wsAvg: daySummary.wsAvg ?? null, 
            wgMax: daySummary.wgMax ?? null, // Pre denný náraz berieme max z daného dňa
            wdMode: daySummary.wdMode ?? null, 
            rainTotal: dayRainTotal, 
            srAvg: daySummary.srAvg ?? null, 
            uvAvg: daySummary.uvAvg ?? null, 
        });
    });
    
    // Nájdeme deň s najvyššími zrážkami
    let maxDailyRain = 0;
    let maxDailyRainTime = null;
    aggregatedData.forEach(dayData => {
        if (dayData.rainTotal > maxDailyRain) {
            maxDailyRain = dayData.rainTotal;
             // Vytvoríme timestamp pre začiatok dňa
            const dateStr = `${selectedMonth}-${String(dayData.day).padStart(2, '0')}`;
            // Použijeme Date.parse alebo new Date().getTime() pre konzistenciu
            maxDailyRainTime = new Date(dateStr).getTime(); 
        }
    });
    
    // Pridáme súhrn zrážok do celkového súhrnu
    summary.rainSumOfTotals = Math.round(totalRainSum * 10) / 10;
    // V mesačnom (dennom) prehľade chceme max DENNÝ úhrn
    summary.maxDailyRain = maxDailyRain;
    summary.maxDailyRainTime = maxDailyRainTime;
    
    return { data: aggregatedData, mode: 'daily', summary };
}
