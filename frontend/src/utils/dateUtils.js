// frontend/src/utils/dateUtils.js

// Constantes para Nicaragua
export const NICARAGUA_UTC_OFFSET = -6; // UTC-6 horas
export const NICARAGUA_OFFSET_MS = NICARAGUA_UTC_OFFSET * 60 * 60 * 1000;

/**
 * Convierte UTC a hora Nicaragua
 */
export function utcToNicaragua(utcDateString) {
  if (!utcDateString) return null;
  
  const date = new Date(utcDateString);
  return new Date(date.getTime() + NICARAGUA_OFFSET_MS);
}

/**
 * Convierte hora Nicaragua a UTC (para enviar al backend)
 */
export function nicaraguaToUTC(nicaraguaDate) {
  if (!nicaraguaDate) return null;
  
  const date = typeof nicaraguaDate === 'string' ? new Date(nicaraguaDate) : nicaraguaDate;
  return new Date(date.getTime() - NICARAGUA_OFFSET_MS);
}

/**
 * Formatea fecha en formato Nicaragua para mostrar
 */
export function formatNicaraguaDateTime(date, includeTime = true) {
  if (!date) return '';
  
  const nicaraguaDate = utcToNicaragua(date);
  
  const options = {
    timeZone: 'UTC', // Ya aplicamos el offset manualmente
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
 * Formatea solo la fecha (sin hora)
 */
export function formatNicaraguaDate(date) {
  return formatNicaraguaDateTime(date, false);
}

/**
 * Crea un string para input datetime-local desde una fecha UTC
 */
export function createDateTimeInputFromUTC(utcDateString) {
  if (!utcDateString) return '';
  
  const nicaraguaDate = utcToNicaragua(utcDateString);
  
  const year = nicaraguaDate.getFullYear();
  const month = String(nicaraguaDate.getMonth() + 1).padStart(2, '0');
  const day = String(nicaraguaDate.getDate()).padStart(2, '0');
  const hours = String(nicaraguaDate.getHours()).padStart(2, '0');
  const minutes = String(nicaraguaDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parsea un valor de input datetime-local a UTC (para enviar al backend)
 */
export function parseDateTimeInputToUTC(inputValue) {
  if (!inputValue) return null;
  
  // El input está en hora local del navegador (debería ser Nicaragua)
  const localDate = new Date(inputValue);
  return nicaraguaToUTC(localDate).toISOString();
}

/**
 * Obtiene la fecha actual en Nicaragua en formato YYYY-MM-DD
 */
export function getCurrentNicaraguaDateString() {
  const now = new Date();
  const nicaraguaDate = new Date(now.getTime() + NICARAGUA_OFFSET_MS);
  return nicaraguaDate.toISOString().split('T')[0];
}

/**
 * Obtiene la fecha/hora actual en Nicaragua
 */
export function getCurrentNicaraguaDateTime() {
  const now = new Date();
  return new Date(now.getTime() + NICARAGUA_OFFSET_MS);
}

/**
 * Convierte fecha de Nicaragua a formato para inputs date
 */
export function nicaraguaDateToInput(dateString) {
  if (!dateString) return '';
  return dateString.split('T')[0];
}

/**
 * Ajusta una fecha para queries (solo fecha, sin hora)
 */
export function adjustDateForQuery(dateString) {
  if (!dateString) return '';
  return dateString.split('T')[0];
}

/**
 * Valida si una fecha está en formato válido
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}