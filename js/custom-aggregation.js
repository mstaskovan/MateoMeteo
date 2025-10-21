// js/custom-aggregation.js
import { formatTimestampToLocalDate } from './utils.js';

const UNITS = { temp: '°C', hum: '%', press: 'hPa', rain: 'mm', ws: 'm/s', wg: 'm/s', sr: 'W/m²', uv: 'UV' };
const AGGREGATION_METHOD = { temp: 'avg', hum: 'avg', press: 'avg', ws: 'avg', wg: 'max', rain: 'sum', sr: 'max', uv: 'max' };

/**
 * FINÁLNA VERZIA: Pomocná funkcia na výpočet prírastkov zrážok,
 * ktorá správne ošetruje NULL hodnoty (výpadky dát).
 */
function calculateRainIncrements(items) {
    const sortedItems = [...items].sort((a, b) => a.t - b.t);
    const rainIncrements = new Map();
    let lastValidRain = null;

    for (let i = 0; i < sortedItems.length; i++) {
        const curr = sortedItems[i];
        
        if (curr.rain === null || typeof curr.rain === 'undefined') {
            continue; // Preskočíme neplatné/chýbajúce záznamy
        }

        // Ak je to prvý platný záznam, ktorý nájdeme
        if (lastValidRain === null) {
            lastValidRain = curr.rain;
            // Prvý záznam dňa (alebo po sérii null) môže sám o sebe predstavovať prírastok (ak bol reset o polnoci)
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

/**
 * ZDIELANÁ POMOCNÁ FUNKCIA: Určí najčastejší smer vetra.
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

    // --- LOGIKA VÝPOČTU ZRÁŽOK ---
    const rainIncrements = calculateRainIncrements(data);
    let totalRainSum = 0;
    rainIncrements.forEach(inc => totalRainSum += inc);
    totalRainSum = Math.round(totalRainSum * 10) / 10;
    // --- KONIEC LOGIKY ---

    const groupedData = new Map();
    data.forEach(item => {
        const key = getGroupKey(item.t, granularity);
        if (!groupedData.has(key)) groupedData.set(key, []);
        // Pridáme len položky, ktoré majú dáta (pre ostatné metriky)
        if (item.temp !== null) {
            groupedData.get(key).push(item);
        }
    });

    const aggregatedPeriods = [];
    Array.from(groupedData.keys()).sort((a, b) => a - b).forEach(key => {
        const periodItems = groupedData.get(key); // Items s platnými dátami
        const periodResult = { timestamp: key, values: {} };
        
        // Získame VŠETKY položky (vrátane null) len pre zistenie timestampov
        const allPeriodItems = data.filter(item => getGroupKey(item.t, granularity) === key);

        variables.forEach(variable => {
            const values = periodItems.map(item => item[variable]).filter(v => v !== null);
            if (values.length === 0 && variable !== 'rain') {
                periodResult.values[variable] = { min: null, avg: null, max: null, sum: null };
                return;
            }

            let sum;
            if (variable === 'rain') {
                let periodRainSum = 0;
                allPeriodItems.forEach(item => {
                    if (rainIncrements.has(item.t)) {
                        periodRainSum += rainIncrements.get(item.t);
                    }
                });
                sum = Math.round(periodRainSum * 10) / 10;
            } else {
                sum = values.reduce((a, b) => a + b, 0);
            }
            
            periodResult.values[variable] = { 
                min: values.length > 0 ? Math.min(...values) : null, 
                avg: (variable !== 'rain' && values.length > 0) ? sum / values.length : null, 
                max: values.length > 0 ? Math.max(...values) : null, 
                sum: sum 
            };
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
        
        if (variable === 'rain') {
            const periodTotals = aggregatedPeriods.map(d => d.values.rain?.sum).filter(v => v !== null && v !== undefined);
            if (periodTotals.length > 0) {
                const maxPeriod = Math.max(...periodTotals);
                const maxPeriodIndex = periodTotals.indexOf(maxPeriod);
                summaries[variable] = {
                    total: totalRainSum, 
                    max: maxPeriod,
                    maxTime: aggregatedPeriods[maxPeriodIndex]?.timestamp,
                    avg: totalRainSum / periodTotals.length,
                };
            } else {
                 summaries[variable] = { max: null, avg: null, total: totalRainSum };
            }
        } else {
             if (allItems.length === 0) {
                summaries[variable] = { max: null, min: null, avg: null, total: null, wdMode: null };
                return;
            }
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
