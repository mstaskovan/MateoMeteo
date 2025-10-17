// js/custom-aggregation.js
import { formatTimestampToLocalDate } from './utils.js';

const UNITS = { temp: '°C', hum: '%', press: 'hPa', rain: 'mm', ws: 'm/s', wg: 'm/s', sr: 'W/m²', uv: 'UV' };
const AGGREGATION_METHOD = { temp: 'avg', hum: 'avg', press: 'avg', ws: 'avg', wg: 'max', rain: 'sum', sr: 'max', uv: 'max' };

/**
 * ZDIELANÁ POMOCNÁ FUNKCIA: Presne vypočíta súčet prírastkov zrážok.
 * @param {Array} items Pole dátových záznamov.
 * @returns {number} Celkový súčet zrážok.
 */
function calculateRainIncrementSum(items) {
    if (items.length < 2) return 0;
    const sortedItems = [...items].sort((a, b) => a.t - b.t);
    let rainSum = 0;
    for (let i = 1; i < sortedItems.length; i++) {
        const prevRain = sortedItems[i - 1].rain;
        const currentRain = sortedItems[i].rain;
        if (prevRain === null || currentRain === null) continue;
        const increment = currentRain < prevRain ? currentRain : currentRain - prevRain;
        if (increment > 0) {
            rainSum += increment;
        }
    }
    return rainSum;
}

/**
 * ZDIELANÁ POMOCNÁ FUNKCIA: Určí najčastejší smer vetra.
 * @param {Array} items Pole dátových záznamov.
 * @returns {number|null} Prevažujúci smer vetra v stupňoch.
 */
function calculateWindMode(items) {
    const wdCounts = new Map();
    const MIN_WIND_SPEED_FILTER = 1.0;
    items.forEach(item => {
        if (item.ws !== null && item.ws >= MIN_WIND_SPEED_FILTER && item.wd !== null) {
            wdCounts.set(item.wd, (wdCounts.get(item.wd) || 0) + 1);
        }
    });
    let modeWD = null, maxCount = 0;
    wdCounts.forEach((count, wd) => { if (count > maxCount) { maxCount = count; modeWD = wd; } });
    return modeWD;
}

function getGroupKey(timestamp, granularity) {
    const date = new Date(timestamp);
    if (granularity === 'hourly') {
        return date.setMinutes(0, 0, 0);
    }
    if (granularity === 'weekly') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
    }
    return date.setHours(0, 0, 0, 0);
}

export function aggregateCustomRange(data, variables, rangeInDays) {
    let granularity;
    if (rangeInDays <= 1) granularity = 'hourly';
    else if (rangeInDays > 90) granularity = 'weekly';
    else granularity = 'daily';

    const groupedData = new Map();
    data.forEach(item => {
        const key = getGroupKey(item.t, granularity);
        if (!groupedData.has(key)) groupedData.set(key, []);
        groupedData.get(key).push(item);
    });

    const aggregatedPeriods = [];
    Array.from(groupedData.keys()).sort((a, b) => a - b).forEach(key => {
        const periodItems = groupedData.get(key);
        const periodResult = { timestamp: key, values: {} };
        variables.forEach(variable => {
            const values = periodItems.map(item => item[variable]).filter(v => v !== null);
            if (values.length === 0) {
                periodResult.values[variable] = { min: null, avg: null, max: null, sum: null };
                return;
            }
            // UPRAVENÁ LOGIKA PRE ZRÁŽKY V RÁMCI PERIÓDY
            const sum = variable === 'rain' ? calculateRainIncrementSum(periodItems) : values.reduce((a, b) => a + b, 0);
            periodResult.values[variable] = { min: Math.min(...values), avg: sum / values.length, max: Math.max(...values), sum: sum };
        });
        aggregatedPeriods.push(periodResult);
    });

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

    const summaries = {};
    variables.forEach(variable => {
        const allItems = data.filter(item => item[variable] !== null);
        if (allItems.length === 0) {
            summaries[variable] = { max: null, min: null, avg: null, total: null, wdMode: null };
            return;
        }

        if (variable === 'rain') {
            const dailyTotals = aggregatedPeriods.map(d => d.values.rain?.sum).filter(v => v !== null && v !== undefined);
            if (dailyTotals.length > 0) {
                const maxDay = Math.max(...dailyTotals);
                const maxDayIndex = dailyTotals.indexOf(maxDay);
                summaries[variable] = {
                    total: calculateRainIncrementSum(allItems), // Presný celkový súčet
                    max: maxDay,
                    maxTime: aggregatedPeriods[maxDayIndex]?.timestamp,
                    avg: dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length,
                };
            }
        } else {
            const allValues = allItems.map(item => item[variable]);
            const maxVal = Math.max(...allValues);
            
            let minVal;
            if (variable === 'ws' || variable === 'wg') {
                const nonZeroValues = allValues.filter(v => v > 0);
                minVal = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : null;
            } else {
                minVal = Math.min(...allValues);
            }

            summaries[variable] = {
                max: maxVal,
                min: minVal,
                avg: allValues.reduce((a, b) => a + b, 0) / allValues.length,
                maxTime: allItems.find(item => item[variable] === maxVal)?.t,
                minTime: minVal !== null ? allItems.find(item => item[variable] === minVal)?.t : null,
                unit: UNITS[variable],
                wdMode: (variable === 'ws' || variable === 'wg') ? calculateWindMode(allItems) : null,
            };
        }
    });
    
    return { aggregatedPeriods, summaries, granularity, aggregationMethod: AGGREGATION_METHOD, windRoseData };
}
