// js/custom-aggregation.js
import { formatTimestampToLocalDate } from './utils.js';

const UNITS = { temp: '°C', hum: '%', press: 'hPa', rain: 'mm', ws: 'm/s', wg: 'm/s', sr: 'W/m²', uv: 'UV' };
// Pre zrážky budeme v grafe vždy zobrazovať súčet (teda úhrn za periódu)
const AGGREGATION_METHOD = { temp: 'avg', hum: 'avg', press: 'avg', ws: 'avg', wg: 'max', rain: 'sum', sr: 'max', uv: 'max' };

function getGroupKey(timestamp, granularity) {
    const date = new Date(timestamp);
    if (granularity === 'hourly') return date.setMinutes(0, 0, 0);
    if (granularity === 'weekly') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
    }
    return date.setHours(0, 0, 0, 0);
}

export function aggregateCustomRange(data, variables, rangeInDays) {
    let granularity;
    if (rangeInDays <= 2) granularity = 'hourly'; // Zmena na 2 dni pre hodinové zobrazenie
    else if (rangeInDays > 90) granularity = 'weekly';
    else granularity = 'daily';

    const groupedData = new Map();
    data.forEach(item => {
        const key = getGroupKey(item.t, granularity);
        if (!groupedData.has(key)) groupedData.set(key, []);
        groupedData.get(key).push(item);
    });

    const aggregatedPeriods = [];
    Array.from(groupedData.keys()).sort((a,b) => a-b).forEach(key => {
        const periodItems = groupedData.get(key);
        const periodResult = { timestamp: key, values: {} };

        variables.forEach(variable => {
            const values = periodItems.map(item => item[variable]).filter(v => v !== null);
            if (values.length === 0) {
                periodResult.values[variable] = { min: null, avg: null, max: null, sum: null };
                return;
            }

            // =======================================================
            // KĽÚČOVÁ OPRAVA: Správny kumulatívny výpočet pre zrážky
            // =======================================================
            let rainSum = null;
            if (variable === 'rain') {
                rainSum = Math.max(...values) - Math.min(...values);
            }
            // =======================================================

            periodResult.values[variable] = {
                min: Math.min(...values),
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                max: Math.max(...values),
                sum: rainSum // Pre zrážky je "sum" v skutočnosti úhrn (max - min)
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
        if (totalCount > 0) windRoseData = directionCounts.map(count => (count / totalCount) * 100);
    }

    const summaries = {};
    variables.forEach(variable => {
        const allItems = data.filter(item => item[variable] !== null);
        if (allItems.length === 0) {
            summaries[variable] = { max: null, min: null, avg: null, total: null };
            return;
        }

        if (variable === 'rain') {
            // Celkový súčet je súčtom všetkých hodinových/denných úhrnov
            const periodTotals = aggregatedPeriods.map(p => p.values.rain?.sum).filter(v => v !== null && v !== undefined);
            if (periodTotals.length > 0) {
                const maxPeriodValue = Math.max(...periodTotals);
                const maxPeriodIndex = periodTotals.indexOf(maxPeriodValue);
                summaries[variable] = {
                    total: periodTotals.reduce((a, b) => a + b, 0),
                    max: maxPeriodValue,
                    maxTime: aggregatedPeriods[maxPeriodIndex]?.timestamp,
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
                max: maxVal, min: minVal,
                avg: allValues.reduce((a, b) => a + b, 0) / allValues.length,
                maxTime: allItems.find(item => item[variable] === maxVal)?.t,
                minTime: minVal !== null ? allItems.find(item => item[variable] === minVal)?.t : null,
                unit: UNITS[variable]
            };
        }
    });
    
    return { aggregatedPeriods, summaries, granularity, aggregationMethod: AGGREGATION_METHOD, windRoseData };
}
