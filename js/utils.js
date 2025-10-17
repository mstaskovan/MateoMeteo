// js/utils.js

export const LOCAL_OFFSET_HOURS = 2;
export const WIND_DIRECTIONS = ["S", "SSV", "SV", "VSV", "V", "JVV", "JV", "JJV", "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ"];

// NOVÉ: Zoznam mesiacov v slovenčine
const slovakMonths = ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"];

/**
 * Univerzálna funkcia na formátovanie dátumu a času
 * @param {number | string} input - Timestamp alebo dátumový reťazec
 * @param {string} format - Formát, napr. 'DD. MM. YYYY' alebo 'Month YYYY'
 * @returns {string} Naformátovaný dátum/čas
 */
export function formatDateTime(input, format) {
    if (!input) return '';
    const date = new Date(input);
    // Aplikovanie lokálneho offsetu, ak je vstup timestamp
    if (typeof input === 'number') {
        date.setTime(date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000));
    }

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const monthName = slovakMonths[date.getUTCMonth()];

    let result = format;
    result = result.replace('DD', day);
    result = result.replace('MM', month);
    result = result.replace('YYYY', year);
    result = result.replace('Month', monthName);
    result = result.replace('HH', hours);
    result = result.replace('mm', minutes);
    
    return result;
}

// Staré funkcie (môžu byť nahradené novou, ale ponecháme pre spätnú kompatibilitu)
export function formatTimestampToLocalDate(timestamp) { if (!timestamp) return ''; const date = new Date(timestamp); const localMs = date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000); const localDate = new Date(localMs); const year = localDate.getUTCFullYear(); const month = String(localDate.getUTCMonth() + 1).padStart(2, '0'); const day = String(localDate.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
export function formatTimestampToDayMonth(timestamp) { if (!timestamp) return ''; const dateStr = formatTimestampToLocalDate(timestamp); const [_, month, day] = dateStr.split('-'); return `${day}.${month}.`; }
export function formatTimestampToLocalTime(timestamp) { if (!timestamp) return ''; const date = new Date(timestamp); const localMs = date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000); const localDate = new Date(localMs); const hours = String(localDate.getUTCHours()).padStart(2, '0'); const minutes = String(localDate.getUTCMinutes()).padStart(2, '0'); return `${hours}:${minutes}`; }
export function degToCard(deg) { if (deg === null || isNaN(deg)) return '-'; const val = Math.floor((deg / 22.5) + 0.5); const arr = ["S", "SSV", "SV", "VSV", "V", "JVV", "JV", "JJV", "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ"]; return arr[val % 16]; }
export function generateAvailableDataString(fileList) { if (!fileList || fileList.length === 0) return "Žiadne dáta nie sú k dispozícii."; const yearMap = new Map(); fileList.forEach(file => { const [year, month] = file.replace('.json', '').split('_'); if (!yearMap.has(year)) yearMap.set(year, []); yearMap.get(year).push(parseInt(month, 10)); }); const parts = []; Array.from(yearMap.keys()).sort().forEach(year => { const months = yearMap.get(year).sort((a, b) => a - b); if (months.length === 0) return; let rangeStart = months[0]; let currentPart = `${year}/ ${rangeStart}`; for (let i = 1; i < months.length; i++) { if (months[i] !== months[i-1] + 1) { if (rangeStart !== months[i-1]) currentPart += `-${months[i-1]}`; parts.push(currentPart); rangeStart = months[i]; currentPart = `${year}/ ${rangeStart}`; } } if (rangeStart !== months[months.length-1]) currentPart += `-${months[months.length-1]}`; parts.push(currentPart); }); return parts.join(', '); }
