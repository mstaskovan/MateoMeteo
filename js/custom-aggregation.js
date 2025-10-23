// js/custom-aggregation.js
import { getStartOfHour, getStartOfDay, getStartOfWeek, WIND_DIRECTIONS } from './utils.js';

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
 * @param {Array} variables - Polia premenných (napr. ['temp', 'rain'])
 * @param {number} rangeInDays - Počet dní v rozsahu
 * @returns {Object} - { aggregatedPeriods, summaries, granularity, windRoseData, aggregationMethod }
 */
// ***** OPRAVA 1: Obnovený správny názov funkcie a argumenty *****
export function aggregateCustomRange(data, variables, rangeInDays) {
    
    // ***** OPRAVA 2: Vrátená chýbajúca logika pre granularitu *****
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
        // Premenovanie 't' na 'timestamp' pre konzistenciu s touto funkciou
        // (Dáta z loadDataForRange majú 't', 'temp', 'hum', ... ale interné funkcie čakajú 'timestamp')
        // Najlepšie je premapovať dáta na začiatku
        const mappedRecord = {
             timestamp: record.t,
             temp: record.temp,
             hum: record.hum,
             press: record.press,
             rain: record.rain,
             ws: record.ws,
             wg: record.wg,
             wd: record.wd,
             sr: record.sr,
             uv: record.uv
        };

        if (mappedRecord.rain !== null && mappedRecord.rain !== undefined) {
            if (lastRainValue !== null) {
                let increment = mappedRecord.rain - lastRainValue;
                if (increment < 0) {
                    // Reset počítadla (o polnoci alebo pri reštarte stanice)
                    increment = mappedRecord.rain; 
                }
                if (increment > 0) {
                    totalRainSum += increment;
                    // Uložíme prírastok k presnému timestampu záznamu
                    rainIncrements.set(mappedRecord.timestamp, increment);
                }
            }
            lastRainValue = mappedRecord.rain;
        }
    }
    
    // Premapujeme celý dataset pre ďalšie funkcie
    const mappedData = data.map(record => ({
         timestamp: record.t,
         temp: record.temp,
         hum: record.hum,
         press: record.press,
         rain: record.rain, // rain tu už nevyužijeme, ale pre úplnosť
         ws: record.ws,
         wg: record.wg,
         wd: record.wd,
         sr: record.sr,
         uv: record.uv
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
        if (variable === 'pressure' || variable === 'wind_speed' || variable === 'wind_gust' || variable === 'uv' || variable === 'solar_rad') {
            const validValues = mappedData.map(d => d[variable]).filter(v => v !== null && v !== undefined);
            if (validValues.length > 0) {
                const maxVal = Math.max(...validValues);
                const maxIndex = validValues.indexOf(maxVal);
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

            summaries[variable] = {
                total: totalRainSum, 
                max: maxDailyRain, // Toto je teraz správna MAX DENNÁ hodnota
                maxTime: maxDailyRainTime, // Toto je teraz správny dátum
                avg: dailyTotals.size > 0 ? totalRainSum / dailyTotals.size : 0, // Priemer na dni, kedy pršalo
            };
        // --- KONIEC OPRAVENÉHO BLOKU PRE ZRÁŽKY ---
        } else if (variable.includes('temp') || variable === 'humidity' || variable === 'dew_point') {
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

    // ***** OPRAVA 3: Vrátená chýbajúca logika pre veternú ružicu *****
    let windRoseData = null;
    if (variables.includes('ws') || variables.includes('wg')) {
        const windCounts = new Array(16).fill(0);
        let totalWindEvents = 0;
        const MIN_WIND_SPEED_FILTER = 0.5; // Zhodné s aggregation-methods.js

        mappedData.forEach(item => {
            if (item.ws !== null && item.ws >= MIN_WIND_SPEED_FILTER && item.wd !== null) {
                const val = Math.floor((item.wd / 22.5) + 0.5);
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
    
    // ***** OPRAVA 4: Vrátená chýbajúca logika pre metódy agregácie *****
    const aggregationMethod = {};
    variables.forEach(v => {
        // Predvolená metóda pre multigrafy (premenné okrem zrážok)
        aggregationMethod[v] = 'avg'; 
    });
    // Špeciálna metóda pre zrážky
    aggregationMethod['rain'] = 'sum';


    // ***** OPRAVA 5: Vrátenie všetkých potrebných dát *****
    return { aggregatedPeriods, summaries, granularity, windRoseData, aggregationMethod };
}
