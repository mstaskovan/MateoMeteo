// js/custom-aggregation.js
import { formatTimestampToLocalDate } from './utils.js';

const UNITS = { temp: '°C', hum: '%', press: 'hPa', rain: 'mm', ws: 'm/s', wg: 'm/s' };

export function aggregateCustomRange(data, variables) {
    const dailyDataMap = new Map();
    data.forEach(item => {
        const day = formatTimestampToLocalDate(item.t);
        if (!dailyDataMap.has(day)) dailyDataMap.set(day, {});
        
        variables.forEach(variable => {
            if (!dailyDataMap.get(day)[variable]) dailyDataMap.get(day)[variable] = [];
            dailyDataMap.get(day)[variable].push(item[variable]);
        });
    });

    const dailyData = [];
    Array.from(dailyDataMap.keys()).sort().forEach(day => {
        const dayValues = {};
        variables.forEach(variable => {
            const values = dailyDataMap.get(day)[variable].filter(v => v !== null);
            if (values.length === 0) {
                dayValues[variable] = null;
                return;
            }
            if (variable === 'rain') {
                dayValues[variable] = Math.max(...values) - Math.min(...values);
            } else {
                dayValues[variable] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });
        dailyData.push({ date: day, values: dayValues });
    });

    const summaries = {};
    variables.forEach(variable => {
        const allItems = data.filter(item => item[variable] !== null);
        if (variable === 'rain') {
            const dailyTotals = dailyData.map(d => d.values.rain).filter(v => v !== null);
            if (dailyTotals.length > 0) {
                const maxDay = Math.max(...dailyTotals);
                const maxDayIndex = dailyTotals.indexOf(maxDay);
                summaries[variable] = {
                    total: dailyTotals.reduce((a, b) => a + b, 0),
                    max: maxDay,
                    maxTime: new Date(dailyData[maxDayIndex].date).getTime(),
                    avg: dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length,
                };
            }
        } else {
            const allValues = allItems.map(item => item[variable]);
            if (allValues.length > 0) {
                const maxVal = Math.max(...allValues);
                const minVal = Math.min(...allValues);
                summaries[variable] = {
                    max: maxVal, min: minVal,
                    avg: allValues.reduce((a, b) => a + b, 0) / allValues.length,
                    maxTime: allItems.find(item => item[variable] === maxVal)?.t,
                    minTime: allItems.find(item => item[variable] === minVal)?.t,
                };
            }
        }
    });
    
    return { dailyData, summaries };
}