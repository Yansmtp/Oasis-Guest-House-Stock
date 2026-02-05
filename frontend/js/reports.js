// Fallback in case utils.js did not attach parseNumberSafe yet.
var parseNumberSafe = window.parseNumberSafe || function (value) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
        try { return value.toNumber(); } catch (e) { /* noop */ }
    }
    let s = String(value).trim();
    s = s.replace(/[^0-9\-.,]/g, '');
    if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

async function loadCurrencyOptions(selectId, selectedCode = 'USD') {
    try {
        const response = await apiRequest('/currencies');
        const list = response?.data || [];
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '';
        list.forEach(c => {
            const option = document.createElement('option');
            option.value = c.code;
            option.textContent = `${c.code} - ${c.name}`;
            if (c.code === selectedCode || (c.isDefault && !selectedCode)) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading currencies:', error);
    }
}

function normalizeLogoUrl(logoPath) {
    if (!logoPath) return null;
    if (/^https?:\/\//i.test(logoPath)) return logoPath;
    if (typeof API_BASE_URL !== 'undefined') {
        return API_BASE_URL.replace(/\/$/, '') + '/' + logoPath.replace(/^\//, '');
    }
    return logoPath.startsWith('/') ? logoPath : '/' + logoPath;
}

async function getCompanyLogoUrl() {
    try {
        const company = await apiRequest('/company');
        return normalizeLogoUrl(company?.logo);
    } catch (error) {
        console.warn('getCompanyLogoUrl: no se pudo cargar el logo', error);
        return null;
    }
}

// Mostrar reporte de stock
async function showStockReport(currencyCode = 'USD') {
    try {
        showLoading('report-content');
        
        const response = await apiRequest(`/reports/stock?currency=${encodeURIComponent(currencyCode)}`) || {};
        // apiRequest sometimes wraps result in { data: ... }
        const data = response.data || response || {};
        const summary = data.summary || {};
        const lowStockProducts = data.lowStockProducts || [];
        const products = data.products || [];
        
        const html = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-boxes"></i> Reporte de Inventario</h3>
                    <div class="d-flex gap-2 align-items-center">
                        <select id="stock-report-currency" class="form-control no-print">
                        </select>
                        <button class="btn btn-primary" onclick="printStockReport()">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary">
                                <i class="fas fa-boxes"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.totalProducts ?? 0}</h3>
                                <p>Productos Totales</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.lowStockCount ?? 0}</h3>
                                <p>Bajo Stock</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-success">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${formatCurrency(summary.totalValue ?? 0, summary.currency || currencyCode)}</h3>
                                <p>Valor Total</p>
                            </div>
                        </div>
                    </div>
                    
                    <h4>Productos Bajo Stock</h4>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>Unidad</th>
                                    <th>Stock Actual</th>
                                    <th>Stock Mínimo</th>
                                    <th>Costo Unit.</th>
                                    <th>Valor Total</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lowStockProducts.map(product => `
                                    <tr class="table-danger">
                                        <td>${product?.code || ''}</td>
                                        <td>${product?.name || ''}</td>
                                        <td>${formatUnit(product?.unit)}</td>
                                        <td>${formatNumber(product?.stock || 0)}</td>
                                        <td>${formatNumber(product?.minStock || 0)}</td>
                                        <td>${formatCurrency((product?.unitCostReport !== undefined ? product.unitCostReport : product?.unitCost) || 0, summary.currency || currencyCode)}</td>
                                        <td>${formatCurrency((product?.totalValueReport !== undefined ? product.totalValueReport : (product?.stock || 0) * (product?.unitCost || 0)), summary.currency || currencyCode)}</td>
                                        <td>
                                            <span class="status-badge status-low">
                                                Bajo Stock
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <h4>Inventario Completo</h4>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>Unidad</th>
                                    <th>Stock</th>
                                    <th>Stock Mín.</th>
                                    <th>Stock Máx.</th>
                                    <th>Costo Unit.</th>
                                    <th>Valor Total</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(product => `
                                    <tr ${(parseNumberSafe(product?.stock || 0)) <= (parseNumberSafe(product?.minStock || 0)) ? 'class="table-danger"' : ''}>
                                        <td>${product?.code || ''}</td>
                                        <td>${product?.name || ''}</td>
                                        <td>${formatUnit(product?.unit)}</td>
                                        <td>${formatNumber(product?.stock || 0)}</td>
                                        <td>${formatNumber(product?.minStock || 0)}</td>
                                        <td>${product?.maxStock ? formatNumber(product.maxStock) : '-'}</td>
                                        <td>${formatCurrency((product?.unitCostReport !== undefined ? product.unitCostReport : product?.unitCost) || 0, summary.currency || currencyCode)}</td>
                                        <td>${formatCurrency((product?.totalValueReport !== undefined ? product.totalValueReport : (product?.stock || 0) * (product?.unitCost || 0)), summary.currency || currencyCode)}</td>
                                        <td>
                                            <span class="status-badge ${(parseNumberSafe(product?.stock || 0)) <= (parseNumberSafe(product?.minStock || 0)) ? 'status-low' : 'status-active'}">
                                                ${(parseNumberSafe(product?.stock || 0)) <= (parseNumberSafe(product?.minStock || 0)) ? 'Bajo Stock' : 'Normal'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('report-content').innerHTML = html;
        await loadCurrencyOptions('stock-report-currency', summary.currency || currencyCode);
        const select = document.getElementById('stock-report-currency');
        if (select) {
            select.onchange = () => showStockReport(select.value);
        }
        
    } catch (error) {
        console.error('Error loading stock report:', error);
        showAlert('Error al cargar el reporte de stock', 'error');
    } finally {
        hideLoading();
    }
}

// Mostrar reporte de movimientos
async function showMovementsReport() {
    const html = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-exchange-alt"></i> Reporte de Movimientos</h3>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Fecha Inicio</label>
                            <input type="date" id="movement-report-start" class="form-control" 
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Fecha Fin</label>
                            <input type="date" id="movement-report-end" class="form-control" 
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Moneda del Reporte</label>
                            <select id="movement-report-currency" class="form-control no-print"></select>
                        </div>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" id="generate-movements-btn" onclick="generateMovementsReport()">
                        <i class="fas fa-chart-bar"></i> Generar Reporte
                    </button>
                    <button class="btn btn-secondary" id="print-movements-btn" onclick="printMovementsReport()" disabled>
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
            </div>
        </div>
        
        <div id="movement-report-result"></div>
    `;
    
    document.getElementById('report-content').innerHTML = html;
    await loadCurrencyOptions('movement-report-currency', 'USD');
}

// Generar reporte de movimientos
async function generateMovementsReport() {
    const startDate = document.getElementById('movement-report-start').value;
    const endDate = document.getElementById('movement-report-end').value;
    const currency = document.getElementById('movement-report-currency')?.value || 'USD';
    
    if (!startDate || !endDate) {
        showAlert('Por favor, seleccione ambas fechas', 'warning');
        return;
    }
    
    try {
        showLoading('movement-report-result');
        
        const response = await apiRequest(`/movements/movements-report?startDate=${startDate}&endDate=${endDate}&currency=${encodeURIComponent(currency)}`) || {};
        const data = response.data || response || {};
        const summary = data.summary || {};
        
        const html = `
            <div class="card mt-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h4>Resumen del Período: ${formatDate(startDate)} - ${formatDate(endDate)}</h4>
                    <button class="btn btn-primary" onclick="printMovementsReport()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
                <div class="card-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon bg-success">
                                <i class="fas fa-arrow-down"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.totalEntries ?? 0}</h3>
                                <p>Entradas</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-warning">
                                <i class="fas fa-arrow-up"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.totalExits ?? 0}</h3>
                                <p>Salidas</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-primary">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${formatCurrency(summary.totalEntriesValue ?? 0, summary.currency || currency)}</h3>
                                <p>Valor Entradas</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-danger">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${formatCurrency(summary.totalExitsValue ?? 0, summary.currency || currency)}</h3>
                                <p>Valor Salidas</p>
                            </div>
                        </div>
                    </div>
                    
                    <h4>Movimientos por Producto</h4>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Entradas (Cantidad)</th>
                                    <th>Entradas (Valor)</th>
                                    <th>Salidas (Cantidad)</th>
                                    <th>Salidas (Valor)</th>
                                    <th>Saldo Final</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.values(summary.products || {}).map(item => `
                                    <tr>
                                        <td>${item.product?.name || ''}</td>
                                        <td>${formatNumber(item.entries || 0)} ${formatUnit(item.product?.unit)}</td>
                                        <td>${formatCurrency(item.entriesValue || 0, summary.currency || currency)}</td>
                                        <td>${formatNumber(item.exits || 0)} ${formatUnit(item.product?.unit)}</td>
                                        <td>${formatCurrency(item.exitsValue || 0, summary.currency || currency)}</td>
                                        <td>${formatNumber(item.product?.stock || 0)} ${formatUnit(item.product?.unit)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <h4>Listado de Movimientos</h4>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Documento</th>
                                    <th>Cliente/Centro</th>
                                    <th>Productos</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(data.movements || []).map(movement => `
                                    <tr>
                                        <td>${formatDate(movement.date)}</td>
                                        <td>
                                            <span class="status-badge ${movement.type === 'ENTRADA' ? 'status-active' : 'status-inactive'}">
                                                ${movement.type === 'ENTRADA' ? 'Entrada' : 'Salida'}
                                            </span>
                                        </td>
                                        <td>${movement.documentNumber || 'N/A'}</td>
                                        <td>
                                            ${movement.client ? movement.client.name : ''}
                                            ${movement.costCenter ? movement.costCenter.name : ''}
                                        </td>
                                        <td>
                                            ${(movement.details || []).map(detail => 
                                                `${detail.product?.name || ''} (${formatNumber(detail.quantity || 0)} ${formatUnit(detail.product?.unit)})`
                                            ).join('<br>')}
                                        </td>
                                        <td>
                                            ${formatCurrency((movement.reportTotal !== undefined ? movement.reportTotal : (movement.details || []).reduce((sum, detail) => sum + (parseNumberSafe(detail.totalCost) || 0), 0)), summary.currency || currency)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('movement-report-result').innerHTML = html;

        // Habilitar botón de impresión en la sección de control
        const printBtn = document.getElementById('print-movements-btn');
        if (printBtn) printBtn.disabled = false;
        
    } catch (error) {
        console.error('Error generating movements report:', error);
        showAlert('Error al generar el reporte de movimientos', 'error');
    } finally {
        hideLoading();
    }
}

// Mostrar reporte por cliente
async function showClientReport() {
    try {
        // Cargar clientes para selección
        const response = await apiRequest('/clients?activeOnly=true&limit=1000') || {};
        
        const clientsOptions = (Array.isArray(response.data) ? response.data : []).map(client => 
            `<option value="${client.id}">${client.code} - ${client.name}</option>`
        ).join('');
        
        const html = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-users"></i> Reporte por Cliente</h3>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>Cliente</label>
                                <select id="client-report-client" class="form-control">
                                    <option value="">Seleccionar cliente</option>
                                    ${clientsOptions}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>Fecha Inicio</label>
                                <input type="date" id="client-report-start" class="form-control">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>Fecha Fin</label>
                                <input type="date" id="client-report-end" class="form-control">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>Moneda del Reporte</label>
                                <select id="client-report-currency" class="form-control no-print"></select>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary" id="generate-client-btn" onclick="generateClientReport()">
                            <i class="fas fa-chart-bar"></i> Generar Reporte
                        </button>
                        <button class="btn btn-secondary" id="print-client-btn" onclick="printClientReport()" disabled>
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="client-report-result"></div>
        `;
        
        document.getElementById('report-content').innerHTML = html;
        await loadCurrencyOptions('client-report-currency', 'USD');
        
    } catch (error) {
        console.error('Error setting up client report:', error);
        showAlert('Error al cargar los clientes', 'error');
    }
}

// Generar reporte por cliente
async function generateClientReport() {
    const clientId = document.getElementById('client-report-client').value;
    const startDate = document.getElementById('client-report-start').value;
    const endDate = document.getElementById('client-report-end').value;
    const currency = document.getElementById('client-report-currency')?.value || 'USD';
    
    if (!clientId) {
        showAlert('Por favor, seleccione un cliente', 'warning');
        return;
    }
    
    try {
        showLoading('client-report-result');
        
        let url = `/reports/client/${clientId}`;
        if (startDate) url += `?startDate=${startDate}`;
        if (endDate) url += `${startDate ? '&' : '?'}endDate=${endDate}`;
        
        if (currency) url += `${url.includes('?') ? '&' : '?'}currency=${encodeURIComponent(currency)}`;
        const response = await apiRequest(url) || {};
        const data = response.data || response || {};
        // Normalizar detalles numéricos
        (data.movements || []).forEach(m => {
            if (m.details && Array.isArray(m.details)) {
                m.details = m.details.map(d => ({
                    ...d,
                    quantity: parseNumberSafe(d.quantity),
                    unitCost: parseNumberSafe(d.unitCost),
                    totalCost: parseNumberSafe(d.totalCost)
                }));
            }
        });
        const summary = data.summary || {};
        const movements = data.movements || [];
        
        const html = `
            <div class="card mt-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <h4>Reporte del Cliente: ${movements[0]?.client?.name || 'Cliente'}</h4>
                        ${startDate || endDate ? `<p>Período: ${startDate || 'Inicio'} - ${endDate || 'Fin'}</p>` : ''}
                    </div>
                    <button class="btn btn-primary" onclick="printClientReport()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
                <div class="card-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary">
                                <i class="fas fa-exchange-alt"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.totalMovements ?? 0}</h3>
                                <p>Total Movimientos</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-success">
                                <i class="fas fa-arrow-down"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.totalEntries ?? 0}</h3>
                                <p>Entradas</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-warning">
                                <i class="fas fa-arrow-up"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${summary.totalExits ?? 0}</h3>
                                <p>Salidas</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon bg-danger">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${formatCurrency(summary.totalValue ?? 0, summary.currency || currency)}</h3>
                                <p>Valor Total</p>
                            </div>
                        </div>
                    </div>
                    
                    <h4>Resumen por Producto</h4>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cantidad Total</th>
                                    <th>Valor Total</th>
                                    <th>Promedio por Movimiento</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.values(summary.products || {}).map(item => `
                                    <tr>
                                        <td>${item.product?.name || ''}</td>
                                        <td>${formatNumber(item.totalQuantity || 0)} ${formatUnit(item.product?.unit)}</td>
                                        <td>${formatCurrency(item.totalValue || 0, summary.currency || currency)}</td>
                                        <td>${formatCurrency((item.totalValue || 0) / (summary.totalMovements || 1), summary.currency || currency)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <h4>Listado de Movimientos</h4>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Documento</th>
                                    <th>Descripción</th>
                                    <th>Productos</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(movements || []).map(movement => `
                                    <tr>
                                        <td>${formatDate(movement.date)}</td>
                                        <td>
                                            <span class="status-badge ${movement.type === 'ENTRADA' ? 'status-active' : 'status-inactive'}">
                                                ${movement.type === 'ENTRADA' ? 'Entrada' : 'Salida'}
                                            </span>
                                        </td>
                                        <td>${movement.documentNumber || 'N/A'}</td>
                                        <td>${movement.description || ''}</td>
                                        <td>
                                            ${(movement.details || []).map(detail => 
                                                `${detail.product?.name || ''} (${formatNumber(detail.quantity || 0)} ${formatUnit(detail.product?.unit)})`
                                            ).join('<br>')}
                                        </td>
                                        <td>
                                            ${formatCurrency((movement.reportTotal !== undefined ? movement.reportTotal : (movement.details || []).reduce((sum, detail) => sum + (parseNumberSafe(detail.totalCost) || 0), 0)), summary.currency || currency)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('client-report-result').innerHTML = html;

        // Habilitar botón de impresión en la sección de control
        const printBtn = document.getElementById('print-client-btn');
        if (printBtn) printBtn.disabled = false;
        
    } catch (error) {
        console.error('Error generating client report:', error);
        showAlert('Error al generar el reporte del cliente', 'error');
    } finally {
        hideLoading();
    }
}

// Imprimir reporte de stock
async function printStockReport() {
    const content = document.getElementById('report-content').innerHTML;
    const logoUrl = await getCompanyLogoUrl();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Reporte de Inventario</title>
                <link rel="stylesheet" href="css/print.css">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20mm; }
                    .report-header { text-align: center; margin-bottom: 30px; }
                    .report-logo { width: 3cm; height: 3cm; object-fit: contain; display: block; margin: 0 auto 10mm; }
                    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
                    .stat-card { border: 1px solid #000; padding: 15px; text-align: center; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th, .table td { border: 1px solid #000; padding: 8px; }
                    .table-danger { background-color: #f8d7da !important; }
                    .no-print { display: none; }
                </style>
            </head>
            <body>
                <div class="report-header">
                    ${logoUrl ? `<img class="report-logo" src="${logoUrl}" alt="Logo">` : ''}
                    <h1>Reporte de Inventario</h1>
                    <p>Generado: ${new Date().toLocaleDateString()}</p>
                </div>
                ${content}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

async function printReport(elementId, title) {
    const content = document.getElementById(elementId)?.innerHTML;
    if (!content) {
        showAlert('No hay contenido para imprimir', 'warning');
        return;
    }

    const logoUrl = await getCompanyLogoUrl();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <link rel="stylesheet" href="css/print.css">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20mm; }
                    .report-header { text-align: center; margin-bottom: 30px; }
                    .report-logo { width: 3cm; height: 3cm; object-fit: contain; display: block; margin: 0 auto 10mm; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th, .table td { border: 1px solid #000; padding: 8px; }
                    .table-danger { background-color: #f8d7da !important; }
                </style>
            </head>
            <body>
                <div class="report-header">
                    ${logoUrl ? `<img class="report-logo" src="${logoUrl}" alt="Logo">` : ''}
                    <h1>${title}</h1>
                    <p>Generado: ${new Date().toLocaleDateString()}</p>
                </div>
                ${content}
            </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

function printMovementsReport() {
    printReport('movement-report-result', 'Reporte de Movimientos');
}

function printClientReport() {
    printReport('client-report-result', 'Reporte por Cliente');
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    // Inicialización específica de reportes si es necesario
});
