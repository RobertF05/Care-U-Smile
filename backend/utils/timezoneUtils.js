// timezoneUtils.js - VERSIÓN COMPLETA CON TODAS LAS EXPORTACIONES
/**
 * Utilidades para manejo de zona horaria de Nicaragua (UTC-6)
 */

// Nicaragua está en UTC-6 todo el año (no hay horario de verano)
const NICARAGUA_OFFSET = -6 * 60 * 60 * 1000; // -6 horas en milisegundos

/**
 * Convierte una fecha de Nicaragua a UTC
 * @param {string|Date} dateTimeNicaragua - Fecha/hora en zona Nicaragua
 * @returns {Date} - Fecha en UTC
 */
export const toUTCFromNicaragua = (dateTimeNicaragua) => {
  if (!dateTimeNicaragua) return new Date();
  
  let date;
  if (typeof dateTimeNicaragua === 'string') {
    date = new Date(dateTimeNicaragua);
  } else {
    date = new Date(dateTimeNicaragua);
  }
  
  // Crear fecha UTC equivalente
  const utcDate = new Date(date.getTime() - NICARAGUA_OFFSET);
  return utcDate;
};

/**
 * Convierte UTC a hora Nicaragua
 * @param {string|Date} utcDateTime - Fecha/hora en UTC
 * @returns {Date} - Fecha en hora Nicaragua
 */
export const toNicaraguaTime = (utcDateTime) => {
  if (!utcDateTime) return new Date();
  
  const date = new Date(utcDateTime);
  return new Date(date.getTime() + NICARAGUA_OFFSET);
};

/**
 * Formatea fecha UTC como string Nicaragua
 * @param {string|Date} utcDateTime - Fecha/hora en UTC
 * @returns {string} - Fecha formateada en Nicaragua
 */
