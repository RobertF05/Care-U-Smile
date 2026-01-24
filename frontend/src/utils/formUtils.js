// frontend/src/utils/formUtils.js
import {
  getCurrentNicaraguaDateTime,
  getCurrentNicaraguaDateString,
  createDateTimeInputFromUTC,
  formatNicaraguaDateTime,
  formatNicaraguaDate
} from './dateUtils';

/**
 * Prepara datos iniciales para formulario de cita
 */
export function getInitialAppointmentData(appointment = null) {
  if (appointment) {
    return {
      ...appointment,
      appointment_date: appointment.appointment_date_input || 
        createDateTimeInputFromUTC(appointment.appointment_date_utc)
    };
  }
  
  return {
    Patient_ID: '',
    appointment_date: createDateTimeInputFromUTC(
      getCurrentNicaraguaDateTime().toISOString()
    ),
    query_type: 'CONSULTA',
    state: 'scheduled',
    is_orthodontics: false,
    observations: ''
  };
}

/**
 * Prepara datos iniciales para formulario de procedimiento
 */
export function getInitialProcedureData(procedure = null, appointment = null) {
  if (procedure) {
    return {
      ...procedure,
      procedure_date: procedure.procedure_date_input || 
        createDateTimeInputFromUTC(procedure.procedure_date_utc)
    };
  }
  
  if (appointment) {
    return {
      appointment_ID: appointment.appointment_ID,
      Patient_ID: appointment.Patient_ID,
      procedure_date: createDateTimeInputFromUTC(appointment.appointment_date_utc),
      procedure_description: '',
      total_cost: 0,
      payment_method: 'EFECTIVO',
      is_orthodontics: appointment.is_orthodontics,
      observations: appointment.observations || ''
    };
  }
  
  return {
    Patient_ID: '',
    procedure_date: createDateTimeInputFromUTC(
      getCurrentNicaraguaDateTime().toISOString()
    ),
    procedure_description: '',
    total_cost: 0,
    payment_method: 'EFECTIVO',
    is_orthodontics: false,
    observations: ''
  };
}

/**
 * Prepara datos iniciales para formulario de gasto
 */
export function getInitialBillData(bill = null) {
  if (bill) {
    return {
      ...bill,
      bill_date: bill.bill_date.split('T')[0] // Solo fecha
    };
  }
  
  return {
    description: '',
    amount: 0,
    bill_date: getCurrentNicaraguaDateString(),
    category: 'OPERATIVO',
    is_recurrent: false,
    expense_type: 'general'
  };
}

/**
 * Valida datos de formulario con fechas
 */
export function validateFormWithDates(formData, formType) {
  const errors = {};
  
  switch (formType) {
    case 'appointment':
      if (!formData.appointment_date) {
        errors.appointment_date = 'La fecha y hora son requeridas';
      }
      break;
      
    case 'procedure':
      if (!formData.procedure_date) {
        errors.procedure_date = 'La fecha es requerida';
      }
      break;
      
    case 'bill':
      if (!formData.bill_date) {
        errors.bill_date = 'La fecha es requerida';
      }
      break;
  }
  
  return errors;
}

/**
 * Prepara datos para enviar al backend (convierte fechas a UTC)
 */
export function prepareDataForBackend(formData, formType) {
  const data = { ...formData };
  
  switch (formType) {
    case 'appointment':
      if (data.appointment_date) {
        const localDate = new Date(data.appointment_date);
        data.appointment_date = new Date(
          localDate.getTime() - (6 * 60 * 60 * 1000)
        ).toISOString();
      }
      break;
      
    case 'procedure':
      if (data.procedure_date) {
        const localDate = new Date(data.procedure_date);
        data.procedure_date = new Date(
          localDate.getTime() - (6 * 60 * 60 * 1000)
        ).toISOString();
      }
      break;
      
    case 'bill':
      // bill_date ya está en formato YYYY-MM-DD
      break;
  }
  
  return data;
}