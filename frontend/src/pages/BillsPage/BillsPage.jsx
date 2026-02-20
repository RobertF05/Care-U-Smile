// frontend/src/pages/BillsPage/BillsPage.jsx
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMoneyBillWave,
  faFilter,
  faTimes,
  faSearch,
  faPlus,
  faTrash,
  faEdit,
  faCalendarAlt,
  faTags,
  faExchangeAlt,
  faChartBar,
  faReceipt,
  faSave,
  faBan,
  faFileInvoiceDollar,
  faChevronDown,
  faChevronUp,
  faRepeat,
  faCircleExclamation,
  faDollarSign
} from '@fortawesome/free-solid-svg-icons';
import { AppContext } from '../../context/AppContext';
import { AuthContext } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import './BillsPage.css';

// Categorías de gastos comunes en una clínica odontológica
const BILL_CATEGORIES = [
  'Materiales Odontológicos',
  'Insumos Médicos',
  'Equipamiento',
  'Mantenimiento',
  'Servicios Públicos',
  'Alquiler',
  'Salarios',
  'Honorarios Profesionales',
  'Marketing',
  'Seguros',
  'Licencias',
  'Capacitación',
  'Viajes',
  'Otros'
];

// Tipos de gastos
const BILL_TYPES = {
  FIXED: 'FIJO',
  VARIABLE: 'VARIABLE'
};

