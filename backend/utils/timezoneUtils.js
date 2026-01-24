// backend/utils/timezoneUtils.js
// CAMBIA module.exports por export

// Constantes para Nicaragua
export const NICARAGUA_TIMEZONE = 'America/Managua';
export const NICARAGUA_UTC_OFFSET = -6; // UTC-6 horas
export const NICARAGUA_OFFSET_MS = NICARAGUA_UTC_OFFSET * 60 * 60 * 1000;

/**
 * Convierte cualquier fecha a hora de Nicaragua (para mostrar)
 */
export function toNicaraguaTime(date) {
  if (!date) return null;
  
  // Si es string, convertirlo a Date
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Aplicar offset de Nicaragua (UTC-6)
  return new Date(dateObj.getTime() + NICARAGUA_OFFSET_MS);
}

/**
 * Convierte hora Nicaragua a UTC para guardar en BD
 */
export function toUTCFromNicaragua(nicaraguaDate) {
  if (!nicaraguaDate) return null;
  
  const dateObj = typeof nicaraguaDate === 'string' ? new Date(nicaraguaDate) : nicaraguaDate;
  
  // Remover offset de Nicaragua (convertir a UTC)
  return new Date(dateObj.getTime() - NICARAGUA_OFFSET_MS);
}

/**
 * Obtiene fecha actual en Nicaragua
 */
export function getCurrentNicaraguaDate() {
  return toNicaraguaTime(new Date());
}

/**
 * Formatea fecha en formato Nicaragua CON hora
 */
export function formatNicaraguaDateTime(date, includeTime = true) {
  if (!date) return '';
  
  const nicaraguaDate = toNicaraguaTime(date);
  
  const options = {
    timeZone: 'UTC', // Porque ya aplicamos el offset manualmente
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return nicaraguaDate.toLocaleString('es-NI', options);
}

/**
 * Formatea solo la fecha (SIN hora) en formato Nicaragua
 */
export function formatNicaraguaDate(date) {
  if (!date) return '';
  
  const nicaraguaDate = toNicaraguaTime(date);
  
  const options = {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  return nicaraguaDate.toLocaleString('es-NI', options);
}

/**
 * Crea un rango de fechas para Nicaragua
 * Convierte fechas Nicaragua a UTC para consultas
 */
export function createNicaraguaDateRange(dateString) {
  // dateString en formato YYYY-MM-DD (asumido en hora Nicaragua)
  const nicaraguaStart = new Date(`${dateString}T00:00:00`);
  const nicaraguaEnd = new Date(`${dateString}T23:59:59.999`);
  
  return {
    start: toUTCFromNicaragua(nicaraguaStart).toISOString(),
    end: toUTCFromNicaragua(nicaraguaEnd).toISOString(),
    startNicaragua: nicaraguaStart,
    endNicaragua: nicaraguaEnd
  };
}

/**
 * Crea un rango de fechas para consultas mensuales
 */
export function createMonthlyDateRange(year, monthName) {
  const months = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
  };
  
  const monthNumber = months[monthName.toUpperCase()] || '01';
  const firstDay = `${year}-${monthNumber}-01`;
  const lastDay = new Date(year, parseInt(monthNumber), 0).getDate();
  
  const nicaraguaStart = new Date(`${firstDay}T00:00:00`);
  const nicaraguaEnd = new Date(`${year}-${monthNumber}-${lastDay}T23:59:59.999`);
  
  return {
    start: toUTCFromNicaragua(nicaraguaStart).toISOString(),
    end: toUTCFromNicaragua(nicaraguaEnd).toISOString(),
    startNicaragua: nicaraguaStart,
    endNicaragua: nicaraguaEnd
  };
}

/**
 * Convierte un string de fecha (YYYY-MM-DD) a fecha inicial del día en UTC
 */
export function convertDateStringToUTCStart(dateString) {
  if (!dateString) return null;
  const nicaraguaDate = new Date(`${dateString}T00:00:00`);
  return toUTCFromNicaragua(nicaraguaDate).toISOString();
}

/**
 * Convierte un string de fecha (YYYY-MM-DD) a fecha final del día en UTC
 */
export function convertDateStringToUTCEnd(dateString) {
  if (!dateString) return null;
  const nicaraguaDate = new Date(`${dateString}T23:59:59.999`);
  return toUTCFromNicaragua(nicaraguaDate).toISOString();
}

/**
 * Obtiene la fecha actual en Nicaragua en formato YYYY-MM-DD
 */
export function getCurrentNicaraguaDateString() {
  const nicaraguaDate = getCurrentNicaraguaDate();
  return nicaraguaDate.toISOString().split('T')[0];
}

/**
 * Ajusta una fecha ISO para consultas de rango (para fechas DATE en BD)
 */
export function adjustDateForQuery(dateString) {
  // Para campos DATE (no TIMESTAMP), no necesitamos conversión de zona horaria
  // Solo asegurarnos de que esté en formato YYYY-MM-DD
  if (!dateString) return '';
  return dateString.split('T')[0];
}