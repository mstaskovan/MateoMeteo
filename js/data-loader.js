// js/data-loader.js
import { formatTimestampToLocalDate } from './utils.js';

let dataCache = {};

/**
 * NOVÁ FUNKCIA: Načíta zoznam dostupných súborov z manifest.json
 */
export async function fetchAvailableFiles() {
    try {
        const response = await fetch('data/manifest.json');
        if (!response.ok) throw new Error('Manifest súbor nebol nájdený.');
        const manifest = await response.json();
        return manifest.availableFiles || [];
    } catch (error) {
        console.error("Chyba pri načítaní manifestu:", error);
        return [];
    }
}

const getYearMonthFromFile = (filename) => filename.replace('.json', '').replace('_', '-');

export async function getAvailableDateRange(fileList) {
    if (fileList.length === 0) return { min: null, max: null };

    const availableMonths = fileList.map(getYearMonthFromFile).sort();
    
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

    const fromTimestamp = new Date(fromDate).getTime();
    const toTimestamp = new Date(toDate).getTime() + (24 * 60 * 60 * 1000 - 1);

    return allData.filter(item => item.t >= fromTimestamp && item.t <= toTimestamp);
}
