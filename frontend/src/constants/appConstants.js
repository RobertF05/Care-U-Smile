// frontend/src/constants/appConstants.js
export const APPOINTMENT_STATES = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

export const APPOINTMENT_STATE_LABELS = {
  [APPOINTMENT_STATES.SCHEDULED]: 'Programada',
  [APPOINTMENT_STATES.CONFIRMED]: 'Confirmada',
  [APPOINTMENT_STATES.COMPLETED]: 'Completada',
  [APPOINTMENT_STATES.CANCELLED]: 'Cancelada',
  [APPOINTMENT_STATES.NO_SHOW]: 'No asistió'
};

export const APPOINTMENT_STATE_COLORS = {
  [APPOINTMENT_STATES.SCHEDULED]: '#FFA726', // naranja
  [APPOINTMENT_STATES.CONFIRMED]: '#42A5F5', // azul
  [APPOINTMENT_STATES.COMPLETED]: '#66BB6A', // verde
  [APPOINTMENT_STATES.CANCELLED]: '#EF5350', // rojo
  [APPOINTMENT_STATES.NO_SHOW]: '#78909C'    // gris
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
  INSURANCE: 'insurance'
};

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.CASH]: 'Efectivo',
  [PAYMENT_METHODS.CARD]: 'Tarjeta',
  [PAYMENT_METHODS.TRANSFER]: 'Transferencia',
  [PAYMENT_METHODS.INSURANCE]: 'Seguro'
};

export const BILL_CATEGORIES = {
  RENT: 'rent',
  UTILITIES: 'utilities',
  SUPPLIES: 'supplies',
  SALARIES: 'salaries',
  MARKETING: 'marketing',
  MAINTENANCE: 'maintenance',
  OTHER: 'other'
};

export const BILL_CATEGORY_LABELS = {
  [BILL_CATEGORIES.RENT]: 'Alquiler',
  [BILL_CATEGORIES.UTILITIES]: 'Servicios',
  [BILL_CATEGORIES.SUPPLIES]: 'Insumos',
  [BILL_CATEGORIES.SALARIES]: 'Salarios',
  [BILL_CATEGORIES.MARKETING]: 'Marketing',
  [BILL_CATEGORIES.MAINTENANCE]: 'Mantenimiento',
  [BILL_CATEGORIES.OTHER]: 'Otros'
};

export const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];