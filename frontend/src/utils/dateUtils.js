// dateUtils.js - VERSIÓN SIMPLIFICADA Y FUNCIONAL
/**
 * Utilidades para fechas - VERSIÓN SIMPLIFICADA
 */

/**
 * Formatea una fecha para mostrar
 * @param {string|Date} dateString - Fecha en cualquier formato
 * @returns {string} - Fecha formateada
 */
export const formatDateTimeDisplay = (dateString) => {
  if (!dateString) return '';
  
  try {
    // Intentar parsear la fecha
    const date = new Date(dateString);
    
    // Verificar si es una fecha válida
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida en formatDateTimeDisplay:', dateString);
      return 'Fecha inválida';
    }
    
    // Formatear en hora Nicaragua
    return date.toLocaleString('es-NI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formateando fecha:', error, dateString);
    return dateString || 'Fecha inválida';
  }
};

/**
 * Formatea solo la hora
 */
export const formatTimeDisplay = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return '--:--';
    }
    
    return date.toLocaleTimeString('es-NI', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formateando hora:', error);
    return '--:--';
  }
};

/**
 * Formatea solo la fecha
 */
export const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-NI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formateando fecha corta:', error);
    return 'Fecha inválida';
  }
};

/**
 * Prepara fecha para input datetime-local
 */
export const prepareForDateTimeInput = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      // Retornar fecha actual si es inválida
      return getCurrentDateTimeForInput();
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error preparando fecha para input:', error);
    return getCurrentDateTimeForInput();
  }
};

/**
 * Crea string para input datetime-local desde UTC
 */
export const createDateTimeInputFromUTC = (utcDateTime) => {
  if (!utcDateTime) return '';
  
  try {
    const date = new Date(utcDateTime);
    
    if (isNaN(date.getTime())) {
      return getCurrentDateTimeForInput();
    }
    
    // Convertir UTC a Nicaragua (+6 horas)
    const nicaraguaDate = new Date(date.getTime() + (6 * 60 * 60 * 1000));
    
    const year = nicaraguaDate.getFullYear();
    const month = String(nicaraguaDate.getMonth() + 1).padStart(2, '0');
    const day = String(nicaraguaDate.getDate()).padStart(2, '0');
    const hours = String(nicaraguaDate.getHours()).padStart(2, '0');
    const minutes = String(nicaraguaDate.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error en createDateTimeInputFromUTC:', error);
    return getCurrentDateTimeForInput();
  }
};

/**
 * Obtiene fecha actual para input
 */
export const getCurrentDateTimeForInput = () => {
  // Obtener hora actual en Nicaragua (UTC-6)
  const now = new Date();
  const nicaraguaNow = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  
  const year = nicaraguaNow.getFullYear();
  const month = String(nicaraguaNow.getMonth() + 1).padStart(2, '0');
  const day = String(nicaraguaNow.getDate()).padStart(2, '0');
  const hours = String(nicaraguaNow.getHours()).padStart(2, '0');
  const minutes = String(nicaraguaNow.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Ajusta fecha para consultas
 */
export const adjustDateForQuery = (dateString) => {
  if (!dateString) return '';
  
  // Si ya es YYYY-MM-DD, dejarlo igual
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Convertir de otro formato
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error ajustando fecha para consulta:', error);
    return dateString;
  }
};

/**
 * Convierte fecha Nicaragua a UTC
 */
export const nicaraguaToUTC = (nicaraguaDateTime) => {
  if (!nicaraguaDateTime) return new Date();
  
  try {
    const date = new Date(nicaraguaDateTime);
    return new Date(date.getTime() - (6 * 60 * 60 * 1000));
  } catch (error) {
    console.error('Error convirtiendo Nicaragua a UTC:', error);
    return new Date();
  }
};

/**
 * Convierte UTC a fecha Nicaragua
 */
export const utcToNicaragua = (utcDateTime) => {
  if (!utcDateTime) return new Date();
  
  try {
    const date = new Date(utcDateTime);
    return new Date(date.getTime() + (6 * 60 * 60 * 1000));
  } catch (error) {
    console.error('Error convirtiendo UTC a Nicaragua:', error);
    return new Date();
  }
};

/**
 * Formatea fecha UTC a string Nicaragua
 */
export const formatNicaraguaDateTime = (utcDateTime) => {
  if (!utcDateTime) return '';
  
  try {
    const nicaraguaDate = utcToNicaragua(utcDateTime);
    return formatDateTimeDisplay(nicaraguaDate);
  } catch (error) {
    console.error('Error en formatNicaraguaDateTime:', error);
    return formatDateTimeDisplay(utcDateTime);
  }
};

/**
 * Formatea solo fecha Nicaragua
 */
export const formatNicaraguaDate = (utcDateTime) => {
  if (!utcDateTime) return '';
  
  try {
    const nicaraguaDate = utcToNicaragua(utcDateTime);
    return formatDateDisplay(nicaraguaDate);
  } catch (error) {
    console.error('Error en formatNicaraguaDate:', error);
    return formatDateDisplay(utcDateTime);
  }
};

/**
 * Obtiene fecha actual Nicaragua
 */
export const getCurrentNicaraguaDateString = () => {
  const now = new Date();
  const nicaraguaNow = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  return nicaraguaNow.toISOString().split('T')[0];
};

/**
 * Obtiene fecha/hora actual Nicaragua
 */
export const getCurrentNicaraguaDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() + (6 * 60 * 60 * 1000));
};

/**
 * Parsea input datetime-local a UTC
 */
export const parseDateTimeInputToUTC = (inputValue) => {
  if (!inputValue) return null;
  
  try {
    const nicaraguaDate = new Date(inputValue);
    const utcDate = new Date(nicaraguaDate.getTime() - (6 * 60 * 60 * 1000));
    return utcDate.toISOString();
  } catch (error) {
    console.error('Error parseando input a UTC:', error);
    return null;
  }
};

// Exportar todas las funciones
export default {
  formatDateTimeDisplay,
  formatTimeDisplay,
  formatDateDisplay,
  prepareForDateTimeInput,
  createDateTimeInputFromUTC,
  getCurrentDateTimeForInput,
  adjustDateForQuery,
  nicaraguaToUTC,
  utcToNicaragua,
  formatNicaraguaDateTime,
  formatNicaraguaDate,
  getCurrentNicaraguaDateString,
  getCurrentNicaraguaDateTime,
  parseDateTimeInputToUTC
};