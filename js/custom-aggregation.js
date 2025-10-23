// js/custom-aggregation.js

// ***** TOTO JE OPRAVENÝ RIADOK 1 *****
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
 * @param {Array} data - Surové dáta z `data-loader.js` (objekty s 't', 'temp', 'hum'...)
 * @param {Array} variables - Polia premenných (napr. ['temp', 'rain'])
 * @param {number} rangeInDays - Počet dní v rozsahu
 * @returns {Object} - { aggregatedPeriods, summaries, granularity, windRoseData, aggregationMethod }
 */
export function aggregateCustomRange(data, variables, rangeInDays) {
    
    let granularity;
    if (rangeInDays <= 2) {
        granularity = 'hourly';
    } else if (rangeInDays > 90) {
        granularity = 'weekly';
    } else {
        granularity = 'daily';
    }

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
        // 't' je timestamp
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
                    rainIncrements.set(record.t, increment);
                }
            }
            lastRainValue = record.rain;
        }
    }
    
    // Premapujeme celý dataset pre interné agregačné funkcie
    // (tie očakávajú 'timestamp' namiesto 't' a plné názvy)
    const mappedData = data.map(record => ({
         timestamp: record.t,
         temp: record.temp,
         humidity: record.hum, // mapovanie hum -> humidity
         pressure: record.press, // mapovanie press -> pressure
         rain: record.rain, 
         wind_speed: record.ws, // mapovanie ws -> wind_speed
         wind_gust: record.wg, // mapovanie wg -> wind_gust
         wind_dir: record.wd, // mapovanie wd -> wind_dir
         solar_rad: record.sr, // mapovanie sr -> solar_rad
         uv: record.uv
         // dew_point tu chýba, ak by bolo treba, muselo by sa vypočítať alebo pridať do 'data'
    }));


    // 2. Agregácia dát podľa zvolenej granularity
    // Agregujeme všetky premenné OKREM 'rain' (ktorý je kumulatívny)
    const nonRainVariables = variables.filter(v => v !== 'rain');
    const aggregatedPeriods = aggregationFunction(mappedData, nonRainVariables);

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
            
            // Zaistíme, že aj keď nepršalo, 'rain' objekt existuje (kvôli grafu)
            period.values.rain = {
                sum: (rainSum !== null && rainSum !== undefined) ? (Math.round(rainSum * 10) / 10) : 0,
                min: null, 
                max: null,
                avg: null
            };
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
        
        // Premenné len s maximom
        if (['pressure', 'wind_speed', 'wind_gust', 'uv', 'solar_rad'].includes(variable)) {
            const validValues = mappedData.map(d => d[variable]).filter(v => v !== null && v !== undefined);
            if (validValues.length > 0) {
                const maxVal = Math.max(...validValues);
                const maxIndex = mappedData.findIndex(d => d[variable] === maxVal);
                summaries[variable] = {
                    max: maxVal,
                    maxTime: mappedData[maxIndex]?.timestamp,
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
            
            // Zaokrúhlenie celkového súčtu
            const roundedTotalRainSum = Math.round(totalRainSum * 10) / 10;

            summaries[variable] = {
                total: roundedTotalRainSum, 
                max: maxDailyRain, // Toto je teraz správna MAX DENNÁ hodnota
                maxTime: maxDailyRainTime, // Toto je teraz správny dátum
                avg: dailyTotals.size > 0 ? roundedTotalRainSum / dailyTotals.size : 0, // Priemer na dni, kedy pršalo
            };
        // --- KONIEC OPRAVENÉHO BLOKU PRE ZRÁŽKY ---
        
        // Premenné s min/max/avg
        } else if (['temp', 'humidity', 'dew_point'].includes(variable)) {
             const validValues = mappedData.map(d => d[variable]).filter(v => v !== null && v !== undefined);
             if (validValues.length > 0) {
                const maxVal = Math.max(...validValues);
                const maxIndex = mappedData.findIndex(d => d[variable] === maxVal);
                
                const minVal = Math.min(...validValues);
                const minIndex = mappedData.findIndex(d => d[variable] === minVal);

                const sum = validValues.reduce((a, b) => a + b, 0);
                const avg = sum / validValues.length;

                summaries[variable] = {
                    max: maxVal,
                    maxTime: mappedData[maxIndex]?.timestamp,
                    min: minVal,
                    minTime: mappedData[minIndex]?.timestamp,
                    avg: avg,
                };
             }
        }
    }

    // 6. Logika pre veternú ružicu
    let windRoseData = null;
    if (variables.includes('wind_speed') || variables.includes('wind_gust')) {
        const windCounts = new Array(16).fill(0);
        let totalWindEvents = 0;
        const MIN_WIND_SPEED_FILTER = 0.5; // Zhodné s aggregation-methods.js

        mappedData.forEach(item => {
            // Používame 'wind_speed' a 'wind_dir' z mapovaných dát
            if (item.wind_speed !== null && item.wind_speed >= MIN_WIND_SPEED_FILTER && item.wind_dir !== null) {
                const val = Math.floor((item.wind_dir / 22.5) + 0.5);
                const directionIndex = val % 16;
                windCounts[directionIndex]++;
                totalWindEvents++;
            }
        });

        if (totalWindEvents > 0) {
            windRoseData = windCounts.map(count => (count / totalWindEvents) * 100);
        } else {
            windRoseData = new Array(16).fill(0);
        }
    }
    
    // 7. Logika pre metódy agregácie
    const aggregationMethod = {};
    variables.forEach(v => {
        // Predvolená metóda pre multigrafy (premenné okrem zrážok)
        aggregationMethod[v] = 'avg'; 
    });
    // Špeciálna metóda pre zrážky
    aggregationMethod['rain'] = 'sum';


    // 8. Vrátenie všetkých potrebných dát
    return { aggregatedPeriods, summaries, granularity, windRoseData, aggregationMethod };
}
