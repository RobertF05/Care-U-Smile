// LiveResultsPage.jsx
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
    date: new Date().toISOString().split('T')[0],
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
    expenses: [],
    hasData: false
  });

  // 🔴 Estados para controlar qué secciones están expandidas
  const [expandedSections, setExpandedSections] = useState({
    daily: false,    // Detalles del día (ingresos y gastos)
    monthly: false,  // Detalles del mes (ingresos y gastos)
    expenses: false  // Lista de gastos
  });

  // Obtener fechas CORRECTAS del mes actual
  const getCurrentMonthDates = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayStr = firstDay.toISOString().split('T')[0];
    const lastDayStr = lastDay.toISOString().split('T')[0];
    
    console.log('📅 Fechas del mes calculadas:', { 
      mes: month + 1,
      año: year,
      inicio: firstDayStr, 
      fin: lastDayStr 
    });
    
    return { start: firstDayStr, end: lastDayStr };
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

  // Función para cargar datos (solo manualmente o al entrar)
  const fetchLiveData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const monthDates = getCurrentMonthDates();
      const exchangeRate = systemSettings?.exchange_rate || 36.5;

      console.log('🔍 Cargando datos en vivo...', { hoy: todayStr, mes: monthDates });

      // ============================================
      // 1. CARGAR GASTOS VARIABLES DEL DÍA
      // ============================================
      let dailyExpenses = [];
      let dailyExpensesTotal = 0;
      
      try {
        console.log('📥 Cargando gastos variables del día...');
        const dailyExpensesRes = await apiFetch(`/bills?startDate=${todayStr}&endDate=${todayStr}&type=VARIABLE&limit=100`);
        if (dailyExpensesRes.success) {
          dailyExpenses = dailyExpensesRes.data || [];
          dailyExpensesTotal = calculateTotalExpenses(dailyExpenses, exchangeRate);
          console.log(`💰 Gastos variables del día: ${dailyExpenses.length} items, Total: C$${dailyExpensesTotal}`);
        }
      } catch (expErr) {
        console.warn('No se pudieron cargar gastos diarios:', expErr);
      }

      // ============================================
      // 2. CARGAR DATOS DE PROCEDIMIENTOS DEL DÍA
      // ============================================
      console.log('📊 Cargando resumen diario general...');
      const dailyGeneralRes = await getDailySummary(todayStr, 'general');
      const dailyGeneral = dailyGeneralRes.success ? dailyGeneralRes.data : null;
      
      console.log('📊 Cargando resumen diario ortodoncia...');
      const dailyOrthoRes = await getDailySummary(todayStr, 'orthodontics');
      const dailyOrtho = dailyOrthoRes.success ? dailyOrthoRes.data : null;

      // Ingresos de procedimientos
      const dailyIncomeFromProcedures = (dailyGeneral?.total_clinic_income || 0) + (dailyOrtho?.total_clinic_income || 0);
      
      // Gastos de procedimientos (si los reporta getDailySummary)
      const dailyExpensesFromProcedures = (dailyGeneral?.total_variable_expenses || 0) + (dailyOrtho?.total_variable_expenses || 0);
      
      // TOTAL GASTOS DEL DÍA = Gastos de procedimientos + Gastos de tabla bills
      const totalDailyExpenses = dailyExpensesFromProcedures + dailyExpensesTotal;
      
      console.log('💰 Desglose gastos del día:', {
        desdeProcedimientos: dailyExpensesFromProcedures,
        desdeBills: dailyExpensesTotal,
        total: totalDailyExpenses
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
      console.log('📊 Cargando resumen mensual completo...');
      const monthlyRes = await getFinancialSummary(monthDates.start, monthDates.end, 'all');
      const monthly = monthlyRes.success ? monthlyRes.data : null;

      if (monthly) {
        const monthlyTotalIncome = (monthly.total_general_income || 0) + (monthly.total_clinical_orthodontic_income || 0);
        const monthlyFixedExpenses = monthly.total_fixed_expenses || 0;
        const monthlyVariableExpenses = monthly.total_variable_expenses || 0;
        
        setMonthlyData({
          startDate: monthDates.start,
          endDate: monthDates.end,
          total_income: monthlyTotalIncome,
          fixed_expenses: monthlyFixedExpenses,
          variable_expenses: monthlyVariableExpenses,
          total_expenses: monthlyFixedExpenses + monthlyVariableExpenses,
          net_profit: monthlyTotalIncome - (monthlyFixedExpenses + monthlyVariableExpenses),
          expenses: [],
          hasData: true
        });
      } else {
        // Si no hay datos combinados, intentar por separado
        const monthlyGeneralRes = await getFinancialSummary(monthDates.start, monthDates.end, 'general');
        const monthlyGeneral = monthlyGeneralRes.success ? monthlyGeneralRes.data : null;
        
        const monthlyOrthoRes = await getFinancialSummary(monthDates.start, monthDates.end, 'orthodontics');
        const monthlyOrtho = monthlyOrthoRes.success ? monthlyOrthoRes.data : null;
        
        const monthlyTotalIncome = (monthlyGeneral?.clinic_income || 0) + (monthlyOrtho?.clinic_income || 0);
        const monthlyFixedExpenses = monthlyGeneral?.total_fixed_expenses || monthlyOrtho?.total_fixed_expenses || 0;
        const monthlyVariableExpenses = monthlyGeneral?.total_variable_expenses || monthlyOrtho?.total_variable_expenses || 0;
        
        setMonthlyData({
          startDate: monthDates.start,
          endDate: monthDates.end,
          total_income: monthlyTotalIncome,
          fixed_expenses: monthlyFixedExpenses,
          variable_expenses: monthlyVariableExpenses,
          total_expenses: monthlyFixedExpenses + monthlyVariableExpenses,
          net_profit: monthlyTotalIncome - (monthlyFixedExpenses + monthlyVariableExpenses),
          expenses: [],
          hasData: monthlyTotalIncome > 0
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

  // Función para manejar actualización manual
  const handleManualRefresh = () => {
    fetchLiveData(true);
  };

  // 🔴 Funciones para toggle de secciones
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

  // Función para determinar color de utilidad
  const getProfitColor = (profit) => {
    if (profit > 0) return '#4CAF50';
    if (profit < 0) return '#F44336';
    return '#FF9800';
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
            Resultados Financieros
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
            title="Actualizar datos manualmente"
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
            Resultados del Día ({new Date(dailyData.date).toLocaleDateString('es-NI')})
          </h3>
        </div>

        {/* 🔴 TARJETA PRINCIPAL: UTILIDAD NETA DEL DÍA */}
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
          {dailyData.total_income > 0 && (
            <div className="profit-margin">
              Margen: {((dailyData.net_profit / dailyData.total_income) * 100).toFixed(2)}%
            </div>
          )}
        </div>

        {/* 🔴 DETALLES DEL DÍA (expandibles) */}
        {expandedSections.daily && (
          <div className="expanded-details">
            <div className="details-grid">
              {/* Ingresos Totales */}
              <div className="detail-item-card income">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faDollarSign} />
                  Ingresos Totales
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={dailyData.total_income} />
                </div>
              </div>

              {/* Gastos Variables */}
              <div className="detail-item-card expense">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faReceipt} />
                  Gastos Variables
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={dailyData.total_expenses} />
                </div>
              </div>
            </div>

            {/* Lista de gastos (si existen) */}
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
            {monthlyData.startDate && monthlyData.endDate && (
              <span className="date-range">
                ({new Date(monthlyData.startDate).toLocaleDateString('es-NI', { day: 'numeric', month: 'long' })} - {new Date(monthlyData.endDate).toLocaleDateString('es-NI')})
              </span>
            )}
          </h3>
        </div>

        {/* 🔴 TARJETA PRINCIPAL: UTILIDAD NETA DEL MES */}
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
          {monthlyData.total_income > 0 && (
            <div className="profit-margin">
              Margen: {((monthlyData.net_profit / monthlyData.total_income) * 100).toFixed(2)}%
            </div>
          )}
        </div>

        {/* 🔴 DETALLES DEL MES (expandibles) */}
        {expandedSections.monthly && (
          <div className="expanded-details">
            <div className="details-grid">
              {/* Ingresos Totales */}
              <div className="detail-item-card income">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faDollarSign} />
                  Ingresos Totales
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.total_income} />
                </div>
              </div>

              {/* Gastos Fijos */}
              <div className="detail-item-card expense">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                  Gastos Fijos
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.fixed_expenses} />
                </div>
              </div>

              {/* Gastos Variables */}
              <div className="detail-item-card expense">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faReceipt} />
                  Gastos Variables
                </div>
                <div className="detail-value">
                  <DualCurrency amountNIO={monthlyData.variable_expenses} />
                </div>
              </div>

              {/* Total Gastos */}
              <div className="detail-item-card total-expense">
                <div className="detail-label">
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                  Total Gastos
                </div>
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
        <p>
          <strong>Utilidad Neta:</strong> Es lo principal que se muestra. Haz clic en cada tarjeta para ver el detalle de ingresos y gastos.<br />
          <strong>Actualización:</strong> Los datos se cargan al entrar a esta página y al presionar "Actualizar ahora".
          {systemSettings && (
            <> • Tipo de cambio: <strong>C${systemSettings.exchange_rate?.toFixed(2) || '36.50'} = $1 USD</strong></>
          )}
        </p>
      </div>
    </div>
  );
};

export default LiveResultsPage;