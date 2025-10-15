// js/aggregation-methods.js

import { LOCAL_OFFSET_HOURS, formatTimestampToLocalDate } from './utils.js';

// =========================================================================
// POMOCNÉ METÓDY
// =========================================================================

function calculateWindMode(items, windMethod) {
    // ... (bez zmeny)
    const wdCounts = new Map();
    const MIN_WIND_SPEED_FILTER = 0.5;
    items.forEach(item => {
        if (windMethod === 'filteredMode' && (item.ws === null || item.ws < MIN_WIND_SPEED_FILTER)) return;
        if (item.wd !== null) wdCounts.set(item.wd, (wdCounts.get(item.wd) || 0) + 1);
    });
    let modeWD = null, maxCount = 0;
    wdCounts.forEach((count, wd) => {
        if (count > maxCount) { maxCount = count; modeWD = wd; }
    });
    return modeWD;
}

/**
 * KĽÚČOVÁ ZMENA: Funkcia teraz počíta všetky metriky vrátane časových pečiatok.
 */
function calculateOverallSummary(items, avgMethod, windMethod) {
    if (items.length === 0) return null;

    // Inicializácia objektov pre ukladanie hodnôt a časov
    const metrics = {
        temp: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null },
        hum: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null },
        press: { sum: 0, count: 0, max: -Infinity, min: Infinity, maxT: null, minT: null },
        ws: { sum: 0, count: 0, max: -Infinity, maxT: null },
        wg: { min: Infinity, minT: null, max: -Infinity, maxT: null },
        rain: { min: Infinity, max: -Infinity },
        sr: { max: -Infinity, maxT: null },
        uv: { max: -Infinity, maxT: null }
    };

    items.forEach(item => {
        const t = item.t;
        // Teplota, Vlhkosť, Tlak
        ['temp', 'hum', 'press'].forEach(key => {
            if (item[key] !== null) {
                metrics[key].sum += item[key];
                metrics[key].count++;
                if (item[key] > metrics[key].max) { metrics[key].max = item[key]; metrics[key].maxT = t; }
                if (item[key] < metrics[key].min) { metrics[key].min = item[key]; metrics[key].minT = t; }
            }
        });
        // Rýchlosť vetra
        if (item.ws !== null) {
            metrics.ws.sum += item.ws;
            metrics.ws.count++;
            if (item.ws > metrics.ws.max) { metrics.ws.max = item.ws; metrics.ws.maxT = t; }
        }
        // Nárazy vetra
        if (item.wg !== null) {
            if (item.wg > metrics.wg.max) { metrics.wg.max = item.wg; metrics.wg.maxT = t; }
            if (item.wg > 0 && item.wg < metrics.wg.min) { metrics.wg.min = item.wg; metrics.wg.minT = t; }
        }
        // Zrážky (bod 3.0)
        if (item.rain !== null) {
            metrics.rain.min = Math.min(metrics.rain.min, item.rain);
            metrics.rain.max = Math.max(metrics.rain.max, item.rain);
        }
        // Radiácia a UV
        if (item.sr !== null && item.sr > metrics.sr.max) { metrics.sr.max = item.sr; metrics.sr.maxT = t; }
        if (item.uv !== null && item.uv > metrics.uv.max) { metrics.uv.max = item.uv; metrics.uv.maxT = t; }
    });
    
    // Finálny výpočet a zostavenie výsledného objektu
    return {
        tempAvg: metrics.temp.count > 0 ? metrics.temp.sum / metrics.temp.count : null,
        tempMax: metrics.temp.max !== -Infinity ? metrics.temp.max : null, tempMaxTime: metrics.temp.maxT,
        tempMin: metrics.temp.min !== Infinity ? metrics.temp.min : null, tempMinTime: metrics.temp.minT,
        humAvg: metrics.hum.count > 0 ? metrics.hum.sum / metrics.hum.count : null,
        humMax: metrics.hum.max !== -Infinity ? metrics.hum.max : null, humMaxTime: metrics.hum.maxT,
        humMin: metrics.hum.min !== Infinity ? metrics.hum.min : null, humMinTime: metrics.hum.minT,
        pressAvg: metrics.press.count > 0 ? metrics.press.sum / metrics.press.count : null,
        pressMax: metrics.press.max !== -Infinity ? metrics.press.max : null, pressMaxTime: metrics.press.maxT,
        pressMin: metrics.press.min !== Infinity ? metrics.press.min : null, pressMinTime: metrics.press.minT,
        wsAvg: metrics.ws.count > 0 ? metrics.ws.sum / metrics.ws.count : null,
        wsMax: metrics.ws.max !== -Infinity ? metrics.ws.max : null, wsMaxTime: metrics.ws.maxT,
        wgMax: metrics.wg.max !== -Infinity ? metrics.wg.max : null, wgMaxTime: metrics.wg.maxT,
        wgMin: metrics.wg.min !== Infinity ? metrics.wg.min : null, wgMinTime: metrics.wg.minT,
        rainTotal: (metrics.rain.max !== -Infinity) ? metrics.rain.max - metrics.rain.min : null,
        srMax: metrics.sr.max !== -Infinity ? metrics.sr.max : null, srMaxTime: metrics.sr.maxT,
        uvMax: metrics.uv.max !== -Infinity ? metrics.uv.max : null, uvMaxTime: metrics.uv.maxT,
        wdMode: calculateWindMode(items, windMethod)
    };
}

