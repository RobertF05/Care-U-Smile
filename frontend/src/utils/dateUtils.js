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
// utils/dateUtils.js - Corregir adjustDateForQuery
// dateUtils.js - Corregir definitivamente
export const adjustDateForQuery = (dateString) => {
  console.log('📅 adjustDateForQuery input:', dateString);
  
  if (!dateString || dateString.trim() === '') {
    console.error('❌ Date string is empty');
    // Fallback seguro
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    console.log('📅 Using fallback date:', result);
    return result;
  }
  
  // Si ya está en formato YYYY-MM-DD, retornar directamente
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    console.log('✅ Already in correct format:', dateString);
    return dateString;
  }
  
  try {
    // Si es un objeto Date
    let date;
    if (dateString instanceof Date) {
      date = dateString;
    } else {
      // Intentar parsear como fecha
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date object');
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}`;
    console.log('📅 Formatted date:', result);
    return result;
  } catch (error) {
    console.error('❌ Error formatting date:', error, 'Input:', dateString);
    
    // Último fallback: fecha actual
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    console.log('📅 Using error fallback date:', result);
    return result;
  }
};  

// En AppContext.jsx - Modificar createDailyClosing
const createDailyClosing = async (closingData) => {
  try {
    console.log('📝 Datos del cierre diario a crear:', closingData);
    
    // Validar que la fecha no esté vacía
    if (!closingData.date) {
      throw new Error('La fecha es requerida');
    }
    
    // Asegurarse de que la fecha esté en formato YYYY-MM-DD
    const adjustedDate = adjustDateForQuery(closingData.date);
    console.log('📅 Fecha ajustada para query:', adjustedDate);
    
    const closingWithFormattedDate = {
      ...closingData,
      date: adjustedDate
    };
    
    const data = await apiFetch('/daily-closings', {
      method: 'POST',
      body: JSON.stringify(closingWithFormattedDate),
    });
    
    console.log('✅ Cierre diario creado exitosamente:', data);
    
    // Formatear fechas para mostrar
    const closingWithFormattedDates = {
      ...data.data,
      closing_date_display: formatNicaraguaDate(data.data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.data.created_at)
    };
    
    setDailyClosings(prev => [closingWithFormattedDates, ...prev]);
    
    return data;
  } catch (error) {
    console.error('❌ Error creando cierre diario:', error);
    setError('Error al crear cierre diario: ' + error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Valida si una fecha está en formato válido
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}