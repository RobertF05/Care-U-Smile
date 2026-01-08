// frontend/src/utils/formatters.js
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

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