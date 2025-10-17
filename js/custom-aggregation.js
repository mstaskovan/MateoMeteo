// js/custom-aggregation.js
import { formatTimestampToLocalDate } from './utils.js';

const UNITS = { temp: '°C', hum: '%', press: 'hPa', rain: 'mm', ws: 'm/s', wg: 'm/s', sr: 'W/m²', uv: 'UV' };
const AGGREGATION_METHOD = { temp: 'avg', hum: 'avg', press: 'avg', ws: 'avg', wg: 'max', rain: 'sum', sr: 'max', uv: 'max' };

function getGroupKey(timestamp, granularity) { /* ... (bez zmeny) ... */ const date=new Date(timestamp);if("hourly"===granularity)return date.setMinutes(0,0,0);if("weekly"===granularity){const day=date.getDay(),diff=date.getDate()-day+(0===day?-6:1);return new Date(date.setDate(diff)).setHours(0,0,0,0)}return date.setHours(0,0,0,0)}

export function aggregateCustomRange(data, variables, rangeInDays) {
    let granularity;
    if (rangeInDays <= 1) granularity = 'hourly';
    else if (rangeInDays > 90) granularity = 'weekly';
    else granularity = 'daily';

    const groupedData = new Map();
    data.forEach(item => { const key = getGroupKey(item.t, granularity); if (!groupedData.has(key)) groupedData.set(key, []); groupedData.get(key).push(item); });

    const aggregatedPeriods = [];
    Array.from(groupedData.keys()).sort((a,b) => a-b).forEach(key => {
        const periodItems = groupedData.get(key);
        const periodResult = { timestamp: key, values: {} };
        variables.forEach(variable => {
            const values = periodItems.map(item => item[variable]).filter(v => v !== null);
            if (values.length === 0) { periodResult.values[variable] = { min: null, avg: null, max: null, sum: null }; return; }
            const sum = values.reduce((a, b) => a + b, 0);
            periodResult.values[variable] = { min: Math.min(...values), avg: sum / values.length, max: Math.max(...values), sum: sum };
        });
        aggregatedPeriods.push(periodResult);
    });

    // =======================================================
    // NOVÉ: Výpočet dát pre veternú ružicu
    // =======================================================
    let windRoseData = null;
    if (variables.includes('ws') || variables.includes('wg')) {
        const directionCounts = new Array(16).fill(0);
        let totalCount = 0;
        data.forEach(item => {
            if (item.ws !== null && item.ws > 0.5 && item.wd !== null) {
                const sectorIndex = Math.floor((item.wd / 22.5) + 0.5) % 16;
                directionCounts[sectorIndex]++;
                totalCount++;
            }
        });
        if (totalCount > 0) {
            windRoseData = directionCounts.map(count => (count / totalCount) * 100);
        }
    }
    // =======================================================

    const summaries = {};
    variables.forEach(variable => {
        // ... (logika pre summaries zostáva bez zmeny)
        const allItems=data.filter(item=>item[variable]!==null);if(0===allItems.length)return void(summaries[variable]={max:null,min:null,avg:null,total:null});if("rain"===variable){const dailyTotals=aggregatedPeriods.map(d=>d.values.rain?.sum).filter(v=>v!==null);if(dailyTotals.length>0){const maxDay=Math.max(...dailyTotals),maxDayIndex=dailyTotals.indexOf(maxDay);summaries[variable]={total:dailyTotals.reduce((a,b)=>a+b,0),max:maxDay,maxTime:aggregatedPeriods[maxDayIndex]?.timestamp,avg:dailyTotals.reduce((a,b)=>a+b,0)/dailyTotals.length}}}else{const allValues=allItems.map(item=>item[variable]),maxVal=Math.max(...allValues);let minVal;"ws"===variable||"wg"===variable?minVal=(nonZeroValues=allValues.filter(v=>v>0)).length>0?Math.min(...nonZeroValues):null:minVal=Math.min(...allValues);var nonZeroValues;summaries[variable]={max:maxVal,min:minVal,avg:allValues.reduce((a,b)=>a+b,0)/allValues.length,maxTime:allItems.find(item=>item[variable]===maxVal)?.t,minTime:null!==minVal?allItems.find(item=>item[variable]===minVal)?.t:null,unit:UNITS[variable]}}
    });
    
    return { aggregatedPeriods, summaries, granularity, aggregationMethod: AGGREGATION_METHOD, windRoseData };
}
