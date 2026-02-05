// frontend/src/utils/formatters.js
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO'
  }).format(amount || 0);
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  // Si ya es una fecha formateada del backend (contiene / o :)
  if (typeof dateString === 'string' && (dateString.includes('/') || dateString.includes(':'))) {
    // Extraer solo la parte de la fecha si hay hora
    const datePart = dateString.split(' ')[0];
    
    // Ya está en formato dd/mm/aaaa, devolver como está
    // Si quieres cambiar el formato, puedes hacerlo aquí
    return datePart;
  }
  
  // Si es un objeto Date o timestamp ISO
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.warn('Error formateando fecha:', dateString, error);
    return 'N/A';
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  // Si ya es una fecha formateada del backend
  if (typeof dateString === 'string' && dateString.includes('/') && dateString.includes(':')) {
    return dateString; // Ya está formateado, devolver como está
  }
  
  // Si es un objeto Date o timestamp ISO
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.warn('Error formateando fecha/hora:', dateString, error);
    return 'N/A';
  }
};

// Resto de funciones permanecen igual...
export const formatTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatPhone = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  const phoneStr = phoneNumber.toString();
  if (phoneStr.length === 8) {
    return `${phoneStr.slice(0, 4)}-${phoneStr.slice(4)}`;
  }
  
  return phoneStr;
};

export const formatFullName = (patient) => {
  if (!patient) return '';
  
  const parts = [
    patient.first_name,
    patient.middle_name,
    patient.first_last_name,
    patient.second_last_name
  ].filter(Boolean);
  
  return parts.join(' ');
};

export const calculateAge = (birthdate) => {
  if (!birthdate) return '';
  
  const today = new Date();
  const birthDate = new Date(birthdate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export const formatBoolean = (value) => {
  if (value === null || value === undefined) return "N/A";
  return value ? "Sí" : "No";
};