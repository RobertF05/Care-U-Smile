// LiveResultsPage.jsx (sección corregida - líneas 170-250)
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHospital,
  faTooth,
  faMoneyBillWave,
  faReceipt,
  faChartLine,
  faDollarSign,
  faClock,
  faCalendarDay,
  faCalendarAlt,
  faInfoCircle,
  faSyncAlt,
  faExclamationTriangle,
  faPlus,
  faMinusCircle,
  faChevronDown,
  faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import { AppContext } from '../../context/AppContext';
import { AuthContext } from '../../context/AuthContext';
import './LiveResultsPage.css';

// Componente auxiliar para mostrar montos en ambas monedas
const DualCurrency = ({ amountNIO }) => {
  const { systemSettings } = useContext(AppContext);
  const exchangeRate = systemSettings?.exchange_rate || 36.5;
  const amountUSD = amountNIO / exchangeRate;

  const formatNIO = (amt) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt || 0);
  };

  const formatUSD = (amt) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt || 0);
  };

  return (
    <div className="dual-currency">
      <span className="amount-cordobas">{formatNIO(amountNIO)}</span>
      <span className="amount-dollars">{formatUSD(amountUSD)}</span>
    </div>
  );
};

// Componente para mostrar un gasto resumido
const ExpenseItem = ({ expense }) => {
  const { systemSettings } = useContext(AppContext);
  const exchangeRate = systemSettings?.exchange_rate || 36.5;
  
  // Calcular monto en córdobas correctamente
  let amountNIO = 0;
  if (expense.currency_used === 'USD') {
    const usdAmount = parseFloat(expense.amount_usd) || 0;
    const rate = parseFloat(expense.exchange_rate_bill) || exchangeRate;
    amountNIO = usdAmount * rate;
  } else {
    amountNIO = parseFloat(expense.amount) || 0;
  }

  return (
    <div className="expense-item">
      <div className="expense-info">
        <div className="expense-description" title={expense.description}>
          {expense.description}
        </div>
        <div className="expense-category">
          <span className="category-badge">{expense.category || 'General'}</span>
        </div>
      </div>
      <div className="expense-amount">
        <DualCurrency amountNIO={amountNIO} />
      </div>
    </div>
  );
};