const BillsPage = () => {
  const { user } = useContext(AuthContext);
  const { 
    bills, 
    loading, 
    fetchBills,
    createBill,
    updateBill,
    deleteBill,
    apiFetch,
    systemSettings
  } = useContext(AppContext);

  const { addNotification } = useNotification();

  // Estados
  const [showFilters, setShowFilters] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [expandedBills, setExpandedBills] = useState({});
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Formularios CON SOPORTE PARA DÓLARES Y TIPO DE CAMBIO DINÁMICO
  const [newBill, setNewBill] = useState({
    description: '',
    amount: '',
    amount_USD: '',
    bill_date: new Date().toISOString().split('T')[0],
    category: 'Materiales Odontológicos',
    currency_used: 'NIO',
    exchange_rate_bill: systemSettings.exchange_rate || 36.5,
    is_recurrent: false
  });

  const [editBill, setEditBill] = useState({
    description: '',
    amount: '',
    amount_USD: '',
    bill_date: '',
    category: '',
    currency_used: 'NIO',
    exchange_rate_bill: systemSettings.exchange_rate || 36.5,
    is_recurrent: false
  });

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      fetchBills();
    }
  }, [user]);

  // Actualizar el tipo de cambio en los formularios cuando cambien los settings
  useEffect(() => {
    const exchangeRate = systemSettings.exchange_rate || 36.5;
    
    setNewBill(prev => {
      if (prev.exchange_rate_bill === (systemSettings.exchange_rate || 36.5)) {
        return {
          ...prev,
          exchange_rate_bill: exchangeRate
        };
      }
      return prev;
    });
    
    setEditBill(prev => ({
      ...prev,
      exchange_rate_bill: exchangeRate
    }));
  }, [systemSettings]);

  // Formateadores
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO'
    }).format(amount || 0);
  };

  const formatCurrencyUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
  if (!dateString) return '';

  // Tomar solo la parte YYYY-MM-DD
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');

  return `${day}/${month}/${year}`;
};

  // Función para manejar cambios en moneda
  const handleCurrencyChange = (field, value, isNewBill = true) => {
    const setter = isNewBill ? setNewBill : setEditBill;
    const current = isNewBill ? newBill : editBill;
    const exchangeRate = systemSettings.exchange_rate || 36.5;
    
    setter(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'exchange_rate_bill') {
        const rate = parseFloat(value) || exchangeRate;
        if (updated.currency_used === 'USD' && updated.amount_USD) {
          updated.amount = (parseFloat(updated.amount_USD) || 0) * rate;
        } else if (updated.currency_used === 'NIO' && updated.amount) {
          updated.amount_USD = (parseFloat(updated.amount) || 0) / rate;
        }
      }
      
      if (field === 'amount_USD' && updated.currency_used === 'USD') {
        const rate = parseFloat(updated.exchange_rate_bill) || exchangeRate;
        updated.amount = (parseFloat(value) || 0) * rate;
      }
      
      if (field === 'amount' && updated.currency_used === 'NIO') {
        const rate = parseFloat(updated.exchange_rate_bill) || exchangeRate;
        updated.amount_USD = (parseFloat(value) || 0) / rate;
      }
      
      if (field === 'currency_used') {
        const rate = parseFloat(updated.exchange_rate_bill) || exchangeRate;
        if (value === 'USD' && updated.amount_USD) {
          updated.amount = (parseFloat(updated.amount_USD) || 0) * rate;
        } else if (value === 'NIO' && updated.amount) {
          updated.amount_USD = (parseFloat(updated.amount) || 0) / rate;
        }
      }
      
      return updated;
    });
  };

  // Filtrar gastos
  const filteredBills = useMemo(() => {
    let filtered = [...bills];

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(bill => bill.category === categoryFilter);
    }

    if (typeFilter !== 'all') {
      const isFixed = typeFilter === 'FIJO';
      filtered = filtered.filter(bill => bill.is_recurrent === isFixed);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bill => 
        bill.description.toLowerCase().includes(term) ||
        bill.category.toLowerCase().includes(term) ||
        formatCurrency(bill.amount).toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => new Date(b.bill_date) - new Date(a.bill_date));
  }, [bills, categoryFilter, typeFilter, searchTerm]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = bills.length;
    const fixedBills = bills.filter(bill => bill.is_recurrent);
    const variableBills = bills.filter(bill => !bill.is_recurrent);
    
    const totalAmount = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    const totalAmountUSD = bills.reduce((sum, bill) => sum + (bill.amount_usd || 0), 0);
    const fixedAmount = fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    const fixedAmountUSD = fixedBills.reduce((sum, bill) => sum + (bill.amount_usd || 0), 0);
    const variableAmount = variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    const variableAmountUSD = variableBills.reduce((sum, bill) => sum + (bill.amount_usd || 0), 0);
    
    const categoryStats = {};
    bills.forEach(bill => {
      if (!categoryStats[bill.category]) {
        categoryStats[bill.category] = { count: 0, amount: 0, amount_USD: 0 };
      }
      categoryStats[bill.category].count++;
      categoryStats[bill.category].amount += bill.amount || 0;
      categoryStats[bill.category].amount_USD += bill.amount_usd || 0;
    });

    return {
      total,
      fixed: fixedBills.length,
      variable: variableBills.length,
      totalAmount,
      totalAmountUSD,
      fixedAmount,
      fixedAmountUSD,
      variableAmount,
      variableAmountUSD,
      categoryStats
    };
  }, [bills]);

  // Obtener estadísticas por rango de fechas
  const getDateRangeStats = async () => {
    try {
      const data = await apiFetch(`/bills/stats/expenses?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      return data.data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  };

  // Funciones para expandir/contraer
  const toggleExpandBill = (billId) => {
    setExpandedBills(prev => ({
      ...prev,
      [billId]: !prev[billId]
    }));
  };

  // Crear nuevo gasto - MODIFICADO: alert -> addNotification
  const handleCreateBill = async (e) => {
    e.preventDefault();
    
    try {
      const billData = {
        description: newBill.description,
        amount: parseFloat(newBill.amount) || 0,
        amount_USD: parseFloat(newBill.amount_USD) || 0,
        bill_date: newBill.bill_date,
        category: newBill.category,
        currency_used: newBill.currency_used,
        exchange_rate_bill: parseFloat(newBill.exchange_rate_bill) || systemSettings.exchange_rate || 36.5,
        is_recurrent: newBill.is_recurrent
      };

      await createBill(billData);
      
      setNewBill({
        description: '',
        amount: '',
        amount_USD: '',
        bill_date: new Date().toISOString().split('T')[0],
        category: 'Materiales Odontológicos',
        currency_used: 'NIO',
        exchange_rate_bill: systemSettings.exchange_rate || 36.5,
        is_recurrent: false
      });
      
      setShowAddModal(false);
      
      // 🔴 CAMBIO: alert -> addNotification
      addNotification('✅ Gasto registrado exitosamente', 'success', 5000);
      
    } catch (error) {
      console.error('Error al crear gasto:', error);
      // 🔴 CAMBIO: alert -> addNotification
      addNotification(`❌ Error: ${error.message}`, 'error', 5000);
    }
  };

  // Preparar edición
  const handleEditBill = (bill) => {
    setSelectedBill(bill);
    setEditBill({
      description: bill.description,
      amount: bill.amount || '',
      amount_USD: bill.amount_usd || '',
      bill_date: bill.bill_date.split('T')[0],
      category: bill.category,
      currency_used: bill.currency_used || 'NIO',
      exchange_rate_bill: bill.exchange_rate_bill || systemSettings.exchange_rate || 36.5,
      is_recurrent: bill.is_recurrent
    });
    setShowEditModal(true);
  };

  // Actualizar gasto - MODIFICADO: alert -> addNotification
  const handleUpdateBill = async (e) => {
    e.preventDefault();
    
    try {
      const billData = {
        description: editBill.description,
        amount: parseFloat(editBill.amount) || 0,
        amount_USD: parseFloat(editBill.amount_USD) || 0,
        bill_date: editBill.bill_date,
        category: editBill.category,
        currency_used: editBill.currency_used,
        exchange_rate_bill: parseFloat(editBill.exchange_rate_bill) || systemSettings.exchange_rate || 36.5,
        is_recurrent: editBill.is_recurrent
      };

      await updateBill(selectedBill.bill_ID, billData);
      
      setShowEditModal(false);
      setSelectedBill(null);
      
      // 🔴 CAMBIO: alert -> addNotification
      addNotification('✅ Gasto actualizado exitosamente', 'success', 5000);
      
    } catch (error) {
      console.error('Error al actualizar gasto:', error);
      // 🔴 CAMBIO: alert -> addNotification
      addNotification(`❌ Error: ${error.message}`, 'error', 5000);
    }
  };

  // Eliminar gasto - MODIFICADO: alert dentro de confirm -> addNotification
  const handleDeleteBill = async (billId) => {
    if (window.confirm('¿Está seguro de que desea eliminar este gasto?\nEsta acción no se puede deshacer.')) {
      try {
        await deleteBill(billId);
        // 🔴 CAMBIO: alert -> addNotification
        addNotification('✅ Gasto eliminado exitosamente', 'success', 5000);
      } catch (error) {
        console.error('Error al eliminar gasto:', error);
        // 🔴 CAMBIO: alert -> addNotification
        addNotification(`❌ Error: ${error.message}`, 'error', 5000);
      }
    }
  };

  // Función para clasificación rápida
  const quickClassify = (bill, type) => {
    handleEditBill(bill);
    setEditBill(prev => ({
      ...prev,
      is_recurrent: type === 'FIJO'
    }));
  };

  // Obtener color según tipo
  const getTypeColor = (isFixed) => {
    return isFixed ? '#4DB6AC' : '#FFA726';
  };

  // Obtener icono según tipo
  const getTypeIcon = (isFixed) => {
    return isFixed ? faRepeat : faExchangeAlt;
  };

  // Obtener etiqueta según tipo
  const getTypeLabel = (isFixed) => {
    return isFixed ? 'Fijo' : 'Variable';
  };

  if (loading && bills.length === 0) {
    return (
      <div className="bills-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando gastos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bills-container">
      {/* Header */}
      <div className="bills-header">
        <div className="header-left">
          <h2>
            <FontAwesomeIcon icon={faMoneyBillWave} className="header-icon" />
            Control de Gastos
          </h2>
          <p className="subtitle">Gestión de gastos fijos y variables de la clínica</p>
          <div className="exchange-rate-info">
            <small>
              <FontAwesomeIcon icon={faExchangeAlt} /> Tipo de cambio actual: 
              <strong> C$ {systemSettings.exchange_rate || 36.5} por US$ 1</strong>
            </small>
          </div>
        </div>
        <div className="header-right">
          <button 
            className="primary-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Nuevo Gasto
          </button>
          <button 
            className="secondary-btn"
            onClick={() => setShowStatsModal(true)}
          >
            <FontAwesomeIcon icon={faChartBar} />
            Estadísticas
          </button>
          <button 
            className="filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FontAwesomeIcon icon={faFilter} />
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="filter-section">
          <div className="filter-header">
            <h3>
              <FontAwesomeIcon icon={faFilter} />
              Filtrar gastos
            </h3>
            <button 
              className="close-filter-btn"
              onClick={() => setShowFilters(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="filter-controls">
            <div className="filter-row">
              {/* Filtro por tipo */}
              <div className="filter-group">
                <label className="filter-label">
                  <FontAwesomeIcon icon={faExchangeAlt} /> Tipo:
                </label>
                <div className="type-filter-buttons">
                  <button 
                    className={`type-filter-btn ${typeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('all')}
                  >
                    Todos
                  </button>
                  <button 
                    className={`type-filter-btn ${typeFilter === 'FIJO' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('FIJO')}
                    style={{ backgroundColor: '#4DB6AC20', color: '#4DB6AC' }}
                  >
                    <FontAwesomeIcon icon={faRepeat} />
                    Fijos
                  </button>
                  <button 
                    className={`type-filter-btn ${typeFilter === 'VARIABLE' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('VARIABLE')}
                    style={{ backgroundColor: '#FFA72620', color: '#FFA726' }}
                  >
                    <FontAwesomeIcon icon={faExchangeAlt} />
                    Variables
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="quick-stats">  
        <div className="stat-card fixed">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faRepeat} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.fixed}</div>
            <div className="stat-label">Gastos Fijos</div>
            <div className="stat-amount">{formatCurrency(stats.fixedAmount)}</div>
            {stats.fixedAmountUSD > 0 && (
              <div className="stat-amount-usd">
                {formatCurrencyUSD(stats.fixedAmountUSD)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista de gastos */}
      {filteredBills.length === 0 ? (
        <div className="no-bills">
          <div className="no-bills-icon">
            <FontAwesomeIcon icon={faReceipt} />
          </div>
          <h3>No hay gastos registrados</h3>
          <p>
            {searchTerm || categoryFilter !== 'all' || typeFilter !== 'all'
              ? 'No se encontraron gastos con los filtros seleccionados'
              : 'Comience registrando sus primeros gastos para llevar el control'}
          </p>
          <button 
            className="primary-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Registrar primer gasto
          </button>
        </div>
      ) : (
        <div className="bills-list">
          {filteredBills.map(bill => (
            <div 
              key={bill.bill_ID} 
              className="bill-card"
              style={{ borderLeftColor: getTypeColor(bill.is_recurrent) }}
            >
              <div className="bill-main-info">
                <div className="bill-left">
                  <div className="bill-description">
                    <h4>{bill.description}</h4>
                    <div className="bill-category">
                      <FontAwesomeIcon icon={faTags} />
                      <span>{bill.category}</span>
                    </div>
                  </div>
                  
                  <div className="bill-meta">
                    <div className="bill-date">
                      <FontAwesomeIcon icon={faCalendarAlt} />
                      <span>{formatDate(bill.bill_date)}</span>
                    </div>
                    <div 
                      className={`bill-type ${bill.is_recurrent ? 'fixed' : 'variable'}`}
                      style={{ 
                        backgroundColor: getTypeColor(bill.is_recurrent) + '20',
                        color: getTypeColor(bill.is_recurrent)
                      }}
                    >
                      <FontAwesomeIcon icon={getTypeIcon(bill.is_recurrent)} />
                      <span>{getTypeLabel(bill.is_recurrent)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bill-right">
                  <div className="bill-amount">
                    <span className="amount-value">{formatCurrency(bill.amount)}</span>
                    {bill.amount_usd > 0 && (
                      <span className="amount-usd"> / {formatCurrencyUSD(bill.amount_usd)}</span>
                    )}
                    {bill.currency_used === 'USD' && (
                      <span className="currency-indicator">
                        <FontAwesomeIcon icon={faDollarSign} />
                        {bill.exchange_rate_bill ? ` (T/C: ${bill.exchange_rate_bill})` : ''}
                      </span>
                    )}
                    <span className="amount-label">Monto</span>
                  </div>
                  
                  <div className="bill-actions">
                    <button 
                      className="action-btn edit"
                      onClick={() => handleEditBill(bill)}
                      title="Editar gasto"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => handleDeleteBill(bill.bill_ID)}
                      title="Eliminar gasto"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                    {!bill.is_recurrent && (
                      <button 
                        className="action-btn classify"
                        onClick={() => quickClassify(bill, 'FIJO')}
                        title="Marcar como gasto fijo"
                      >
                        <FontAwesomeIcon icon={faRepeat} />
                        <span>Fijo</span>
                      </button>
                    )}
                    {bill.is_recurrent && (
                      <button 
                        className="action-btn classify variable"
                        onClick={() => quickClassify(bill, 'VARIABLE')}
                        title="Marcar como gasto variable"
                      >
                        <FontAwesomeIcon icon={faExchangeAlt} />
                        <span>Variable</span>
                      </button>
                    )}
                    <FontAwesomeIcon 
                      icon={expandedBills[bill.bill_ID] ? faChevronUp : faChevronDown} 
                      className="expand-icon"
                      onClick={() => toggleExpandBill(bill.bill_ID)}
                    />
                  </div>
                </div>
              </div>

              {/* Detalles expandidos */}
              {expandedBills[bill.bill_ID] && (
                <div className="bill-details">
                  <div className="detail-section">
                    <h5>Información detallada</h5>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">ID:</span>
                        <span className="detail-value">{bill.bill_ID}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Fecha de registro:</span>
                        <span className="detail-value">{formatDate(bill.bill_date)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Tipo:</span>
                        <span 
                          className="detail-value type-badge"
                          style={{ 
                            backgroundColor: getTypeColor(bill.is_recurrent) + '20',
                            color: getTypeColor(bill.is_recurrent)
                          }}
                        >
                          <FontAwesomeIcon icon={getTypeIcon(bill.is_recurrent)} />
                          {getTypeLabel(bill.is_recurrent)}
                          {bill.is_recurrent && (
                            <span className="recurrent-note"> (Se repite cada mes)</span>
                          )}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Moneda:</span>
                        <span className="detail-value">
                          {bill.currency_used === 'USD' ? (
                            <>
                              <FontAwesomeIcon icon={faDollarSign} />
                              <span> Dólares (US$)</span>
                              {bill.exchange_rate_bill && (
                                <span className="exchange-rate"> - T/C: {bill.exchange_rate_bill}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faMoneyBillWave} />
                              <span> Córdobas (C$)</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal para agregar gasto */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faPlus} />
                Registrar Nuevo Gasto
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowAddModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleCreateBill} className="bill-form">
              <div className="form-group">
                <label className="form-label">Descripción:</label>
                <input
                  type="text"
                  required
                  value={newBill.description}
                  onChange={(e) => setNewBill({...newBill, description: e.target.value})}
                  className="form-input"
                  placeholder="Ej: Compra de materiales dentales, pago de alquiler, etc."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Moneda:</label>
                  <select
                    value={newBill.currency_used}
                    onChange={(e) => handleCurrencyChange('currency_used', e.target.value, true)}
                    className="form-select"
                  >
                    <option value="NIO">Córdobas (C$)</option>
                    <option value="USD">Dólares (US$)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    {newBill.currency_used === 'NIO' ? 'Monto (C$):' : 'Monto (US$):'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newBill.currency_used === 'NIO' ? newBill.amount : newBill.amount_USD}
                    onChange={(e) => handleCurrencyChange(
                      newBill.currency_used === 'NIO' ? 'amount' : 'amount_USD', 
                      e.target.value, 
                      true
                    )}
                    className="form-input"
                    placeholder="0.00"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Tipo de Cambio (C$/US$):</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={newBill.exchange_rate_bill}
                    onChange={(e) => handleCurrencyChange('exchange_rate_bill', e.target.value, true)}
                    className="form-input"
                    placeholder={systemSettings.exchange_rate?.toString() || "36.5000"}
                  />
                  <small className="form-help-text">
                    Tipo de cambio actual: C$ {systemSettings.exchange_rate || 36.5} por US$ 1
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha:</label>
                  <input
                    type="date"
                    required
                    value={newBill.bill_date}
                    onChange={(e) => setNewBill({...newBill, bill_date: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría:</label>
                  <select
                    required
                    value={newBill.category}
                    onChange={(e) => setNewBill({...newBill, category: e.target.value})}
                    className="form-select"
                  >
                    {BILL_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mostrar conversión */}
              <div className="conversion-info">
                <small>
                  {newBill.currency_used === 'NIO' && newBill.amount ? (
                    <>
                      <FontAwesomeIcon icon={faExchangeAlt} />
                      Equivalente en US$: {formatCurrencyUSD(parseFloat(newBill.amount) / parseFloat(newBill.exchange_rate_bill || systemSettings.exchange_rate || 36.5))}
                    </>
                  ) : newBill.currency_used === 'USD' && newBill.amount_USD ? (
                    <>
                      <FontAwesomeIcon icon={faExchangeAlt} />
                      Equivalente en C$: {formatCurrency(parseFloat(newBill.amount_USD) * parseFloat(newBill.exchange_rate_bill || systemSettings.exchange_rate || 36.5))}
                    </>
                  ) : null}
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <div className="switch-container">
                    <span>Tipo de gasto:</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={newBill.is_recurrent}
                        onChange={(e) => setNewBill({
                          ...newBill,
                          is_recurrent: e.target.checked
                        })}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      {newBill.is_recurrent ? 'Gasto Fijo (recurrente)' : 'Gasto Variable (único)'}
                    </span>
                  </div>
                </label>
                {newBill.is_recurrent && (
                  <div className="form-help">
                    <FontAwesomeIcon icon={faCircleExclamation} />
                    <span>Los gastos fijos se considerarán automáticamente en cada cierre mensual</span>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="secondary-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  <FontAwesomeIcon icon={faBan} />
                  Cancelar
                </button>
                <button type="submit" className="primary-btn">
                  <FontAwesomeIcon icon={faSave} />
                  Registrar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar gasto */}
      {showEditModal && selectedBill && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faEdit} />
                Editar Gasto
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedBill(null);
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateBill} className="bill-form">
              <div className="form-group">
                <label className="form-label">Descripción:</label>
                <input
                  type="text"
                  required
                  value={editBill.description}
                  onChange={(e) => setEditBill({...editBill, description: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Moneda:</label>
                  <select
                    value={editBill.currency_used}
                    onChange={(e) => handleCurrencyChange('currency_used', e.target.value, false)}
                    className="form-select"
                  >
                    <option value="NIO">Córdobas (C$)</option>
                    <option value="USD">Dólares (US$)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    {editBill.currency_used === 'NIO' ? 'Monto (C$):' : 'Monto (US$):'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={editBill.currency_used === 'NIO' ? editBill.amount : editBill.amount_USD}
                    onChange={(e) => handleCurrencyChange(
                      editBill.currency_used === 'NIO' ? 'amount' : 'amount_USD', 
                      e.target.value, 
                      false
                    )}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Tipo de Cambio (C$/US$):</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={editBill.exchange_rate_bill}
                    onChange={(e) => handleCurrencyChange('exchange_rate_bill', e.target.value, false)}
                    className="form-input"
                  />
                  <small className="form-help-text">
                    Tipo de cambio actual: C$ {systemSettings.exchange_rate || 36.5} por US$ 1
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha:</label>
                  <input
                    type="date"
                    required
                    value={editBill.bill_date}
                    onChange={(e) => setEditBill({...editBill, bill_date: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría:</label>
                  <select
                    required
                    value={editBill.category}
                    onChange={(e) => setEditBill({...editBill, category: e.target.value})}
                    className="form-select"
                  >
                    {BILL_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mostrar conversión */}
              <div className="conversion-info">
                <small>
                  {editBill.currency_used === 'NIO' && editBill.amount ? (
                    <>
                      <FontAwesomeIcon icon={faExchangeAlt} />
                      Equivalente en US$: {formatCurrencyUSD(parseFloat(editBill.amount) / parseFloat(editBill.exchange_rate_bill || systemSettings.exchange_rate || 36.5))}
                    </>
                  ) : editBill.currency_used === 'USD' && editBill.amount_USD ? (
                    <>
                      <FontAwesomeIcon icon={faExchangeAlt} />
                      Equivalente en C$: {formatCurrency(parseFloat(editBill.amount_USD) * parseFloat(editBill.exchange_rate_bill || systemSettings.exchange_rate || 36.5))}
                    </>
                  ) : null}
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <div className="switch-container">
                    <span>Tipo de gasto:</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={editBill.is_recurrent}
                        onChange={(e) => setEditBill({
                          ...editBill,
                          is_recurrent: e.target.checked
                        })}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      {editBill.is_recurrent ? 'Gasto Fijo (recurrente)' : 'Gasto Variable (único)'}
                    </span>
                  </div>
                </label>
                {editBill.is_recurrent && (
                  <div className="form-help">
                    <FontAwesomeIcon icon={faCircleExclamation} />
                    <span>Los gastos fijos se considerarán automáticamente en cada cierre mensual</span>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="secondary-btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBill(null);
                  }}
                >
                  <FontAwesomeIcon icon={faBan} />
                  Cancelar
                </button>
                <button type="submit" className="primary-btn">
                  <FontAwesomeIcon icon={faSave} />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faChartBar} />
                Estadísticas de Gastos
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowStatsModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="stats-content">
              {/* Resumen general CON DÓLARES */}
              <div className="stats-section">
                <h4>Resumen General</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-title">Total Gastos</div>
                    <div className="stat-value">{stats.total}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-title">Gastos Fijos</div>
                    <div className="stat-value">{stats.fixed}</div>
                    <div className="stat-amount">{formatCurrency(stats.fixedAmount)}</div>
                    {stats.fixedAmountUSD > 0 && (
                      <div className="stat-amount-usd">{formatCurrencyUSD(stats.fixedAmountUSD)}</div>
                    )}
                  </div>
                  <div className="stat-item">
                    <div className="stat-title">Gastos Variables</div>
                    <div className="stat-value">{stats.variable}</div>
                    <div className="stat-amount">{formatCurrency(stats.variableAmount)}</div>
                    {stats.variableAmountUSD > 0 && (
                      <div className="stat-amount-usd">{formatCurrencyUSD(stats.variableAmountUSD)}</div>
                    )}
                  </div>
                  <div className="stat-item">
                    <div className="stat-title">Total Monto</div>
                    <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
                    {stats.totalAmountUSD > 0 && (
                      <div className="stat-amount-usd">{formatCurrencyUSD(stats.totalAmountUSD)}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Por categoría CON DÓLARES */}
              <div className="stats-section">
                <h4>Gastos por Categoría</h4>
                <div className="category-stats">
                  {Object.entries(stats.categoryStats)
                    .sort(([, a], [, b]) => b.amount - a.amount)
                    .map(([category, data]) => (
                      <div key={category} className="category-item">
                        <div className="category-info">
                          <span className="category-name">{category}</span>
                          <span className="category-count">{data.count} gastos</span>
                        </div>
                        <div className="category-amount">
                          <div>{formatCurrency(data.amount)}</div>
                          {data.amount_USD > 0 && (
                            <div className="category-amount-usd">
                              {formatCurrencyUSD(data.amount_USD)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Rango de fechas - MODIFICADO: alert -> addNotification */}
              <div className="stats-section">
                <h4>Estadísticas por Período</h4>
                <div className="date-range-selector">
                  <div className="date-input">
                    <label>Fecha inicio:</label>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                    />
                  </div>
                  <div className="date-input">
                    <label>Fecha fin:</label>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                    />
                  </div>
                  <button 
                    className="primary-btn small"
                    onClick={async () => {
                      const periodStats = await getDateRangeStats();
                      if (periodStats) {
                        // 🔴 CAMBIO: alert -> addNotification
                        addNotification(
                          `📊 Estadísticas del período:\n` +
                          `Gastos totales: ${formatCurrency(periodStats.total_expenses)}\n` +
                          `Gastos totales en USD: ${formatCurrencyUSD(periodStats.total_expenses_usd || 0)}\n` +
                          `Gastos fijos: ${formatCurrency(periodStats.fixed_expenses)}\n` +
                          `Gastos fijos en USD: ${formatCurrencyUSD(periodStats.fixed_expenses_usd || 0)}\n` +
                          `Gastos variables: ${formatCurrency(periodStats.variable_expenses)}\n` +
                          `Gastos variables en USD: ${formatCurrencyUSD(periodStats.variable_expenses_usd || 0)}\n` +
                          `Número de gastos: ${periodStats.total_bills}`,
                          'info',
                          10000
                        );
                      }
                    }}
                  >
                    Calcular
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsPage;