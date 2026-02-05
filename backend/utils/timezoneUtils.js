// timezoneUtils.js - VERSIÓN CORREGIDA
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
 * Formatea moneda en córdobas nicaragüenses
 * @param {number} amount - Monto a formatear
 * @param {boolean} includeSymbol - Si incluye el símbolo de moneda
 * @returns {string} - Monto formateado
 */
export const formatCurrency = (amount, includeSymbol = true) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    amount = 0;
  }
  
  return new Intl.NumberFormat('es-NI', {
    style: includeSymbol ? 'currency' : 'decimal',
    currency: 'NIO',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
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
 * Convierte fecha string a UTC (inicio del día) - VERSIÓN MEJORADA
 */
export const convertDateStringToUTCStart = (dateString) => {
  try {
    if (!dateString) {
      console.log('🔄 convertDateStringToUTCStart: fecha vacía');
      return null;
    }
    
    console.log('🔄 convertDateStringToUTCStart recibió:', dateString);
    
    // Si ya es una fecha ISO completa con Z
    if (dateString.includes('T') && dateString.endsWith('Z')) {
      console.log('✅ Ya es fecha ISO UTC:', dateString);
      return dateString;
    }
    
    // Si es solo fecha (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Asumir que es fecha en Nicaragua
      const nicaraguaStart = new Date(`${dateString}T00:00:00`);
      
      if (isNaN(nicaraguaStart.getTime())) {
        console.error('❌ Fecha inválida (YYYY-MM-DD):', dateString);
        return null;
      }
      
      const utcStart = new Date(nicaraguaStart.getTime() - NICARAGUA_OFFSET);
      const result = utcStart.toISOString();
      console.log('✅ Convertido YYYY-MM-DD a UTC:', result);
      return result;
    }
    
    // Si es una fecha ISO sin Z (ej: 2024-01-15T00:00:00.000)
    if (dateString.includes('T')) {
      try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          const result = date.toISOString();
          console.log('✅ Convertido ISO a UTC:', result);
          return result;
        } else {
          console.error('❌ Fecha ISO inválida:', dateString);
          return null;
        }
      } catch (error) {
        console.error('❌ Error parseando fecha ISO:', error.message);
        return null;
      }
    }
    
    console.error('❌ Formato de fecha no reconocido:', dateString);
    return null;
  } catch (error) {
    console.error('❌ Error en convertDateStringToUTCStart:', error.message, error.stack);
    return null;
  }
};

/**
 * Convierte fecha string a UTC (fin del día) - VERSIÓN MEJORADA
 */
export const convertDateStringToUTCEnd = (dateString) => {
  try {
    if (!dateString) {
      console.log('🔄 convertDateStringToUTCEnd: fecha vacía');
      return null;
    }
    
    console.log('🔄 convertDateStringToUTCEnd recibió:', dateString);
    
    // Si ya es una fecha ISO completa con Z
    if (dateString.includes('T') && dateString.endsWith('Z')) {
      console.log('✅ Ya es fecha ISO UTC:', dateString);
      return dateString;
    }
    
    // Si es solo fecha (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Asumir que es fecha en Nicaragua
      const nicaraguaEnd = new Date(`${dateString}T23:59:59.999`);
      
      if (isNaN(nicaraguaEnd.getTime())) {
        console.error('❌ Fecha inválida (YYYY-MM-DD):', dateString);
        return null;
      }
      
      const utcEnd = new Date(nicaraguaEnd.getTime() - NICARAGUA_OFFSET);
      const result = utcEnd.toISOString();
      console.log('✅ Convertido YYYY-MM-DD a UTC (fin):', result);
      return result;
    }
    
    // Si es una fecha ISO sin Z
    if (dateString.includes('T')) {
      try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          const result = date.toISOString();
          console.log('✅ Convertido ISO a UTC (fin):', result);
          return result;
        } else {
          console.error('❌ Fecha ISO inválida:', dateString);
          return null;
        }
      } catch (error) {
        console.error('❌ Error parseando fecha ISO:', error.message);
        return null;
      }
    }
    
    console.error('❌ Formato de fecha no reconocido:', dateString);
    return null;
  } catch (error) {
    console.error('❌ Error en convertDateStringToUTCEnd:', error.message, error.stack);
    return null;
  }
};

/**
 * Función auxiliar mejorada para convertir cualquier fecha a UTC string
 */
export const toUTCString = (dateInput) => {
  try {
    if (!dateInput) {
      console.log('🔄 toUTCString: entrada vacía');
      return null;
    }
    
    console.log('🔄 toUTCString recibió:', dateInput);
    
    // Si ya es string ISO
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        console.error('❌ Fecha string inválida:', dateInput);
        return null;
      }
      const result = date.toISOString();
      console.log('✅ String convertido a UTC:', result);
      return result;
    }
    
    // Si es Date object
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        console.error('❌ Fecha Date inválida:', dateInput);
        return null;
      }
      const result = dateInput.toISOString();
      console.log('✅ Date convertido a UTC:', result);
      return result;
    }
    
    console.error('❌ Tipo de entrada no soportado:', typeof dateInput, dateInput);
    return null;
  } catch (error) {
    console.error('❌ Error en toUTCString:', error.message, error.stack);
    return null;
  }
};

/**
 * Convierte cualquier fecha a string ISO de manera segura
 */
export const safeToISOString = (dateInput) => {
  try {
    if (!dateInput) return null;
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      console.error('❌ safeToISOString: fecha inválida', dateInput);
      return null;
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('❌ Error en safeToISOString:', error.message);
    return null;
  }
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
  formatCurrency,
  createNicaraguaDateRange,
  createMonthlyDateRange,
  convertDateStringToUTCStart,
  convertDateStringToUTCEnd,
  toUTCString,
  safeToISOString,
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