// js/data-loader.js
import { formatTimestampToLocalDate } from './utils.js';

let dataCache = {};

// Pomocná funkcia na získanie YYYY-MM z názvu súboru
const getYearMonthFromFile = (filename) => filename.replace('.json', '').replace('_', '-');

/**
 * Zistí dostupný rozsah dátumov na základe existujúcich JSON súborov.
 * @param {string[]} fileList - Zoznam potenciálnych súborov.
 * @returns {Promise<{min: string, max: string}>} - Minimálny a maximálny dostupný dátum.
 */
export async function getAvailableDateRange(fileList) {
    const availableMonths = [];
    for (const file of fileList) {
        try {
            const response = await fetch(`data/${file}`, { method: 'HEAD' });
            if (response.ok) {
                availableMonths.push(getYearMonthFromFile(file));
            }
        } catch (e) { /* Súbor neexistuje, ignorujeme */ }
    }

    if (availableMonths.length === 0) return { min: null, max: null };

    availableMonths.sort();
    const minMonth = availableMonths[0];
    const maxMonth = availableMonths[availableMonths.length - 1];
    
    const maxYear = parseInt(maxMonth.split('-')[0]);
    const maxM = parseInt(maxMonth.split('-')[1]);
    const lastDayOfMonth = new Date(maxYear, maxM, 0).getDate();

    return {
        min: `${minMonth}-01`,
        max: `${maxMonth}-${String(lastDayOfMonth).padStart(2, '0')}`,
    };
}

/**
 * Načíta a spojí dáta pre zvolený časový rozsah.
 * @param {string} fromDate - Dátum od (YYYY-MM-DD).
 * @param {string} toDate - Dátum do (YYYY-MM-DD).
 * @param {string[]} fileList - Zoznam súborov na kontrolu.
 * @returns {Promise<Object[]>} - Pole odfiltrovaných dátových záznamov.
 */
export async function loadDataForRange(fromDate, toDate, fileList) {
    const fromMonth = fromDate.substring(0, 7);
    const toMonth = toDate.substring(0, 7);
    
    const monthsToLoad = new Set();
    fileList.forEach(file => {
        const month = getYearMonthFromFile(file);
        if (month >= fromMonth && month <= toMonth) {
            monthsToLoad.add(file);
        }
    });

    let allData = [];
    for (const file of monthsToLoad) {
        if (dataCache[file]) {
            allData.push(...dataCache[file]);
        } else {
            const response = await fetch(`data/${file}`);
            const data = await response.json();
            dataCache[file] = data;
            allData.push(...data);
        }
    }

    // Odfiltrovanie presného rozsahu
    const fromTimestamp = new Date(fromDate).getTime();
    const toTimestamp = new Date(toDate).getTime() + (24 * 60 * 60 * 1000 - 1); // Koniec dňa

    return allData.filter(item => item.t >= fromTimestamp && item.t <= toTimestamp);
}