const LiveResultsPage = () => {
  const { user } = useContext(AuthContext);
  const { 
    systemSettings, 
    getDailySummary, 
    getFinancialSummary, 
    apiFetch,
    loading: contextLoading 
  } = useContext(AppContext);

  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Estados para datos diarios
  const [dailyData, setDailyData] = useState({
    date: '',
    total_income: 0,
    total_expenses: 0,
    net_profit: 0,
    expenses: [],
    hasData: false
  });

  // Estados para datos mensuales
  const [monthlyData, setMonthlyData] = useState({
    startDate: '',
    endDate: '',
    total_income: 0,
    fixed_expenses: 0,
    variable_expenses: 0,
    total_expenses: 0,
    net_profit: 0,
    hasData: false
  });

  // Estados para controlar qué secciones están expandidas
  const [expandedSections, setExpandedSections] = useState({
    daily: false,
    monthly: false,
    expenses: false
  });

  // ============================================
  // FUNCIONES AUXILIARES DE FECHA
  // ============================================
  
  // Función para obtener la fecha actual en Nicaragua (YYYY-MM-DD)
  const getCurrentNicaraguaDate = () => {
    const now = new Date();
    const nicaraguaOffset = -6 * 60;
    const localOffset = now.getTimezoneOffset();
    const totalOffset = nicaraguaOffset - localOffset;
    
    const nicaraguaTime = new Date(now.getTime() + (totalOffset * 60 * 1000));
    
    const year = nicaraguaTime.getFullYear();
    const month = String(nicaraguaTime.getMonth() + 1).padStart(2, '0');
    const day = String(nicaraguaTime.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Obtener fechas del mes actual en Nicaragua
  const getCurrentMonthDates = useCallback(() => {
    const now = new Date();
    
    const nicaraguaOffset = -6 * 60;
    const localOffset = now.getTimezoneOffset();
    const totalOffset = nicaraguaOffset - localOffset;
    const nicaraguaTime = new Date(now.getTime() + (totalOffset * 60 * 1000));
    
    const year = nicaraguaTime.getFullYear();
    const month = nicaraguaTime.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    return { 
      start: formatDate(firstDay), 
      end: formatDate(lastDay) 
    };
  }, []);

  // Función para calcular total de gastos en córdobas
  const calculateTotalExpenses = (expenses, exchangeRate) => {
    if (!expenses || expenses.length === 0) return 0;
    
    return expenses.reduce((sum, expense) => {
      if (expense.currency_used === 'USD') {
        const usdAmount = parseFloat(expense.amount_usd) || 0;
        const rate = parseFloat(expense.exchange_rate_bill) || exchangeRate;
        return sum + (usdAmount * rate);
      } else {
        return sum + (parseFloat(expense.amount) || 0);
      }
    }, 0);
  };

  // ============================================
  // FUNCIÓN PRINCIPAL PARA CARGAR DATOS (CORREGIDA)
  // ============================================
  const fetchLiveData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const todayStr = getCurrentNicaraguaDate();
      const monthDates = getCurrentMonthDates();
      const exchangeRate = systemSettings?.exchange_rate || 36.5;

      console.log('🔍 Cargando datos en vivo...', { 
        hoy: todayStr, 
        mes: monthDates 
      });

      // ============================================
      // 1. CARGAR GASTOS VARIABLES DEL DÍA (para detalles)
      // ============================================
      let dailyExpenses = [];
      let dailyExpensesTotal = 0;
      
      try {
        const dailyExpensesRes = await apiFetch(`/bills?startDate=${todayStr}&endDate=${todayStr}&type=VARIABLE&limit=100`);
        if (dailyExpensesRes.success) {
          dailyExpenses = dailyExpensesRes.data || [];
          dailyExpensesTotal = calculateTotalExpenses(dailyExpenses, exchangeRate);
        }
      } catch (expErr) {
        console.warn('No se pudieron cargar gastos diarios:', expErr);
      }

      // ============================================
      // 2. CARGAR DATOS DEL DÍA
      // ============================================
      console.log('📊 Cargando resumen diario general...');
      const dailyGeneralRes = await getDailySummary(todayStr, 'general');
      const dailyGeneral = dailyGeneralRes.success ? dailyGeneralRes.data : null;
      
      console.log('📊 Cargando resumen diario ortodoncia...');
      const dailyOrthoRes = await getDailySummary(todayStr, 'orthodontics');
      const dailyOrtho = dailyOrthoRes.success ? dailyOrthoRes.data : null;

      // 🔴 CORRECCIÓN: Usar el total_income que ya viene sumado del backend
      let dailyIncomeFromProcedures = 0;
      
      // El backend ya devuelve el total en total_income (general + ortodoncia)
      if (dailyGeneral && dailyGeneral.total_income) {
        dailyIncomeFromProcedures = dailyGeneral.total_income;
      } else if (dailyOrtho && dailyOrtho.total_income) {
        dailyIncomeFromProcedures = dailyOrtho.total_income;
      }

      // Calcular gastos totales (tomar de cualquiera que tenga datos)
      let totalDailyExpenses = 0;
      
      if (dailyGeneral && dailyGeneral.total_variable_expenses) {
        totalDailyExpenses = dailyGeneral.total_variable_expenses;
      } else if (dailyOrtho && dailyOrtho.total_variable_expenses) {
        totalDailyExpenses = dailyOrtho.total_variable_expenses;
      }

      console.log('💰💰💰 DESGLOSE DETALLADO (CORREGIDO):', {
        ingresos: {
          desde_backend: dailyIncomeFromProcedures,
          general_individual: dailyGeneral?.total_clinic_income || 0,
          ortho_individual: dailyOrtho?.total_clinic_income || 0
        },
        gastos: {
          desdeBills: dailyExpensesTotal,
          desde_backend: totalDailyExpenses
        },
        utilidad_neta: dailyIncomeFromProcedures - totalDailyExpenses
      });

      setDailyData({
        date: todayStr,
        total_income: dailyIncomeFromProcedures,
        total_expenses: totalDailyExpenses,
        net_profit: dailyIncomeFromProcedures - totalDailyExpenses,
        expenses: dailyExpenses,
        hasData: dailyIncomeFromProcedures > 0 || totalDailyExpenses > 0
      });

      // ============================================
      // 3. CARGAR DATOS MENSUALES
      // ============================================
      const monthlyRes = await getFinancialSummary(monthDates.start, monthDates.end, 'all');
      const monthly = monthlyRes.success ? monthlyRes.data : null;

      if (monthly) {
        const monthlyTotalIncome = (monthly.total_general_income || 0) + (monthly.total_clinical_orthodontic_income || 0);
        const monthlyFixedExpenses = monthly.total_fixed_expenses || 0;
        const monthlyVariableExpenses = monthly.total_variable_expenses || 0;
        const monthlyTotalExpenses = monthlyFixedExpenses + monthlyVariableExpenses;
        
        setMonthlyData({
          startDate: monthDates.start,
          endDate: monthDates.end,
          total_income: monthlyTotalIncome,
          fixed_expenses: monthlyFixedExpenses,
          variable_expenses: monthlyVariableExpenses,
          total_expenses: monthlyTotalExpenses,
          net_profit: monthlyTotalIncome - monthlyTotalExpenses,
          hasData: true
        });
      }

      setLastUpdated(new Date());

    } catch (err) {
      console.error('❌ Error cargando datos:', err);
      setError('Error al cargar los datos. Por favor, intente de nuevo.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [getDailySummary, getFinancialSummary, apiFetch, getCurrentMonthDates, systemSettings]);

  // Solo se ejecuta al montar el componente
  useEffect(() => {
    if (user) {
      fetchLiveData(true);
    }
  }, [user]);

  const handleManualRefresh = () => {
    fetchLiveData(true);
  };

  const toggleDailyDetails = () => {
    setExpandedSections(prev => ({
      ...prev,
      daily: !prev.daily
    }));
  };

  const toggleMonthlyDetails = () => {
    setExpandedSections(prev => ({
      ...prev,
      monthly: !prev.monthly
    }));
  };

  const toggleExpensesList = () => {
    setExpandedSections(prev => ({
      ...prev,
      expenses: !prev.expenses
    }));
  };

  if (loading && !dailyData.hasData && !monthlyData.hasData) {
    return (
      <div className="live-results-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando resultados financieros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-results-container">
      {/* Header */}
      <div className="live-header">
        <div className="header-left">
          <h2>
            <FontAwesomeIcon icon={faChartLine} className="header-icon" />
            Resultados Financieros en Vivo
          </h2>
          {lastUpdated && (
            <div className="live-indicator">
              <FontAwesomeIcon icon={faClock} />
              <span>Última actualización: {lastUpdated.toLocaleTimeString('es-NI')}</span>
            </div>
          )}
        </div>
        <div className="header-right">
          <button 
            className="refresh-btn" 
            onClick={handleManualRefresh} 
            disabled={loading}
          >
            <FontAwesomeIcon icon={faSyncAlt} spin={loading} />
            {loading ? 'Actualizando...' : 'Actualizar ahora'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{error}</span>
        </div>
      )}

      {/* ===== SECCIÓN DEL DÍA ===== */}
      <section className="results-section">
        <div className="section-header">
          <h3>
            <FontAwesomeIcon icon={faCalendarDay} />
            Resultados del Día ({dailyData.date ? new Date(dailyData.date + 'T12:00:00').toLocaleDateString('es-NI', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            }) : 'Cargando...'})
          </h3>
          {dailyData.expenses.length > 0 && (
            <div className="section-badge">
              {dailyData.expenses.length} gastos registrados
            </div>
          )}
        </div>

        {/* TARJETA PRINCIPAL: UTILIDAD NETA DEL DÍA */}
        <div 
          className={`main-profit-card ${dailyData.net_profit >= 0 ? 'profit' : 'loss'}`}
          onClick={toggleDailyDetails}
          style={{ cursor: 'pointer' }}
        >
          <div className="profit-card-header">
            <span className="profit-label">UTILIDAD NETA DEL DÍA</span>
            <FontAwesomeIcon 
              icon={expandedSections.daily ? faChevronUp : faChevronDown} 
              className="expand-icon"
            />
          </div>
          <div className="profit-value-large">
            <DualCurrency amountNIO={dailyData.net_profit} />
          </div>
          
          {/* Depurador visual temporal */}
          <div style={{
            background: '#f0f0f0',
            padding: '10px',
            borderRadius: '5px',
            marginTop: '10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            textAlign: 'left'
          }}>
            <div>📊 Ingresos: C${dailyData.total_income.toFixed(2)}</div>
            <div>📊 Gastos: C${dailyData.total_expenses.toFixed(2)}</div>
            <div>📊 Utilidad: C${dailyData.net_profit.toFixed(2)}</div>
          </div>
          
          {dailyData.total_income === 0 && dailyData.total_expenses > 0 && (
            <div className="profit-margin warning">
              Solo hay gastos registrados (sin ingresos)
            </div>
          )}
        </div>

        {/* DETALLES DEL DÍA */}
        {expandedSections.daily && (
          <div className="expanded-details">
            <div className="details-grid">
              <div className="detail-item-card income">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faDollarSign} />
                  Ingresos Totales
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={dailyData.total_income} />
                </div>
                <div className="detail-description">
                  Ganancia clínica (General + Ortodoncia)
                </div>
              </div>

              <div className="detail-item-card expense">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faReceipt} />
                  Gastos Variables
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={dailyData.total_expenses} />
                </div>
                <div className="detail-description">
                  Gastos del día (tabla bills)
                </div>
              </div>
            </div>

            {/* Lista de gastos */}
            {dailyData.expenses && dailyData.expenses.length > 0 && (
              <div className="expenses-section">
                <button 
                  className="expenses-toggle"
                  onClick={toggleExpensesList}
                >
                  <span>
                    <FontAwesomeIcon icon={faReceipt} />
                    Ver detalle de gastos ({dailyData.expenses.length})
                  </span>
                  <FontAwesomeIcon 
                    icon={expandedSections.expenses ? faChevronUp : faChevronDown} 
                  />
                </button>
                
                {expandedSections.expenses && (
                  <div className="expenses-list">
                    {dailyData.expenses.map(exp => (
                      <ExpenseItem key={exp.bill_ID} expense={exp} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== SECCIÓN DEL MES ===== */}
      <section className="results-section">
        <div className="section-header">
          <h3>
            <FontAwesomeIcon icon={faCalendarAlt} />
            Resultados del Mes 
          </h3>
        </div>

        <div 
          className={`main-profit-card ${monthlyData.net_profit >= 0 ? 'profit' : 'loss'}`}
          onClick={toggleMonthlyDetails}
          style={{ cursor: 'pointer' }}
        >
          <div className="profit-card-header">
            <span className="profit-label">UTILIDAD NETA DEL MES</span>
            <FontAwesomeIcon 
              icon={expandedSections.monthly ? faChevronUp : faChevronDown} 
              className="expand-icon"
            />
          </div>
          <div className="profit-value-large">
            <DualCurrency amountNIO={monthlyData.net_profit} />
          </div>
        </div>

        {expandedSections.monthly && (
          <div className="expanded-details">
            <div className="details-grid">
              <div className="detail-item-card income">
                <div className="detail-label">Ingresos Totales</div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.total_income} />
                </div>
              </div>
              <div className="detail-item-card expense">
                <div className="detail-label">Gastos Fijos</div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.fixed_expenses} />
                </div>
              </div>
              <div className="detail-item-card expense">
                <div className="detail-label">Gastos Variables</div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.variable_expenses} />
                </div>
              </div>
              <div className="detail-item-card total-expense">
                <div className="detail-label">Total Gastos</div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.total_expenses} />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Nota informativa */}
      <div className="info-note">
        <FontAwesomeIcon icon={faInfoCircle} />
        <div className="info-content">
          <p>
            <strong>📊 Resumen:</strong> Los ingresos son la suma de procedimientos generales y ortodoncia. 
            Los gastos son los registrados en la tabla bills. La utilidad neta es la diferencia.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveResultsPage;