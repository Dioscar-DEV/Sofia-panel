(function(){
    // Referencias a elementos del DOM
    let elements = {};

    // Estado del modulo
    let state = {
        period: '7days',
        customDateFrom: null,
        customDateTo: null,
        data: null,
        lastUpdate: null,
        currentTab: 'resumen',
        charts: {}
    };

    // Colores para graficas
    const CHART_COLORS = [
        '#3b82f6', '#22c55e', '#f97316', '#8b5cf6',
        '#14b8a6', '#ec4899', '#6366f1', '#06b6d4',
        '#f59e0b', '#ef4444'
    ];

    // Cargar ApexCharts dinamicamente
    async function loadApexCharts() {
        if (window.ApexCharts) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/apexcharts';
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar ApexCharts'));
            document.head.appendChild(script);
        });
    }

    // Inicializador del modulo
    async function init() {
        console.log('Dashboard V2 inicializando...');

        // Verificar permisos
        const hasView = window.App?.hasPerm && window.App.hasPerm('dashboard.view');
        if (!hasView) {
            const root = document.getElementById('dashboard-module');
            if (root) {
                root.innerHTML = `
                    <div class="dashboard-error">
                        <div class="error-icon">!</div>
                        <h3>Acceso Denegado</h3>
                        <p>No tienes permisos para ver el dashboard.</p>
                    </div>
                `;
            }
            return;
        }

        // Cargar ApexCharts
        try {
            await loadApexCharts();
        } catch (err) {
            console.error('Error cargando ApexCharts:', err);
        }

        mapElements();
        bindEvents();
        await loadDashboardData();
    }

    function mapElements() {
        elements = {
            // Header
            periodSelect: document.getElementById('dashboard-period-select'),
            customDates: document.getElementById('custom-dates'),
            dateFrom: document.getElementById('date-from'),
            dateTo: document.getElementById('date-to'),
            refreshBtn: document.getElementById('dashboard-refresh-btn'),
            retryBtn: document.getElementById('dashboard-retry-btn'),

            // States
            loading: document.getElementById('dashboard-loading'),
            error: document.getElementById('dashboard-error'),
            errorMsg: document.getElementById('dashboard-error-msg'),

            // Tabs
            tabBtns: document.querySelectorAll('#dashboard-module .tab-btn'),
            tabContents: document.querySelectorAll('#dashboard-module .tab-content'),

            // Tab Resumen - KPIs principales
            kpiTotalReportes: document.getElementById('kpi-total-reportes'),
            kpiTotalPagos: document.getElementById('kpi-total-pagos'),
            kpiMontoVes: document.getElementById('kpi-monto-ves'),
            kpiCantidadVes: document.getElementById('kpi-cantidad-ves'),
            kpiMontoUsd: document.getElementById('kpi-monto-usd'),
            kpiCantidadUsd: document.getElementById('kpi-cantidad-usd'),

            // Tab Resumen - KPIs secundarios
            kpiEmailsEnviados: document.getElementById('kpi-emails-enviados'),
            kpiEmailsAbiertos: document.getElementById('kpi-emails-abiertos'),
            kpiConversaciones: document.getElementById('kpi-conversaciones'),

            // Tab Resumen - Charts
            chartPagosMetodo: document.getElementById('chart-pagos-metodo'),
            rankingInstituciones: document.getElementById('ranking-instituciones'),

            // Tab Reportes - KPIs
            repTotal: document.getElementById('rep-total'),
            repEmailsEnviados: document.getElementById('rep-emails-enviados'),
            repEmailsAbiertos: document.getElementById('rep-emails-abiertos'),
            repTasaApertura: document.getElementById('rep-tasa-apertura'),
            repAnonimos: document.getElementById('rep-anonimos'),
            repNotificados: document.getElementById('rep-notificados'),

            // Tab Reportes - Charts
            chartRepEstado: document.getElementById('chart-rep-estado'),
            chartRepDepartamento: document.getElementById('chart-rep-departamento'),

            // Tab Pagos - KPIs
            pagTotal: document.getElementById('pag-total'),
            pagMontoVes: document.getElementById('pag-monto-ves'),
            pagCantidadVes: document.getElementById('pag-cantidad-ves'),
            pagMontoUsd: document.getElementById('pag-monto-usd'),
            pagCantidadUsd: document.getElementById('pag-cantidad-usd'),
            pagVerificados: document.getElementById('pag-verificados'),
            pagPendientes: document.getElementById('pag-pendientes'),

            // Tab Pagos - Charts
            chartPagosMetodoTab: document.getElementById('chart-pagos-metodo-tab'),
            chartPagosTipo: document.getElementById('chart-pagos-tipo'),
            chartPagosMoneda: document.getElementById('chart-pagos-moneda'),

            // Footer
            lastUpdate: document.getElementById('dashboard-last-update')
        };
    }

    function bindEvents() {
        // Periodo
        if (elements.periodSelect) {
            elements.periodSelect.addEventListener('change', onPeriodChange);
        }

        // Fechas personalizadas
        if (elements.dateFrom) {
            elements.dateFrom.addEventListener('change', onCustomDateChange);
        }
        if (elements.dateTo) {
            elements.dateTo.addEventListener('change', onCustomDateChange);
        }

        // Botones
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', loadDashboardData);
        }
        if (elements.retryBtn) {
            elements.retryBtn.addEventListener('click', loadDashboardData);
        }

        // Tabs
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
    }

    function switchTab(tabId) {
        state.currentTab = tabId;

        elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }

    function onPeriodChange(e) {
        state.period = e.target.value;
        if (state.period === 'custom') {
            elements.customDates.classList.remove('hidden');
        } else {
            elements.customDates.classList.add('hidden');
            loadDashboardData();
        }
    }

    function onCustomDateChange() {
        state.customDateFrom = elements.dateFrom.value;
        state.customDateTo = elements.dateTo.value;
        if (state.customDateFrom && state.customDateTo) {
            loadDashboardData();
        }
    }

    function getDateRange() {
        const now = new Date();
        let fechaInicio = null;
        let fechaFin = null;

        switch (state.period) {
            case 'today':
                fechaInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                fechaFin = now;
                break;
            case '7days':
                fechaInicio = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                fechaFin = now;
                break;
            case '30days':
                fechaInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                fechaFin = now;
                break;
            case 'thisMonth':
                fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                fechaFin = now;
                break;
            case 'lastMonth':
                fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                fechaFin = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;
            case 'custom':
                if (state.customDateFrom && state.customDateTo) {
                    fechaInicio = new Date(state.customDateFrom);
                    fechaFin = new Date(state.customDateTo + 'T23:59:59');
                }
                break;
            case 'all':
            default:
                fechaInicio = null;
                fechaFin = null;
                break;
        }

        return {
            fechaInicio: fechaInicio ? fechaInicio.toISOString() : null,
            fechaFin: fechaFin ? fechaFin.toISOString() : null
        };
    }

    async function loadDashboardData() {
        showLoading();

        try {
            const { supabase } = window.App;
            if (!supabase) throw new Error('Supabase no inicializado');

            const { fechaInicio, fechaFin } = getDateRange();

            const { data, error } = await supabase.rpc('get_dashboard_metrics_v2', {
                p_fecha_inicio: fechaInicio,
                p_fecha_fin: fechaFin
            });

            if (error) {
                console.error('Error en RPC:', error);
                throw new Error(error.message || 'Error al obtener metricas');
            }

            if (!data) {
                throw new Error('No se recibieron datos');
            }

            console.log('Metricas V2 recibidas:', data);

            state.data = data;
            state.lastUpdate = new Date();

            renderDashboard();
            hideLoading();

        } catch (err) {
            console.error('Error cargando dashboard:', err);
            showError(err.message || 'Error desconocido');
        }
    }

    function renderDashboard() {
        if (!state.data) return;

        const { reportes, pagos, general } = state.data;

        // === TAB RESUMEN ===
        // KPIs principales
        setText(elements.kpiTotalReportes, formatNumber(reportes.total));
        setText(elements.kpiTotalPagos, formatNumber(pagos.total));
        setText(elements.kpiMontoVes, formatBs(pagos.total_ves));
        setText(elements.kpiCantidadVes, `${formatNumber(pagos.cantidad_ves)} pagos`);
        setText(elements.kpiMontoUsd, formatUsd(pagos.total_usd));
        setText(elements.kpiCantidadUsd, `${formatNumber(pagos.cantidad_usd)} pagos`);

        // KPIs secundarios
        setText(elements.kpiEmailsEnviados, formatNumber(reportes.emails_enviados));
        setText(elements.kpiEmailsAbiertos, formatNumber(reportes.emails_abiertos));
        setText(elements.kpiConversaciones, formatNumber(general.total_conversaciones));

        // Grafica de dona - Pagos por metodo
        renderDonutChart(elements.chartPagosMetodo, pagos.por_metodo, 'pagosMetodo');
        renderPercentageStats('stats-pagos-metodo', pagos.por_metodo, 'pagos');

        // Ranking de instituciones
        renderRanking(elements.rankingInstituciones, reportes.por_departamento);

        // === TAB REPORTES ===
        setText(elements.repTotal, formatNumber(reportes.total));
        setText(elements.repEmailsEnviados, formatNumber(reportes.emails_enviados));
        setText(elements.repEmailsAbiertos, formatNumber(reportes.emails_abiertos));

        const tasaApertura = reportes.emails_enviados > 0
            ? Math.round((reportes.emails_abiertos / reportes.emails_enviados) * 100)
            : 0;
        setText(elements.repTasaApertura, `${tasaApertura}%`);

        setText(elements.repAnonimos, formatNumber(reportes.anonimos));
        setText(elements.repNotificados, formatNumber(reportes.notificados));

        // Graficas de reportes
        renderDonutChart(elements.chartRepEstado, reportes.por_estado, 'repEstado', 'reportes');
        renderPercentageStats('stats-rep-estado', reportes.por_estado, 'reportes');
        
        renderBarChart(elements.chartRepDepartamento, reportes.por_departamento, 'repDepartamento');
        renderPercentageStats('stats-rep-departamento', reportes.por_departamento, 'reportes');

        // === TAB PAGOS ===
        setText(elements.pagTotal, formatNumber(pagos.total));
        setText(elements.pagMontoVes, formatBs(pagos.total_ves));
        setText(elements.pagCantidadVes, `${formatNumber(pagos.cantidad_ves)} pagos`);
        setText(elements.pagMontoUsd, formatUsd(pagos.total_usd));
        setText(elements.pagCantidadUsd, `${formatNumber(pagos.cantidad_usd)} pagos`);
        setText(elements.pagVerificados, formatNumber(pagos.verificados));
        setText(elements.pagPendientes, formatNumber(pagos.pendientes));

        // Graficas de pagos
        renderDonutChart(elements.chartPagosMetodoTab, pagos.por_metodo, 'pagosMetodoTab');
        renderPercentageStats('stats-pagos-metodo-tab', pagos.por_metodo, 'pagos');
        
        renderDonutChart(elements.chartPagosTipo, pagos.por_tipo, 'pagosTipo');
        renderPercentageStats('stats-pagos-tipo', pagos.por_tipo, 'pagos');
        
        renderDonutChart(elements.chartPagosMoneda, pagos.por_moneda, 'pagosMoneda');
        renderPercentageStats('stats-pagos-moneda', pagos.por_moneda, 'pagos');

        // Footer
        if (elements.lastUpdate && state.lastUpdate) {
            elements.lastUpdate.textContent = state.lastUpdate.toLocaleString();
        }
    }

    function renderDonutChart(container, data, chartKey, tooltipLabel = 'pagos') {
        if (!container || !data || data.length === 0 || !window.ApexCharts) return;

        // Destruir chart anterior
        if (state.charts[chartKey]) {
            state.charts[chartKey].destroy();
        }

        const series = data.map(d => d.count || 0);
        const total = series.reduce((sum, val) => sum + val, 0);
        const labels = data.map((d, i) => {
            const percentage = total > 0 ? ((series[i] / total) * 100).toFixed(1) : 0;
            return `${d.name || 'Sin especificar'} (${percentage}%)`;
        });

        const options = {
            series: series,
            chart: {
                type: 'donut',
                height: 280,
                fontFamily: 'inherit'
            },
            labels: labels,
            colors: CHART_COLORS.slice(0, labels.length),
            legend: {
                position: 'right',
                fontSize: '12px',
                markers: {
                    width: 10,
                    height: 10,
                    radius: 5
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#64748b',
                                formatter: function(w) {
                                    return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                }
                            }
                        }
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    const percentage = opts.w.globals.seriesPercent[opts.seriesIndex][0].toFixed(1);
                    return percentage + '%';
                },
                style: {
                    fontSize: '14px',
                    fontWeight: 600,
                    colors: ['#fff']
                },
                dropShadow: {
                    enabled: true,
                    top: 1,
                    left: 1,
                    blur: 1,
                    opacity: 0.45
                }
            },
            tooltip: {
                y: {
                    formatter: function(val, opts) {
                        const percentage = opts.w.globals.seriesPercent[opts.seriesIndex][0].toFixed(1);
                        return val + ' ' + tooltipLabel + ' (' + percentage + '%)';
                    }
                }
            },
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: { height: 250 },
                    legend: { position: 'bottom' }
                }
            }]
        };

        state.charts[chartKey] = new ApexCharts(container, options);
        state.charts[chartKey].render();
    }

    function renderBarChart(container, data, chartKey) {
        if (!container || !data || data.length === 0 || !window.ApexCharts) return;

        // Destruir chart anterior
        if (state.charts[chartKey]) {
            state.charts[chartKey].destroy();
        }

        // Tomar top 8
        const topData = data.slice(0, 8);
        const categories = topData.map(d => truncate(d.name || 'Sin especificar', 20));
        const series = topData.map(d => d.count || 0);

        const options = {
            series: [{
                name: 'Cantidad',
                data: series
            }],
            chart: {
                type: 'bar',
                height: 280,
                fontFamily: 'inherit',
                toolbar: { show: false }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4,
                    barHeight: '70%',
                    distributed: true
                }
            },
            colors: CHART_COLORS,
            xaxis: {
                categories: categories,
                labels: {
                    style: {
                        fontSize: '11px',
                        colors: '#64748b'
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        fontSize: '11px',
                        colors: '#1e293b'
                    },
                    maxWidth: 150
                }
            },
            legend: { show: false },
            dataLabels: {
                enabled: true,
                style: {
                    fontSize: '11px',
                    colors: ['#fff']
                }
            },
            tooltip: {
                y: {
                    formatter: function(val) {
                        return val + ' reportes';
                    }
                }
            },
            grid: {
                borderColor: '#f1f5f9',
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: false } }
            }
        };

        state.charts[chartKey] = new ApexCharts(container, options);
        state.charts[chartKey].render();
    }

    function renderRanking(container, data) {
        if (!container || !data || data.length === 0) return;

        const top5 = data.slice(0, 5);
        const positionClasses = ['gold', 'silver', 'bronze', '', ''];
        const total = data.reduce((sum, item) => sum + item.count, 0);

        container.innerHTML = top5.map((item, i) => {
            const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
            return `
                <div class="ranking-item">
                    <span class="ranking-position ${positionClasses[i]}">${i + 1}</span>
                    <span class="ranking-name" title="${item.name}">${truncate(item.name, 25)}</span>
                    <div class="ranking-value-container">
                        <span class="ranking-value">${item.count}</span>
                        <span class="ranking-percentage">${percentage}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPercentageStats(containerId, data, label = 'item') {
        const container = document.getElementById(containerId);
        if (!container || !data || data.length === 0) return;

        const total = data.reduce((sum, item) => sum + item.count, 0);
        
        container.innerHTML = data.map((item, i) => {
            const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
            const color = CHART_COLORS[i % CHART_COLORS.length];
            
            return `
                <div class="percentage-stat-item">
                    <div class="stat-bar-container">
                        <div class="stat-bar" style="width: ${percentage}%; background: ${color};"></div>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">${item.name || 'Sin especificar'}</span>
                        <div class="stat-values">
                            <span class="stat-count">${formatNumber(item.count)} ${label}</span>
                            <span class="stat-percentage">${percentage}%</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // === UTILITIES ===
    function showLoading() {
        if (elements.loading) elements.loading.classList.remove('hidden');
        if (elements.error) elements.error.classList.add('hidden');
    }

    function hideLoading() {
        if (elements.loading) elements.loading.classList.add('hidden');
    }

    function showError(message) {
        if (elements.loading) elements.loading.classList.add('hidden');
        if (elements.error) elements.error.classList.remove('hidden');
        if (elements.errorMsg) elements.errorMsg.textContent = message;
    }

    function setText(el, value) {
        if (el) el.textContent = value;
    }

    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        const n = Number(num);
        if (isNaN(n)) return '0';
        return n.toLocaleString('es-VE');
    }

    function formatBs(num) {
        if (num === null || num === undefined) return 'Bs. 0';
        const n = Number(num);
        if (isNaN(n)) return 'Bs. 0';
        if (n >= 1000000) return 'Bs. ' + (n / 1000000).toFixed(2) + 'M';
        if (n >= 1000) return 'Bs. ' + (n / 1000).toFixed(1) + 'K';
        return 'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatUsd(num) {
        if (num === null || num === undefined) return '$0.00';
        const n = Number(num);
        if (isNaN(n)) return '$0.00';
        if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
        if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'K';
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Exponer API publica
    window.DashboardModule = {
        init: init,
        refresh: loadDashboardData
    };
})();
