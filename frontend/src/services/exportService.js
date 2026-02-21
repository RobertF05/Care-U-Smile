const API_URL = import.meta.env.VITE_API_URL || '';

export const exportService = {
  // Exportar a PDF
  async exportToPDF(type, id) {
    try {
      let endpoint;
      if (type === 'monthly') {
        endpoint = `/api/export/pdf/monthly/${id}`;
      } else {
        endpoint = `/api/export/pdf/daily/${id}`;
      }
      
      const url = `${API_URL}${endpoint}`;
      console.log('📤 Exportando PDF desde:', url);
      
      // Obtener token
      const token = localStorage.getItem('token');
      
      // Hacer fetch para verificar que el endpoint existe
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'user-id': this.getUserIdFromToken()
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Endpoint no encontrado: ${endpoint}. Verifica que la ruta existe en el backend.`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      // Verificar el tipo de contenido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text();
        console.error('Respuesta no es PDF:', text.substring(0, 200));
        throw new Error('El servidor no devolvió un PDF válido');
      }
      
      // Obtener el blob y descargar
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Obtener nombre del archivo
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `cierre_${type}_${id}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      return { success: true };
      
    } catch (error) {
      console.error('Error en exportación PDF:', error);
      throw error;
    }
  },
  
  // Exportar a Excel Detallado
  async exportToExcelDetailed(type, id) {
    try {
      let endpoint;
      if (type === 'monthly') {
        endpoint = `/api/export/excel/detailed/monthly/${id}`;
      } else {
        endpoint = `/api/export/excel/detailed/daily/${id}`;
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
          throw new Error(`Endpoint no encontrado: ${endpoint}. Verifica que la ruta existe en el backend.`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `cierre_${type}_${id}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      return { success: true };
      
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