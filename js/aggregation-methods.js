// js/aggregation-methods.js

import { LOCAL_OFFSET_HOURS, formatTimestampToLocalDate } from './utils.js';

/**
 * OPRAVENÁ FUNKCIA: Určí najčastejší smer vetra.
 */
function calculateWindMode(items) {
    const wdCounts = new Map();
    const MIN_WIND_SPEED_FILTER = 0.5;

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
 * Hlavná funkcia pre výpočet súhrnných štatistík (OKREM ZRÁŽOK) pre dané obdobie.
 */
function calculateOverallSummary(items) {
    if (items.length === 0) return null;
    
    // Zrážky (rain) sú odtiaľto úplne odstránené
    const metrics = { temp: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null }, hum: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null }, press: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null }, ws: { sum: 0, count: 0, max: -Infinity, maxT: null }, wg: { min: Infinity, minT: null, max: -Infinity, maxT: null }, sr: { sum: 0, count: 0, max: -Infinity, maxT: null }, uv: { sum: 0, count: 0, max: -Infinity, maxT: null } };
    
    items.forEach(item => {
        const t = item.t;
        ['temp', 'hum', 'press'].forEach(key => {
            if (item[key] !== null) {
                metrics[key].sum += item[key];
                metrics[key].count++;
                if (item[key] > metrics[key].max) { metrics[key].max = item[key]; metrics[key].maxT = t; }
                if (item[key] < metrics[key].min) { metrics[key].min = item[key]; metrics[key].minT = t; }
            }
        });
        if (item.ws !== null) {
            metrics.ws.sum += item.ws;
            metrics.ws.count++;
            if (item.ws > metrics.ws.max) { metrics.ws.max = item.ws; metrics.ws.maxT = t; }
        }
        if (item.wg !== null) {
            if (item.wg > metrics.wg.max) { metrics.wg.max = item.wg; metrics.wg.maxT = t; }
            if (item.wg > 0 && item.wg < metrics.wg.min) { metrics.wg.min = item.wg; metrics.wg.minT = t; }
        }
        if (item.sr !== null) {
            metrics.sr.sum += item.sr;
            metrics.sr.count++;
            if (item.sr > metrics.sr.max) { metrics.sr.max = item.sr; metrics.sr.maxT = t; }
        }
        if (item.uv !== null) {
            metrics.uv.sum += item.uv;
            metrics.uv.count++;
            if (item.uv > metrics.uv.max) { metrics.uv.max = item.uv; metrics.uv.maxT = t; }
        }
    });

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
        wgMin: metrics.wg.min !== Infinity ? metrics.wg.min : null,
        wgMinTime: metrics.wg.minT,
        srAvg: metrics.sr.count > 0 ? metrics.sr.sum / metrics.sr.count : null,
        srMax: metrics.sr.max !== -Infinity ? metrics.sr.max : null,
        srMaxTime: metrics.sr.maxT,
        uvAvg: metrics.uv.count > 0 ? metrics.uv.sum / metrics.uv.count : null,
        uvMax: metrics.uv.max !== -Infinity ? metrics.uv.max : null,
        uvMaxTime: metrics.uv.maxT,
        wdMode: calculateWindMode(items)
    };
}

/**
 * Pomocná funkcia na výpočet prírastkov zrážok
 */
function calculateRainIncrements(data) {
    const sortedData = [...data].sort((a, b) => a.t - b.t);
    const rainIncrements = new Map();

    for (let i = 1; i < sortedData.length; i++) {
        const prev = sortedData[i - 1];
        const curr = sortedData[i];
        
        // Spracujeme len platné dáta
        if (prev.rain === null || curr.rain === null) continue;
        
        // Kontrola resetu (current < prev) alebo normálneho prírastku
        const increment = curr.rain < prev.rain ? curr.rain : curr.rain - prev.rain;
        
        if (increment > 0) {
            rainIncrements.set(curr.t, increment);
        }
    }
    return rainIncrements;
}

