// js/custom-aggregation.js
import { formatTimestampToLocalDate } from './utils.js';

const UNITS = { temp: '°C', hum: '%', press: 'hPa', rain: 'mm', ws: 'm/s', wg: 'm/s', sr: 'W/m²', uv: 'UV', rr: 'mm/h' };
const AGGREGATION_METHOD = { temp: 'avg', hum: 'avg', press: 'avg', ws: 'avg', wg: 'max', rain: 'sum', sr: 'max', uv: 'max', rr: 'max' };

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
    if (rangeInDays <= 2) granularity = 'hourly';
    else if (rangeInDays > 90) granularity = 'weekly';
    else granularity = 'daily';

    // Predspracovanie dát pre výpočet prírastkov zrážok
    let processedData = data;
    if (variables.includes('rain')) {
        let lastRainValue = -1;
        processedData = data.map(item => {
            const newItem = { ...item };
            if (newItem.rain !== null) {
                if (newItem.rain < lastRainValue) lastRainValue = 0;
                if (lastRainValue === -1) lastRainValue = newItem.rain > 0 ? newItem.rain : 0;
                newItem.rainIncrement = newItem.rain - lastRainValue;
                lastRainValue = newItem.rain;
            } else {
                newItem.rainIncrement = null;
            }
            return newItem;
        });
    }

    const groupedData = new Map();
    processedData.forEach(item => {
        const key = getGroupKey(item.t, granularity);
        if (!groupedData.has(key)) groupedData.set(key, []);
        groupedData.get(key).push(item);
    });

    const aggregatedPeriods = [];
    Array.from(groupedData.keys()).sort((a,b) => a-b).forEach(key => {
        const periodItems = groupedData.get(key);
        const periodResult = { timestamp: key, values: {} };
        variables.forEach(variable => {
            const targetProperty = variable === 'rain' ? 'rainIncrement' : variable;
            const values = periodItems.map(item => item[targetProperty]).filter(v => v !== null);
            if (values.length === 0) {
                periodResult.values[variable] = { min: null, avg: null, max: null, sum: null };
                return;
            }
            const sum = values.reduce((a, b) => a + b, 0);
            periodResult.values[variable] = { min: Math.min(...values), avg: sum / values.length, max: Math.max(...values), sum: sum };
        });
        aggregatedPeriods.push(periodResult);
    });

    const summaries = {};
    variables.forEach(variable => {
        const allItems = data.filter(item => item[variable] !== null);
        if (allItems.length === 0) {
            summaries[variable] = { max: null, min: null, avg: null, total: null };
            return;
        }

        if (variable === 'rain') {
            const periodTotals = aggregatedPeriods.map(p => p.values.rain?.sum).filter(v => v !== null && v !== undefined);
            const allRainRates = data.map(item => item.rr).filter(v => v !== null);

            if (periodTotals.length > 0) {
                const maxPeriodValue = Math.max(...periodTotals);
                const maxPeriodIndex = periodTotals.indexOf(maxPeriodValue);
                summaries[variable] = {
                    total: periodTotals.reduce((a, b) => a + b, 0),
                    max: maxPeriodValue,
                    maxTime: aggregatedPeriods[maxPeriodIndex]?.timestamp,
                    maxRate: allRainRates.length > 0 ? Math.max(...allRainRates) : null,
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
                unit: UNITS[variable]
            };
        }
    });
    
    return { aggregatedPeriods, summaries, granularity, aggregationMethod: AGGREGATION_METHOD };
}
