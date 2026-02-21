const API_URL = import.meta.env.VITE_API_URL || '';

// Función para formatear fecha DD/MM/YYYY
const formatDateForFilename = (dateString) => {
  if (!dateString) return '';
  // Si viene como YYYY-MM-DD
  const parts = dateString.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
};

// Función para obtener el nombre del archivo según el tipo de cierre
const getFileName = (type, closingData) => {
  const fecha = new Date();
  const timestamp = fecha.toISOString().split('T')[0];
  
  if (type === 'daily') {
    // Formato: Cierre DD/MM/2026 (General) - YYYY-MM-DD
    const fechaFormateada = formatDateForFilename(closingData.closing_date);
    const tipoTexto = closingData.closing_type === 'orthodontics' ? 'Ortodoncia' : 'General';
    return `Cierre ${fechaFormateada} (${tipoTexto}) - ${timestamp}`;
  } 
  else if (type === 'monthly') {
    // Formato: Cierre MM/YYYY (General/Ortodoncia/Completo) - YYYY-MM-DD
    const monthNumber = getMonthNumber(closingData.month);
    const tipoTexto = 
      closingData.closing_type === 'orthodontics' ? 'Ortodoncia' : 
      closingData.closing_type === 'general' ? 'General' : 
      'Completo';
    return `Cierre ${monthNumber}/${closingData.year} (${tipoTexto}) - ${timestamp}`;
  }
  
  return `export_${type}_${timestamp}`;
};

// Helper para obtener número de mes
const getMonthNumber = (monthName) => {
  const months = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
  };
  return months[monthName?.toUpperCase()] || '01';
};

export const exportService = {
  // Exportar a PDF
  async exportToPDF(closing) {
    try {
      const { type, closing_id, ...closingData } = closing;
      
      let endpoint;
      if (type === 'monthly') {
        endpoint = `/api/export/pdf/monthly/${closing_id}`;
      } else {
        endpoint = `/api/export/pdf/daily/${closing_id}`;
      }
      
      const url = `${API_URL}${endpoint}`;
      console.log('📤 Exportando PDF desde:', url);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'user-id': this.getUserIdFromToken()
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Endpoint no encontrado: ${endpoint}`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text();
        console.error('Respuesta no es PDF:', text.substring(0, 200));
        throw new Error('El servidor no devolvió un PDF válido');
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Generar nombre personalizado
      const fileName = `${getFileName(type, closingData)}.pdf`;
      link.setAttribute('download', fileName);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      return { success: true, fileName };
      
    } catch (error) {
      console.error('Error en exportación PDF:', error);
      throw error;
    }
  },
  
  // Exportar a Excel Detallado
  async exportToExcelDetailed(closing) {
    try {
      const { type, closing_id, ...closingData } = closing;
      
      let endpoint;
      if (type === 'monthly') {
        endpoint = `/api/export/excel/detailed/monthly/${closing_id}`;
      } else {
        endpoint = `/api/export/excel/detailed/daily/${closing_id}`;
      }
      
      const url = `${API_URL}${endpoint}`;
      console.log('📤 Exportando Excel desde:', url);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'user-id': this.getUserIdFromToken()
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Endpoint no encontrado: ${endpoint}`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Generar nombre personalizado
      const fileName = `${getFileName(type, closingData)}.xlsx`;
      link.setAttribute('download', fileName);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      return { success: true, fileName };
      
    } catch (error) {
      console.error('Error en exportación Excel:', error);
      throw error;
    }
  },
  
  // Helper para obtener user-id del token
  getUserIdFromToken() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || payload.userId || payload.sub || '';
    } catch (e) {
      console.warn('No se pudo extraer user-id del token');
      return '';
    }
  }
};