// =========================================================================
// HLAVNÉ AGREGAČNÉ FUNKCIE
// =========================================================================

export function aggregateHourlyData(data, rawDate, avgMethod, windMethod) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t) === rawDate);
    if (filteredData.length === 0) return { data: [], mode: 'hourly', summary: null };
    
    const summary = calculateOverallSummary(filteredData, avgMethod, windMethod);
    const hourlyDataMap = new Map();

    filteredData.forEach(item => {
        const hourKey = (new Date(item.t).getUTCHours() + LOCAL_OFFSET_HOURS) % 24;
        if (!hourlyDataMap.has(hourKey)) {
            hourlyDataMap.set(hourKey, { rawItems: [] });
        }
        hourlyDataMap.get(hourKey).rawItems.push(item);
    });

    const aggregatedData = [];
    Array.from(hourlyDataMap.keys()).sort((a, b) => a - b).forEach(hourKey => {
        const record = hourlyDataMap.get(hourKey);
        const hourSummary = calculateOverallSummary(record.rawItems, avgMethod, windMethod);

        aggregatedData.push({
            time: `${String(hourKey).padStart(2, '0')}:00`,
            temp: hourSummary.tempAvg, hum: hourSummary.humAvg, press: hourSummary.pressAvg,
            ws: hourSummary.wsAvg, wg: hourSummary.wgMax, wd: hourSummary.wdMode,
            rain: hourSummary.rainTotal, sr: hourSummary.srMax, uv: hourSummary.uvMax, // Použijeme srMax pre hodinu
        });
    });

    return { data: aggregatedData, mode: 'hourly', summary };
}

export function aggregateDailyData(data, selectedMonth, avgMethod, windMethod) {
    const filteredData = data.filter(item => formatTimestampToLocalDate(item.t).startsWith(selectedMonth));
    if (filteredData.length === 0) return { data: [], mode: 'daily', summary: null };
    
    const summary = calculateOverallSummary(filteredData, avgMethod, windMethod);
    const dailyDataMap = new Map();

    filteredData.forEach(item => {
        const dayKey = formatTimestampToLocalDate(item.t);
        if (!dailyDataMap.has(dayKey)) {
            dailyDataMap.set(dayKey, { day: dayKey.split('-')[2], rawItems: [] });
        }
        dailyDataMap.get(dayKey).rawItems.push(item);
    });

    const aggregatedData = [];
    Array.from(dailyDataMap.keys()).sort().forEach(dayKey => {
        const record = dailyDataMap.get(dayKey);
        const daySummary = calculateOverallSummary(record.rawItems, avgMethod, windMethod);
        
        aggregatedData.push({
            day: record.day,
            tempAvg: daySummary.tempAvg, humAvg: daySummary.humAvg, pressAvg: daySummary.pressAvg,
            wsAvg: daySummary.wsAvg, wgMax: daySummary.wgMax, wdMode: daySummary.wdMode,
            rainTotal: daySummary.rainTotal, srMax: daySummary.srMax, uvMax: daySummary.uvMax,
        });
    });

    return { data: aggregatedData, mode: 'daily', summary };
}