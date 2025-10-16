// js/utils.js

export const LOCAL_OFFSET_HOURS = 2;

export function formatTimestampToLocalDate(timestamp) {
    const date = new Date(timestamp);
    const localMs = date.getTime() + (LOCAL_OFFSET_HOURS * 60 * 60 * 1000);
    const localDate = new Date(localMs);
    
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * NOVÁ FUNKCIA: Konvertuje timestamp na formát DD.MM.
 */
export function formatTimestampToDayMonth(timestamp) {
    if (!timestamp) return '';
    const dateStr = formatTimestampToLocalDate(timestamp); // YYYY-MM-DD
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
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[val % 16];
}