export function aggregateHourlyData(data, rawDate) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t) === rawDate);
    if (filteredData.length === 0) return { data: [], mode: 'hourly', summary: null };

    const validItemsForSummary = filteredData.filter(item => item.temp !== null && item.hum !== null);
    const summary = calculateOverallSummary(validItemsForSummary);
    
    // --- LOGIKA VÝPOČTU ZRÁŽOK ---
    const rainIncrements = calculateRainIncrements(filteredData);
    // --- KONIEC LOGIKY ---

    const hourlyDataMap = new Map();
    filteredData.forEach(item => { 
        const hourKey = (new Date(item.t).getUTCHours() + LOCAL_OFFSET_HOURS) % 24; 
        if (!hourlyDataMap.has(hourKey)) {
            hourlyDataMap.set(hourKey, { rawItems: [] });
        }
        if (item.temp !== null) { // Pridávame len platné záznamy
            hourlyDataMap.get(hourKey).rawItems.push(item); 
        }
    });
    
    const aggregatedData = [];
    let totalRainSum = 0;
    let maxHourlyRain = 0;
    let maxHourlyRainTime = null;

    // Musíme prejsť všetkých 24 hodín, aj keď pre ne nemáme dáta (kvôli výpadku)
    for (let hourKey = 0; hourKey < 24; hourKey++) {
        const record = hourlyDataMap.get(hourKey);
        
        // Spočítame Temp, Hum, atď. len ak máme dáta
        const hourSummary = record ? calculateOverallSummary(record.rawItems) : {};

        // Sčítame 10-min prírastky, ktoré patria do tejto hodiny
        let hourRainTotal = 0;
        const timestampsInThisHour = filteredData
            .filter(item => ((new Date(item.t).getUTCHours() + LOCAL_OFFSET_HOURS) % 24) === hourKey)
            .map(item => item.t);

        timestampsInThisHour.forEach(t => {
            if (rainIncrements.has(t)) {
                hourRainTotal += rainIncrements.get(t);
            }
        });
        hourRainTotal = Math.round(hourRainTotal * 10) / 10;

        totalRainSum += hourRainTotal;
        if (hourRainTotal > maxHourlyRain) {
            maxHourlyRain = hourRainTotal;
            const dateForHour = new Date(`${rawDate}T00:00:00Z`); // Začíname o polnoci UTC
            // Prirátame hodinu a UTC offset
            dateForHour.setUTCHours(hourKey - LOCAL_OFFSET_HOURS, 0, 0, 0);
            maxHourlyRainTime = dateForHour.getTime();
        }
        
        aggregatedData.push({ 
            time: `${String(hourKey).padStart(2, '0')}:00`, 
            temp: hourSummary.tempAvg || null, 
            hum: hourSummary.humAvg || null, 
            press: hourSummary.pressAvg || null, 
            ws: hourSummary.wsAvg || null, 
            wg: hourSummary.wgMax || null, 
            wd: hourSummary.wdMode || null, 
            rain: hourRainTotal, 
            sr: hourSummary.srAvg || null, 
            uv: hourSummary.uvAvg || null, 
        });
    }

    summary.rainSumOfTotals = Math.round(totalRainSum * 10) / 10;
    summary.maxDailyRain = maxHourlyRain; 
    summary.maxDailyRainTime = maxHourlyRainTime;

    return { data: aggregatedData, mode: 'hourly', summary };
}

export function aggregateDailyData(data, selectedMonth) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t).startsWith(selectedMonth));
    if (filteredData.length === 0) return { data: [], mode: 'daily', summary: null };
    
    const validItemsForSummary = filteredData.filter(item => item.temp !== null && item.hum !== null);
    const summary = calculateOverallSummary(validItemsForSummary);
    
    // --- LOGIKA VÝPOČTU ZRÁŽOK PRE MESIAC ---
    const rainIncrements = calculateRainIncrements(filteredData);
    // --- KONIEC LOGIKY ---

    const dailyDataMap = new Map();
    filteredData.forEach(item => { 
        const dayKey = formatTimestampToLocalDate(item.t); 
        if (!dailyDataMap.has(dayKey)) {
            dailyDataMap.set(dayKey, { day: dayKey.split('-')[2], rawItems: [] }); 
        }
        if (item.temp !== null) { // Pridávame len platné záznamy
            dailyDataMap.get(dayKey).rawItems.push(item); 
        }
    });
    
    const aggregatedData = [];
    let totalRainSum = 0;
    
    Array.from(dailyDataMap.keys()).sort().forEach(dayKey => {
        const record = dailyDataMap.get(dayKey);
        const daySummary = calculateOverallSummary(record.rawItems);
        
        let dayRainTotal = 0;
        const timestampsInThisDay = filteredData
            .filter(item => formatTimestampToLocalDate(item.t) === dayKey)
            .map(item => item.t);

        timestampsInThisDay.forEach(t => {
            if (rainIncrements.has(t)) {
                dayRainTotal += rainIncrements.get(t);
            }
        });
        dayRainTotal = Math.round(dayRainTotal * 10) / 10;

        totalRainSum += dayRainTotal;
        
        aggregatedData.push({ 
            day: record.day, 
            tempAvg: daySummary.tempAvg, 
            humAvg: daySummary.humAvg, 
            pressAvg: daySummary.pressAvg, 
            wsAvg: daySummary.wsAvg, 
            wgMax: daySummary.wgMax, 
            wdMode: daySummary.wdMode, 
            rainTotal: dayRainTotal, 
            srAvg: daySummary.srAvg, 
            uvAvg: daySummary.uvAvg, 
        });
    });
    
    let maxDailyRain = 0;
    let maxDailyRainTime = null;
    aggregatedData.forEach(dayData => {
        if (dayData.rainTotal > maxDailyRain) {
            maxDailyRain = dayData.rainTotal;
            const dateStr = `${selectedMonth}-${String(dayData.day).padStart(2, '0')}`;
            maxDailyRainTime = new Date(dateStr).getTime();
        }
    });
    
    summary.rainSumOfTotals = Math.round(totalRainSum * 10) / 10;
    summary.maxDailyRain = maxDailyRain;
    summary.maxDailyRainTime = maxDailyRainTime;
    
    return { data: aggregatedData, mode: 'daily', summary };
}
