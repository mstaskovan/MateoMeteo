import { getStartOfHour, getStartOfDay, getStartOfWeek } from './utils.js';

// Helper funkcia pre agregáciu dát do hodinových blokov
function aggregateByHour(data, variables) {
    const hourlyData = new Map();

    for (const record of data) {
        const timestamp = getStartOfHour(record.timestamp).getTime();

        if (!hourlyData.has(timestamp)) {
            hourlyData.set(timestamp, { timestamp: timestamp, values: {} });
        }
        const hourData = hourlyData.get(timestamp);

        for (const variable of variables) {
            if (record[variable] !== null && record[variable] !== undefined) {
                if (!hourData.values[variable]) {
                    hourData.values[variable] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                }
                const stats = hourData.values[variable];
                stats.sum += record[variable];
                stats.count++;
                if (record[variable] < stats.min) stats.min = record[variable];
                if (record[variable] > stats.max) stats.max = record[variable];
            }
        }
    }

    return Array.from(hourlyData.values()).sort((a, b) => a.timestamp - b.timestamp);
}

// Helper funkcia pre agregáciu dát do denných blokov
function aggregateByDay(data, variables) {
    const dailyData = new Map();

    for (const record of data) {
        const timestamp = getStartOfDay(record.timestamp).getTime();

        if (!dailyData.has(timestamp)) {
            dailyData.set(timestamp, { timestamp: timestamp, values: {} });
        }
        const dayData = dailyData.get(timestamp);

        for (const variable of variables) {
            if (record[variable] !== null && record[variable] !== undefined) {
                if (!dayData.values[variable]) {
                    dayData.values[variable] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                }
                const stats = dayData.values[variable];
                stats.sum += record[variable];
                stats.count++;
                if (record[variable] < stats.min) stats.min = record[variable];
                if (record[variable] > stats.max) stats.max = record[variable];
            }
        }
    }
    
    return Array.from(dailyData.values()).sort((a, b) => a.timestamp - b.timestamp);
}

