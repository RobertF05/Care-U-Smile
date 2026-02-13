// frontend/src/pages/PatientPage/OdontogramSection.jsx
import React from 'react';

const OdontogramSection = ({ odontogramData = {}, isEditing = false, onOdontogramChange }) => {
  
  const handleChange = (section, e) => {
    if (onOdontogramChange) {
      onOdontogramChange(section, e.target.value);
    }
  };

  if (isEditing) {
    // Modo edición - formulario
    return (
      <div className="odontogram-form-section">
        <h4 className="odontogram-section-title">Odontograma</h4>
        <p className="odontogram-instructions">
          Ingresa la información de cada cuadrante dental según el formato establecido.
        </p>
        
        <div className="odontogram-input-grid">
          <div className="odontogram-input-group">
            <label>1. Superior Derecho</label>
            <textarea
              name="odontogram_1"
              value={odontogramData.odontogram_1 || ''}
              onChange={(e) => handleChange(1, e)}
              rows="4"
              placeholder="Ej: 1.1(01), 1.2(02), 1.3(05+01)..."
              className="odontogram-textarea"
            />
            <small className="odontogram-hint">Dientes: 18 al 11</small>
          </div>
          
          <div className="odontogram-input-group">
            <label>2. Superior Izquierdo</label>
            <textarea
              name="odontogram_2"
              value={odontogramData.odontogram_2 || ''}
              onChange={(e) => handleChange(2, e)}
              rows="4"
              placeholder="Ej: 2.1(01), 2.2(02), 2.3(05+01)..."
              className="odontogram-textarea"
            />
            <small className="odontogram-hint">Dientes: 21 al 28</small>
          </div>
          
          <div className="odontogram-input-group">
            <label>3. Inferior Izquierdo</label>
            <textarea
              name="odontogram_3"
              value={odontogramData.odontogram_3 || ''}
              onChange={(e) => handleChange(3, e)}
              rows="4"
              placeholder="Ej: 3.1(01), 3.2(02), 3.3(05+01)..."
              className="odontogram-textarea"
            />
            <small className="odontogram-hint">Dientes: 31 al 38</small>
          </div>
          
          <div className="odontogram-input-group">
            <label>4. Inferior Derecho</label>
            <textarea
              name="odontogram_4"
              value={odontogramData.odontogram_4 || ''}
              onChange={(e) => handleChange(4, e)}
              rows="4"
              placeholder="Ej: 4.1(01), 4.2(02), 4.3(05+01)..."
              className="odontogram-textarea"
            />
            <small className="odontogram-hint">Dientes: 41 al 48</small>
          </div>
        </div>
      </div>
    );
  }

  // Modo vista - solo lectura
  return (
    <div className="odontogram-view-section">
      <h4 className="odontogram-title">Odontograma</h4>
      
      <div className="odontogram-grid">
        {/* Sección 1 - Superior Derecho */}
        <div className="odontogram-segment">
          <div className="odontogram-header">1. Superior Derecho</div>
          <div className="odontogram-content">
            {odontogramData.odontogram_1 ? (
              <pre className="odontogram-pre">{odontogramData.odontogram_1}</pre>
            ) : (
              <p className="odontogram-empty">Sin datos</p>
            )}
          </div>
        </div>
        
        {/* Sección 2 - Superior Izquierdo */}
        <div className="odontogram-segment">
          <div className="odontogram-header">2. Superior Izquierdo</div>
          <div className="odontogram-content">
            {odontogramData.odontogram_2 ? (
              <pre className="odontogram-pre">{odontogramData.odontogram_2}</pre>
            ) : (
              <p className="odontogram-empty">Sin datos</p>
            )}
          </div>
        </div>
        
        {/* Sección 3 - Inferior Izquierdo */}
        <div className="odontogram-segment">
          <div className="odontogram-header">3. Inferior Izquierdo</div>
          <div className="odontogram-content">
            {odontogramData.odontogram_3 ? (
              <pre className="odontogram-pre">{odontogramData.odontogram_3}</pre>
            ) : (
              <p className="odontogram-empty">Sin datos</p>
            )}
          </div>
        </div>
        
        {/* Sección 4 - Inferior Derecho */}
        <div className="odontogram-segment">
          <div className="odontogram-header">4. Inferior Derecho</div>
          <div className="odontogram-content">
            {odontogramData.odontogram_4 ? (
              <pre className="odontogram-pre">{odontogramData.odontogram_4}</pre>
            ) : (
              <p className="odontogram-empty">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OdontogramSection;