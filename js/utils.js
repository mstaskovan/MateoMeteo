// js/utils.js

export const LOCAL_OFFSET_HOURS = 2;

// Zoznam svetových strán (UŽ S ANGLICKÝMI SKRATKAMI)
export const WIND_DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/**
 * PÔVODNÁ FUNKCIA: Vracia formát YYYY-MM-DD
 * (Potrebné pre filtrovanie dát v aggregation-methods.js)
 */
export function formatTimestampToLocalDate(timestamp) { 
    if (!timestamp) return ''; 
    const date = new Date(timestamp); 
    const localMs = date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000); 
    const localDate = new Date(localMs); 
    const year = localDate.getUTCFullYear(); 
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0'); 
    const day = String(localDate.getUTCDate()).padStart(2, '0'); 
    return `${year}-${month}-${day}`; 
}

/**
 * NOVÁ FUNKCIA: Vracia formát DD.MM.YYYY
 * (Použije sa len na zobrazenie v tabuľke Analýzy)
 */
export function formatTimestampToDisplayDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const localMs = date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000);
    const localDate = new Date(localMs);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
}

export function formatTimestampToDayMonth(timestamp) { 
    if (!timestamp) return ''; 
    // Táto funkcia teraz správne používa YYYY-MM-DD verziu
    const dateStr = formatTimestampToLocalDate(timestamp); 
    const [_, month, day] = dateStr.split('-'); 
    return `${day}.${month}.`; 
}

export function formatTimestampToLocalTime(timestamp) { 
    if (!timestamp) return ''; 
    const date = new Date(timestamp); 
    const localMs = date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000); 
    const localDate = new Date(localMs); 
    const hours = String(localDate.getUTCHours()).padStart(2, '0'); 
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0'); 
    return `${hours}:${minutes}`; 
}

export function degToCard(deg) {
    if (deg === null || isNaN(deg)) return '-';
    const val = Math.floor((deg / 22.5) + 0.5);
    // Prevod na anglické skratky (UŽ OPRAVENÉ)
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[val % 16];
}

export function generateAvailableDataString(fileList) { if (!fileList || fileList.length === 0) return "Žiadne dáta nie sú k dispozícii."; const yearMap = new Map(); fileList.forEach(file => { const [year, month] = file.replace('.json', '').split('_'); if (!yearMap.has(year)) yearMap.set(year, []); yearMap.get(year).push(parseInt(month, 10)); }); const parts = []; Array.from(yearMap.keys()).sort().forEach(year => { const months = yearMap.get(year).sort((a, b) => a - b); if (months.length === 0) return; let rangeStart = months[0]; let currentPart = `${year}/ ${rangeStart}`; for (let i = 1; i < months.length; i++) { if (months[i] !== months[i-1] + 1) { if (rangeStart !== months[i-1]) currentPart += `-${months[i-1]}`; parts.push(currentPart); rangeStart = months[i]; currentPart = `${year}/ ${rangeStart}`; } } if (rangeStart !== months[months.length-1]) currentPart += `-${months[months.length-1]}`; parts.push(currentPart); }); return parts.join(', '); }