// Helper funkcia pre agregáciu dát do týždenných blokov
function aggregateByWeek(data, variables) {
    const weeklyData = new Map();

    for (const record of data) {
        const timestamp = getStartOfWeek(record.timestamp).getTime();

        if (!weeklyData.has(timestamp)) {
            weeklyData.set(timestamp, { timestamp: timestamp, values: {} });
        }
        const weekData = weeklyData.get(timestamp);

        for (const variable of variables) {
            if (record[variable] !== null && record[variable] !== undefined) {
                if (!weekData.values[variable]) {
                    weekData.values[variable] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                }
                const stats = weekData.values[variable];
                stats.sum += record[variable];
                stats.count++;
                if (record[variable] < stats.min) stats.min = record[variable];
                if (record[variable] > stats.max) stats.max = record[variable];
            }
        }
    }
    
    return Array.from(weeklyData.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Agreguje dáta (zo servera) a počíta súhrnné štatistiky.
 * @param {Array} data - Surové dáta z `data-loader.js`
 * @param {string} granularity - 'hourly', 'daily', 'weekly'
 * @param {Array} variables - Polia premenných (napr. ['temp', 'rain'])
 * @returns {Object} - { aggregatedPeriods, summaries }
 */
export function aggregateData(data, granularity, variables) {
    let aggregationFunction;
    
    if (granularity === 'hourly') {
        aggregationFunction = aggregateByHour;
    } else if (granularity === 'daily') {
        aggregationFunction = aggregateByDay;
    } else { // 'weekly'
        aggregationFunction = aggregateByWeek;
    }

    // 1. Výpočet prírastkov zrážok (rain_increment)
    // Toto je špeciálna logika len pre zrážky, keďže 'rain' je kumulatívny
    let lastRainValue = null;
    let totalRainSum = 0;
    const rainIncrements = new Map(); // Map<timestamp, increment>

    for (const record of data) {
        if (record.rain !== null && record.rain !== undefined) {
            if (lastRainValue !== null) {
                let increment = record.rain - lastRainValue;
                if (increment < 0) {
                    // Reset počítadla (o polnoci alebo pri reštarte stanice)
                    increment = record.rain; 
                }
                if (increment > 0) {
                    totalRainSum += increment;
                    // Uložíme prírastok k presnému timestampu záznamu
                    rainIncrements.set(record.timestamp, increment);
                }
            }
            lastRainValue = record.rain;
        }
    }

    // 2. Agregácia dát podľa zvolenej granularity
    // Agregujeme všetky premenné OKREM 'rain' (ktorý je kumulatívny)
    const nonRainVariables = variables.filter(v => v !== 'rain');
    const aggregatedPeriods = aggregationFunction(data, nonRainVariables);

    // 3. Vloženie agregovaných zrážok (súčtov) do agregovaných periód
    // Musíme prejsť všetky prírastky a pripočítať ich k správnemu bloku (hodina/deň/týždeň)
    if (variables.includes('rain')) {
        const getPeriodKey = (granularity === 'hourly') ? getStartOfHour :
                             (granularity === 'daily') ? getStartOfDay :
                             getStartOfWeek;

        const rainAggregates = new Map(); // Map<period_timestamp, sum>
        
        rainIncrements.forEach((increment, timestamp) => {
            const periodKey = getPeriodKey(timestamp).getTime();
            const currentSum = rainAggregates.get(periodKey) || 0;
            rainAggregates.set(periodKey, currentSum + increment);
        });

        // Priradenie súčtov zrážok do finálnych dát pre graf
        for (const period of aggregatedPeriods) {
            const periodKey = period.timestamp;
            const rainSum = rainAggregates.get(periodKey);
            
            if (rainSum !== null && rainSum !== undefined) {
                period.values.rain = {
                    sum: Math.round(rainSum * 10) / 10,
                    // Pre zrážky nepotrebujeme min/max/avg agregovaného obdobia, len súčet
                    min: null, 
                    max: null,
                    avg: null
                };
            }
        }
    }


    // 4. Výpočet finálnych min/max/avg hodnôt pre každú periódu
    for (const period of aggregatedPeriods) {
        for (const variable in period.values) {
            if (variable !== 'rain') { // Zrážky už majú finálny 'sum'
                const stats = period.values[variable];
                if (stats.count > 0) {
                    stats.avg = stats.sum / stats.count;
                } else {
                    stats.avg = null;
                    stats.min = null;
                    stats.max = null;
                }
            }
        }
    }

    // 5. Výpočet súhrnnej tabuľky (Total, Min, Max, Avg)
    const summaries = {};
    for (const variable of variables) {
        // Logika pre premenné, kde rátame min/max/avg z celého surového datasetu
        // (okrem 'rain', ktorý má špeciálnu logiku)
        if (variable === 'pressure' || variable === 'wind_speed' || variable === 'wind_gust' || variable === 'uv' || variable === 'solar_rad') {
            const validValues = data.map(d => d[variable]).filter(v => v !== null && v !== undefined);
            if (validValues.length > 0) {
                const maxVal = Math.max(...validValues);
                const maxIndex = validValues.indexOf(maxVal);
                summaries[variable] = {
                    max: maxVal,
                    maxTime: data[maxIndex]?.timestamp,
                };
            }
        }

        // --- ZAČIATOK OPRAVENÉHO BLOKU PRE ZRÁŽKY ---
        if (variable === 'rain') {
            // Vytvoríme mapu denných súčtov, bez ohľadu na granularitu grafu
            const dailyTotals = new Map();
            rainIncrements.forEach((increment, timestamp) => {
                // Získame kľúč dňa (napr. '2025-07-07 00:00:00')
                const dayKey = new Date(timestamp).setHours(0, 0, 0, 0);
                const currentTotal = dailyTotals.get(dayKey) || 0;
                dailyTotals.set(dayKey, currentTotal + increment);
            });

            let maxDailyRain = 0;
            let maxDailyRainTime = null;

            // Nájdeme maximum v našej mape denných súčtov
            dailyTotals.forEach((total, timestamp) => {
                if (total > maxDailyRain) {
                    maxDailyRain = total;
                    maxDailyRainTime = timestamp; // timestamp je už kľúč dňa
                }
            });
            
            // Zaokrúhlime finálnu hodnotu
            maxDailyRain = Math.round(maxDailyRain * 10) / 10;

            summaries[variable] = {
                total: totalRainSum, 
                max: maxDailyRain, // Toto je teraz správna MAX DENNÁ hodnota
                maxTime: maxDailyRainTime, // Toto je teraz správny dátum
                avg: dailyTotals.size > 0 ? totalRainSum / dailyTotals.size : 0, // Priemer na dni, kedy pršalo
            };
        // --- KONIEC OPRAVENÉHO BLOKU PRE ZRÁŽKY ---
        } else if (variable.includes('temp') || variable === 'humidity' || variable === 'dew_point') {
             const validValues = data.map(d => d[variable]).filter(v => v !== null && v !== undefined);
             if (validValues.length > 0) {
                const maxVal = Math.max(...validValues);
                const maxIndex = data.findIndex(d => d[variable] === maxVal);
                
                const minVal = Math.min(...validValues);
                const minIndex = data.findIndex(d => d[variable] === minVal);

                const sum = validValues.reduce((a, b) => a + b, 0);
                const avg = sum / validValues.length;

                summaries[variable] = {
                    max: maxVal,
                    maxTime: data[maxIndex]?.timestamp,
                    min: minVal,
                    minTime: data[minIndex]?.timestamp,
                    avg: avg,
                };
             }
        }
    }

    return { aggregatedPeriods, summaries };
}