export const formatNicaraguaDateTime = (utcDateTime) => {
  if (!utcDateTime) return '';
  
  const nicaraguaDate = toNicaraguaTime(utcDateTime);
  
  return nicaraguaDate.toLocaleString('es-NI', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

/**
 * Formatea solo la fecha (sin hora)
 */
export const formatNicaraguaDate = (utcDateTime) => {
  if (!utcDateTime) return '';
  
  const nicaraguaDate = toNicaraguaTime(utcDateTime);
  
  return nicaraguaDate.toLocaleDateString('es-NI', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Crea un rango de fechas UTC para consultas
 */
export const createNicaraguaDateRange = (dateString) => {
  // dateString está en hora Nicaragua (YYYY-MM-DD)
  const nicaraguaStart = new Date(dateString + 'T00:00:00');
  const nicaraguaEnd = new Date(dateString + 'T23:59:59');
  
  // Convertir a UTC para consultas
  const startUTC = new Date(nicaraguaStart.getTime() - NICARAGUA_OFFSET);
  const endUTC = new Date(nicaraguaEnd.getTime() - NICARAGUA_OFFSET);
  
  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString()
  };
};

/**
 * Crea un rango de fechas para un mes completo
 */
export const createMonthlyDateRange = (year, month) => {
  // Asegurar que el mes esté en formato 0-11
  const monthIndex = parseInt(month) - 1;
  
  // Primer día del mes en Nicaragua
  const nicaraguaStart = new Date(year, monthIndex, 1, 0, 0, 0);
  
  // Último día del mes en Nicaragua
  const nicaraguaEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
  
  // Convertir a UTC para consultas
  const startUTC = new Date(nicaraguaStart.getTime() - NICARAGUA_OFFSET);
  const endUTC = new Date(nicaraguaEnd.getTime() - NICARAGUA_OFFSET);
  
  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
    startNicaragua: nicaraguaStart,
    endNicaragua: nicaraguaEnd
  };
};

/**
 * Convierte fecha string a UTC (inicio del día)
 */
export const convertDateStringToUTCStart = (dateString) => {
  const nicaraguaStart = new Date(dateString + 'T00:00:00');
  const utcStart = new Date(nicaraguaStart.getTime() - NICARAGUA_OFFSET);
  return utcStart.toISOString();
};

/**
 * Convierte fecha string a UTC (fin del día)
 */
export const convertDateStringToUTCEnd = (dateString) => {
  const nicaraguaEnd = new Date(dateString + 'T23:59:59');
  const utcEnd = new Date(nicaraguaEnd.getTime() - NICARAGUA_OFFSET);
  return utcEnd.toISOString();
};

/**
 * Obtiene fecha actual en Nicaragua como string (YYYY-MM-DD)
 */
export const getCurrentNicaraguaDateString = () => {
  const now = new Date();
  const nicaraguaNow = new Date(now.getTime() + NICARAGUA_OFFSET);
  return nicaraguaNow.toISOString().split('T')[0];
};

/**
 * Ajusta fecha para consultas (convierte Nicaragua a UTC)
 * @param {string} dateString - Fecha en formato YYYY-MM-DD (Nicaragua)
 * @returns {string} - Fecha en formato YYYY-MM-DD (UTC)
 */
export const adjustDateForQuery = (dateString) => {
  if (!dateString) return '';
  
  // Si ya es YYYY-MM-DD, convertir a UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const nicaraguaDate = new Date(dateString + 'T00:00:00');
    const utcDate = new Date(nicaraguaDate.getTime() - NICARAGUA_OFFSET);
    return utcDate.toISOString().split('T')[0];
  }
  
  return dateString;
};

/**
 * Crea string para input datetime-local desde UTC
 */
export const createDateTimeInputFromUTC = (utcDateTime) => {
  if (!utcDateTime) return '';
  
  const nicaraguaDate = toNicaraguaTime(utcDateTime);
  const year = nicaraguaDate.getFullYear();
  const month = String(nicaraguaDate.getMonth() + 1).padStart(2, '0');
  const day = String(nicaraguaDate.getDate()).padStart(2, '0');
  const hours = String(nicaraguaDate.getHours()).padStart(2, '0');
  const minutes = String(nicaraguaDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Parsea input datetime-local a UTC
 */
export const parseDateTimeInputToUTC = (inputValue) => {
  if (!inputValue) return null;
  
  // El input datetime-local ya está en hora local (Nicaragua)
  const nicaraguaDate = new Date(inputValue);
  const utcDate = new Date(nicaraguaDate.getTime() - NICARAGUA_OFFSET);
  
  return utcDate.toISOString();
};

/**
 * Obtiene fecha/hora actual Nicaragua
 */
export const getCurrentNicaraguaDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() + NICARAGUA_OFFSET);
};

/**
 * Obtiene el primer y último día del mes actual en Nicaragua
 */
export const getCurrentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Convertir a Nicaragua
  const firstDayNicaragua = new Date(firstDay.getTime() + NICARAGUA_OFFSET);
  const lastDayNicaragua = new Date(lastDay.getTime() + NICARAGUA_OFFSET);
  
  return {
    firstDay: firstDayNicaragua.toISOString().split('T')[0],
    lastDay: lastDayNicaragua.toISOString().split('T')[0],
    firstDayUTC: new Date(firstDay.getTime() - NICARAGUA_OFFSET).toISOString(),
    lastDayUTC: new Date(lastDay.getTime() - NICARAGUA_OFFSET).toISOString()
  };
};

/**
 * Convierte fecha string a Nicaragua (inicio del día)
 */
export const convertDateStringToNicaraguaStart = (dateString) => {
  const start = new Date(dateString + 'T00:00:00');
  return start.toISOString().replace('Z', '');
};

/**
 * Convierte fecha string a Nicaragua (fin del día)
 */
export const convertDateStringToNicaraguaEnd = (dateString) => {
  const end = new Date(dateString + 'T23:59:59');
  return end.toISOString().replace('Z', '');
};

/**
 * Ajusta fecha para consultas Nicaragua (mantiene Nicaragua)
 */
export const adjustDateForNicaraguaQuery = (dateString) => {
  if (!dateString) return '';
  
  // Si ya es YYYY-MM-DD, dejarlo igual
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Convertir de otro formato a YYYY-MM-DD
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return dateString;
  }
};

// Exportar todas las funciones necesarias
export default {
  toUTCFromNicaragua,
  toNicaraguaTime,
  formatNicaraguaDateTime,
  formatNicaraguaDate,
  createNicaraguaDateRange,
  createMonthlyDateRange, // ¡AÑADIDA!
  convertDateStringToUTCStart,
  convertDateStringToUTCEnd,
  getCurrentNicaraguaDateString,
  adjustDateForQuery,
  createDateTimeInputFromUTC,
  parseDateTimeInputToUTC,
  getCurrentNicaraguaDateTime,
  getCurrentMonthRange,
  convertDateStringToNicaraguaStart,
  convertDateStringToNicaraguaEnd,
  adjustDateForNicaraguaQuery
};