// js/aggregation-methods.js

import { LOCAL_OFFSET_HOURS, formatTimestampToLocalDate } from './utils.js';

/**
 * OPRAVENÁ FUNKCIA: Určí najčastejší smer vetra.
 */
function calculateWindMode(items) {
    const wdCounts = new Map();
    const MIN_WIND_SPEED_FILTER = 0.5;

    items.forEach(item => {
        // OPRAVA: Správny názov premennej (bol tu preklep MIN_WUD_SPEED_FILTER)
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
 * POMOCNÁ FUNKCIA: Presne vypočíta súčet prírastkov zrážok.
 * Prevzaté z custom-aggregation.js pre zjednotenie logiky.
 */
function calculateRainIncrementSum(items) {
    if (items.length < 2) return 0;
    // Triedime, aby sme mali istotu správneho poradia pre výpočet rozdielu
    const sortedItems = [...items].sort((a, b) => a.t - b.t);
    let rainSum = 0;
    
    for (let i = 1; i < sortedItems.length; i++) {
        const prevRain = sortedItems[i - 1].rain;
        const currentRain = sortedItems[i].rain;
        
        if (prevRain === null || currentRain === null) continue;
        
        // Ak je aktuálna hodnota nižšia, znamená to reset počítadla (napr. o polnoci)
        // v takom prípade je prírastok samotná aktuálna hodnota.
        const increment = currentRain < prevRain ? currentRain : currentRain - prevRain;
        
        if (increment > 0) {
            rainSum += increment;
        }
    }
    // Zaokrúhlenie na jedno desatinné miesto pre konzistenciu
    return Math.round(rainSum * 10) / 10;
}


/**
 * Hlavná funkcia pre výpočet súhrnných štatistík pre dané obdobie.
 */
function calculateOverallSummary(items) {
    if (items.length === 0) return null;
    
    // UPRAVENÉ: Odstránená premenná 'rain' z 'metrics'
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
        
        // ODSTRÁNENÉ: Pôvodný 'if' blok pre 'rain' bol tu

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
        
        // UPRAVENÉ: Používa sa nová, správna funkcia
        rainTotal: calculateRainIncrementSum(items),
        
        srAvg: metrics.sr.count > 0 ? metrics.sr.sum / metrics.sr.count : null,
        srMax: metrics.sr.max !== -Infinity ? metrics.sr.max : null,
        srMaxTime: metrics.sr.maxT,
        uvAvg: metrics.uv.count > 0 ? metrics.uv.sum / metrics.uv.count : null,
        uvMax: metrics.uv.max !== -Infinity ? metrics.uv.max : null,
        uvMaxTime: metrics.uv.maxT,
        wdMode: calculateWindMode(items)
    };
}

export function aggregateHourlyData(data, rawDate) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t) === rawDate);
    if (filteredData.length === 0) return { data: [], mode: 'hourly', summary: null };

    const summary = calculateOverallSummary(filteredData);
    const hourlyDataMap = new Map();
    let totalRainSum = 0;

    filteredData.forEach(item => { const hourKey = (new Date(item.t).getUTCHours() + LOCAL_OFFSET_HOURS) % 24; if (!hourlyDataMap.has(hourKey)) hourlyDataMap.set(hourKey, { rawItems: [] }); hourlyDataMap.get(hourKey).rawItems.push(item); });
    
    const aggregatedData = [];
    let maxHourlyRain = 0;
    let maxHourlyRainTime = null;

    Array.from(hourlyDataMap.keys()).sort((a, b) => a - b).forEach(hourKey => {
        const record = hourlyDataMap.get(hourKey);
        const hourSummary = calculateOverallSummary(record.rawItems);
        
        // Tu sa 'rainTotal' berie už zo správne vypočítaného 'hourSummary'
        if (hourSummary.rainTotal !== null) {
            totalRainSum += hourSummary.rainTotal;
            if (hourSummary.rainTotal > maxHourlyRain) {
                maxHourlyRain = hourSummary.rainTotal;
                const dateForHour = new Date(record.rawItems[0].t);
                dateForHour.setUTCHours(hourKey - LOCAL_OFFSET_HOURS, 0, 0, 0);
                maxHourlyRainTime = dateForHour.getTime();
            }
        }
        aggregatedData.push({ time: `${String(hourKey).padStart(2, '0')}:00`, temp: hourSummary.tempAvg, hum: hourSummary.humAvg, press: hourSummary.pressAvg, ws: hourSummary.wsAvg, wg: hourSummary.wgMax, wd: hourSummary.wdMode, rain: hourSummary.rainTotal, sr: hourSummary.srAvg, uv: hourSummary.uvAvg, });
    });

    summary.rainSumOfTotals = totalRainSum;
    summary.maxDailyRain = maxHourlyRain; 
    summary.maxDailyRainTime = maxHourlyRainTime;

    return { data: aggregatedData, mode: 'hourly', summary };
}

export function aggregateDailyData(data, selectedMonth) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t).startsWith(selectedMonth));
    if (filteredData.length === 0) return { data: [], mode: 'daily', summary: null };
    
    const summary = calculateOverallSummary(filteredData);
    const dailyDataMap = new Map();
    let totalRainSum = 0;

    filteredData.forEach(item => { const dayKey = formatTimestampToLocalDate(item.t); if (!dailyDataMap.has(dayKey)) dailyDataMap.set(dayKey, { day: dayKey.split('-')[2], rawItems: [] }); dailyDataMap.get(dayKey).rawItems.push(item); });
    
    const aggregatedData = [];
    Array.from(dailyDataMap.keys()).sort().forEach(dayKey => {
        const daySummary = calculateOverallSummary(dailyDataMap.get(dayKey).rawItems);
        // Tu sa 'rainTotal' berie už zo správne vypočítaného 'daySummary'
        if (daySummary.rainTotal !== null) totalRainSum += daySummary.rainTotal;
        aggregatedData.push({ day: dailyDataMap.get(dayKey).day, tempAvg: daySummary.tempAvg, humAvg: daySummary.humAvg, pressAvg: daySummary.pressAvg, wsAvg: daySummary.wsAvg, wgMax: daySummary.wgMax, wdMode: daySummary.wdMode, rainTotal: daySummary.rainTotal, srAvg: daySummary.srAvg, uvAvg: daySummary.uvAvg, });
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
    
    summary.rainSumOfTotals = totalRainSum;
    summary.maxDailyRain = maxDailyRain;
    summary.maxDailyRainTime = maxDailyRainTime;
    
    return { data: aggregatedData, mode: 'daily', summary };
}
