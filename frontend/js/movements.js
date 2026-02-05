let movements = [];
let currentMovementPage = 1;
let totalMovementPages = 1;
let movementDetails = [];
let movementProducts = [];
let movementCurrencies = [];
let movementCurrencyCode = 'USD';
let movementCurrencyRate = 1;

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

// Cargar movimientos
async function loadMovements(page = 1, filters = {}) {
    try {
        showLoading('movements-table');
        
        let url = `/movements?page=${page}&limit=10`;
        
        if (filters.type) url += `&type=${filters.type}`;
        if (filters.startDate) url += `&startDate=${filters.startDate}`;
        if (filters.endDate) url += `&endDate=${filters.endDate}`;
        if (filters.clientId) url += `&clientId=${filters.clientId}`;
        if (filters.costCenterId) url += `&costCenterId=${filters.costCenterId}`;
        
        const response = await apiRequest(url);
        
        movements = (response.data || []).map(m => {
            if (m.details && Array.isArray(m.details)) {
                m.details = m.details.map(d => ({
                    ...d,
                    quantity: parseNumberSafe(d.quantity),
                    unitCost: parseNumberSafe(d.unitCost),
                    totalCost: parseNumberSafe(d.totalCost)
                }));
            }
            return m;
        });
        currentMovementPage = response.meta.page;
        totalMovementPages = response.meta.totalPages;
        
        renderMovementsTable();
        createPagination('movements-pagination', currentMovementPage, totalMovementPages, 
            (newPage) => loadMovements(newPage, filters));
        
    } catch (error) {
        console.error('Error loading movements:', error);
    } finally {
        hideLoading();
    }
}

// Renderizar tabla de movimientos
function renderMovementsTable() {
    const tbody = document.getElementById('movements-table').querySelector('tbody');
    tbody.innerHTML = '';
    
    if (movements.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="8" class="text-center">
                No se encontraron movimientos
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    movements.forEach(movement => {
        const row = document.createElement('tr');
        
        // Determinar cliente o centro de costo
        let entity = '';
        if (movement.client) {
            entity = `<strong>Cliente:</strong> ${movement.client.name}`;
        } else if (movement.costCenter) {
            entity = `<strong>Centro:</strong> ${movement.costCenter.name}`;
        }
        
        // Verificar tipos de detalle y calcular total (usar parseNumberSafe para robustez)
        const badDetails = (movement.details || []).filter(d => typeof d.totalCost !== 'number');
        if (badDetails.length) {
            console.debug('renderMovementsTable: movement with non-numeric detail totals', movement.id, badDetails);
        }
        const total = (movement.details || []).reduce((sum, detail) => sum + (parseNumberSafe(detail.totalCost) || 0), 0);
        
        // Contar productos
        const productCount = movement.details.length;
        
        row.innerHTML = `
            <td>${formatDate(movement.date)}</td>
            <td>
                <span class="status-badge ${movement.type === 'ENTRADA' ? 'status-active' : 'status-inactive'}">
                    ${movement.type === 'ENTRADA' ? 'Entrada' : 'Salida'}
                </span>
            </td>
            <td>${movement.documentNumber || 'N/A'}</td>
            <td>${entity}</td>
            <td>${movement.description || ''}</td>
            <td>${productCount} producto(s)</td>
            <td>${formatCurrency(total)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="viewMovement(${movement.id})" title="Ver">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="printVoucher(${movement.id})" title="Imprimir">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Filtrar movimientos
function filterMovements() {
    const filters = {
        type: document.getElementById('movement-type-filter').value || undefined,
        startDate: document.getElementById('movement-start-date').value || undefined,
        endDate: document.getElementById('movement-end-date').value || undefined
    };
    
    loadMovements(1, filters);
}

// Limpiar filtros
function clearMovementFilters() {
    document.getElementById('movement-type-filter').value = '';
    document.getElementById('movement-start-date').value = '';
    document.getElementById('movement-end-date').value = '';
    loadMovements(1);
}

// Mostrar modal para movimiento
async function showMovementModal(type) {
    resetForm('movement-form');
    movementDetails = [];
    
    document.getElementById('movement-modal-title').textContent = 
        type === 'ENTRADA' ? 'Nueva Entrada' : 'Nueva Salida';
    
    document.getElementById('movement-type').value = type;
    document.getElementById('movement-date').value = new Date().toISOString().slice(0, 16);
    
    // Configurar campos según tipo
    if (type === 'ENTRADA') {
        document.getElementById('movement-client-section').style.display = 'block';
        document.getElementById('movement-cost-center-section').style.display = 'none';
        document.getElementById('movement-client-label').textContent = 'Proveedor *';
        document.getElementById('movement-currency-row').style.display = 'flex';
        await loadCurrenciesForMovement();
        await loadClientsForMovement('movement-client');
    } else {
        document.getElementById('movement-client-section').style.display = 'none';
        document.getElementById('movement-cost-center-section').style.display = 'block';
        document.getElementById('movement-currency-row').style.display = 'none';
        movementCurrencyCode = 'USD';
        movementCurrencyRate = 1;
        await loadCostCentersForMovement('movement-cost-center');
    }
    
    renderMovementDetails();
    showModal('movement-modal');
}

async function loadCurrenciesForMovement() {
    try {
        const response = await apiRequest('/currencies');
        movementCurrencies = response?.data || [];
        const select = document.getElementById('movement-currency');
        const rateInput = document.getElementById('movement-currency-rate');

        if (!select) return;
        select.innerHTML = '';
        movementCurrencies.forEach(c => {
            const option = document.createElement('option');
            option.value = c.code;
            option.textContent = `${c.code} - ${c.name}`;
            if (c.isDefault) option.selected = true;
            select.appendChild(option);
        });

        const selected = movementCurrencies.find(c => c.code === select.value) || movementCurrencies[0];
        if (selected) {
            movementCurrencyCode = selected.code;
            movementCurrencyRate = selected.rate || 1;
            if (rateInput) rateInput.value = (movementCurrencyRate > 0 ? (1 / movementCurrencyRate) : 0).toFixed(4);
        }

        select.onchange = () => {
            const chosen = movementCurrencies.find(c => c.code === select.value);
            if (!chosen) return;
            movementCurrencyCode = chosen.code;
            movementCurrencyRate = chosen.rate || 1;
            if (rateInput) rateInput.value = (movementCurrencyRate > 0 ? (1 / movementCurrencyRate) : 0).toFixed(4);
            // No convertimos detalles existentes para evitar cambios inesperados.
        };
    } catch (error) {
        console.error('Error loading currencies for movement:', error);
    }
}

// Cargar clientes para movimiento
async function loadClientsForMovement(selectId) {
    try {
        const response = await apiRequest('/clients?activeOnly=true&limit=1000');
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Seleccionar proveedor</option>';
        
        response.data.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.code} - ${client.name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Cargar centros de costo para movimiento
async function loadCostCentersForMovement(selectId) {
    try {
        const response = await apiRequest('/cost-centers?activeOnly=true&limit=1000');
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Seleccionar centro de costo</option>';
        
        response.data.forEach(center => {
            const option = document.createElement('option');
            option.value = center.id;
            option.textContent = `${center.code} - ${center.name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading cost centers:', error);
    }
}

// Agregar detalle al movimiento
async function addMovementDetail() {
    // Primero cargar productos para selección
    await loadProductsForSelection();
    showModal('product-selection-modal');
}

// Cargar productos para selección
async function loadProductsForSelection() {
    try {
        const response = await apiRequest('/products?activeOnly=true&limit=1000');
        movementProducts = response.data;
        
        const tbody = document.getElementById('products-selection-table').querySelector('tbody');
        tbody.innerHTML = '';
        
        movementProducts.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>${formatNumber(product.stock)} ${formatUnit(product.unit)}</td>
                <td>${formatCurrency(product.unitCost)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selectProduct(${product.id})">
                        Seleccionar
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Buscar productos en modal de selección
function searchProductsModal() {
    const search = document.getElementById('product-search-modal').value.toLowerCase();
    const rows = document.querySelectorAll('#products-selection-table tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

// Seleccionar producto para movimiento
function selectProduct(productId) {
    const product = movementProducts.find(p => p.id === productId);
    if (!product) return;
    
    // BUG FIX: No uses closeModal() porque cierra todo.
    // Solo ocultamos el modal de selección de productos y garantizamos que el modal principal
    // de movimiento permanezca abierto.
    const productModal = document.getElementById('product-selection-modal');
    if (productModal) {
        // Si usas clases CSS para mostrar/ocultar:
        productModal.classList.remove('active');
        // O si usas display/directamente:
        productModal.style.display = 'none';
    }

    // Aseguramos que el modal principal del movimiento permanezca visible.
    // Intentamos las dos formas más comunes de mostrarlo para ser compatible con distintas implementaciones.
    const movementModal = document.getElementById('movement-modal');
    if (movementModal) {
        // Mostrar por clase
        movementModal.classList.add('active');
        // Mostrar por estilo directo
        movementModal.style.display = 'block';

        // Devolver el foco a un elemento relevante dentro del modal (por ejemplo, el botón "Agregar detalle"
        // o el primer control de formulario) para evitar que un manejador de blur cierre el modal.
        const focusEl = movementModal.querySelector('#add-movement-detail-btn') ||
                        movementModal.querySelector('input, select, button, textarea');
        if (focusEl) focusEl.focus();
    }
    
    const movementType = document.getElementById('movement-type').value;
    const defaultUnitCost = movementType === 'ENTRADA' && movementCurrencyCode !== 'USD'
        ? (parseNumberSafe(product.unitCost) / (movementCurrencyRate || 1))
        : parseNumberSafe(product.unitCost);

    // Agregar el producto a la lista interna
    movementDetails.push({
        productId: product.id,
        product: product,
        quantity: 1,
        unitCost: defaultUnitCost,
        total: defaultUnitCost
    });

    // Refrescar la tabla que está al fondo (en el modal de entrada)
    renderMovementDetails();
    
    console.log("Producto seleccionado:", product.name);
}

// Renderizar detalles del movimiento
function renderMovementDetails() {
    const tbody = document.getElementById('movement-details-body');
    tbody.innerHTML = '';
    
    let total = 0;
    const movementType = document.getElementById('movement-type').value;
    
    movementDetails.forEach((detail, index) => {
        const row = document.createElement('tr');
        if (movementType === 'SALIDA') {
            detail.unitCost = parseNumberSafe(detail.product?.unitCost || detail.unitCost);
        }
        const detailTotal = (parseNumberSafe(detail.quantity) || 0) * (parseNumberSafe(detail.unitCost) || 0);
        total += detailTotal;
        
        row.innerHTML = `
            <td>
                <strong>${detail.product?.name || ''}</strong><br>
                <small>Código: ${detail.product?.code || ''} | Stock: ${formatNumber(detail.product?.stock || 0)} ${formatUnit(detail.product?.unit)}</small>
            </td>
            <td>
                <input type="number" class="form-control" 
                       value="${detail.quantity}" 
                       min="0.01" step="0.01"
                       onchange="updateMovementDetail(${index}, 'quantity', this.value)">
            </td>
            <td>
                <input type="number" class="form-control" 
                       value="${detail.unitCost}" 
                       min="0" step="0.01"
                       ${movementType === 'SALIDA' ? 'disabled' : ''}
                       onchange="updateMovementDetail(${index}, 'unitCost', this.value)">
            </td>
            <td>${formatCurrency(detailTotal)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeMovementDetail(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    document.getElementById('movement-total').textContent = formatCurrency(total);
}

// Actualizar detalle del movimiento
function updateMovementDetail(index, field, value) {
    if (index >= 0 && index < movementDetails.length) {
        movementDetails[index][field] = parseFloat(value);
        
        // Recalcular total
        movementDetails[index].total = 
            movementDetails[index].quantity * movementDetails[index].unitCost;
        
        renderMovementDetails();
    }
}

// Remover detalle del movimiento
function removeMovementDetail(index) {
    if (index >= 0 && index < movementDetails.length) {
        movementDetails.splice(index, 1);
        renderMovementDetails();
    }
}

// Guardar movimiento
async function saveMovement() {
    const type = document.getElementById('movement-type').value;
    const date = document.getElementById('movement-date').value;
    const documentNumber = document.getElementById('movement-document').value;
    const description = document.getElementById('movement-description').value;
    
    let clientId, costCenterId;
    
    if (type === 'ENTRADA') {
        clientId = document.getElementById('movement-client').value;
        if (!clientId) {
            showAlert('Por favor, seleccione un proveedor', 'warning');
            return;
        }
    } else {
        costCenterId = document.getElementById('movement-cost-center').value;
        if (!costCenterId) {
            showAlert('Por favor, seleccione un centro de costo', 'warning');
            return;
        }
    }
    
    if (movementDetails.length === 0) {
        showAlert('Por favor, agregue al menos un producto', 'warning');
        return;
    }
    
    // Validar stock para salidas
    if (type === 'SALIDA') {
        for (const detail of movementDetails) {
            if (detail.quantity > (detail.product?.stock || 0)) {
                showAlert(`Stock insuficiente para ${detail.product?.name || 'N/A'}. Stock actual: ${detail.product?.stock || 0}`, 'error');
                return;
            }
        }
    }
    
    const movementData = {
        type: type,
        date: date,
        documentNumber: documentNumber || undefined,
        description: description || undefined,
        clientId: clientId ? parseInt(clientId) : undefined,
        costCenterId: costCenterId ? parseInt(costCenterId) : undefined,
        currencyCode: type === 'ENTRADA' ? (document.getElementById('movement-currency')?.value || 'USD') : undefined,
        details: movementDetails.map(detail => ({
            productId: detail.productId,
            quantity: parseFloat(detail.quantity) || 0,
            unitCost: parseFloat(detail.unitCost) || 0
        }))
    };
    
    try {
        console.log('saveMovement: enviando', movementData);

        const response = await apiRequest('/movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movementData)
        });

        console.log('saveMovement: respuesta', response);

        // Validar respuesta si la API devuelve un objeto con status/error en lugar de lanzar
        if (!response) {
            throw new Error('No hubo respuesta del servidor');
        }
        if (response.status && response.status >= 400) {
            const msg = response.message || response.error || `Error del servidor: ${response.status}`;
            throw new Error(msg);
        }
        if (response.error) {
            throw new Error(response.error || 'Error desconocido al guardar el movimiento');
        }

        showAlert('Movimiento guardado exitosamente', 'success');

        // Proteger las llamadas que pueden fallar o no existir en algunos entornos
        try {
            if (typeof closeModal === 'function') {
                // Si la función soporta id, pasar el id del modal; si no, se ignorará.
                try { closeModal('movement-modal'); } catch (e) { closeModal(); }
            } else {
                const movementModal = document.getElementById('movement-modal');
                if (movementModal) {
                    movementModal.classList.remove('active');
                    movementModal.style.display = 'none';
                }
            }
        } catch (e) {
            console.warn('saveMovement: error al cerrar modal', e);
        }

        try {
            loadMovements(1);
        } catch (e) {
            console.warn('saveMovement: loadMovements falló', e);
        }

        try {
            if (typeof loadDashboard === 'function') loadDashboard();
        } catch (e) {
            console.warn('saveMovement: loadDashboard falló', e);
        }

    } catch (error) {
        console.error('Error saving movement:', error);
        showAlert(error.message || 'Error al guardar el movimiento', 'error');
    }
}

// Ver movimiento
async function viewMovement(id) {
    try {
        const movement = await apiRequest(`/movements/${id}`);
        
        // Aquí se puede implementar una vista detallada del movimiento
        alert(`Vista detallada del movimiento ${id}`);
        
    } catch (error) {
        showAlert('Error al cargar el movimiento', 'error');
    }
}

// Imprimir voucher
async function printVoucher(id) {
    try {
        const voucher = await apiRequest(`/movements/${id}/voucher`);
        
        // Crear contenido HTML para el voucher
        const voucherContent = createVoucherHTML(voucher);
        
        // Crear ventana de impresión
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Voucher ${voucher.type === 'ENTRADA' ? 'Entrada' : 'Salida'} - ${voucher.id}</title>
                    <link rel="stylesheet" href="css/print.css">
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20mm; }
                        .voucher-header { text-align: center; margin-bottom: 20px; }
                        .company-logo { max-width: 150px; max-height: 100px; }
                        .voucher-details { margin: 20px 0; }
                        .voucher-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        .voucher-table th, .voucher-table td { border: 1px solid #000; padding: 8px; }
                        .total-row { font-weight: bold; font-size: 14pt; }
                        .signature { margin-top: 50px; }
                    </style>
                </head>
                <body>
                    ${voucherContent}
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
        
    } catch (error) {
        showAlert('Error al generar el voucher', 'error');
    }
}

// Crear HTML del voucher
function createVoucherHTML(voucher) {
    const typeText = voucher.type === 'ENTRADA' ? 'ENTRADA DE PRODUCTOS' : 'SALIDA DE PRODUCTOS';
    const entity = voucher.type === 'ENTRADA' ? 'Proveedor' : 'Centro de Costo';
    const entityName = voucher.type === 'ENTRADA' 
        ? (voucher.client?.name || 'N/A')
        : (voucher.costCenter?.name || 'N/A');
    
    const total = (voucher.details || []).reduce((sum, detail) => sum + (parseNumberSafe(detail.totalCost) || 0), 0);
    
    return `
        <div class="voucher-header">
            <h1>${typeText}</h1>
            <div class="voucher-info">
                <p><strong>Número:</strong> ${voucher.id}</p>
                <p><strong>Fecha:</strong> ${formatDate(voucher.date)}</p>
                ${voucher.documentNumber ? `<p><strong>Documento:</strong> ${voucher.documentNumber}</p>` : ''}
            </div>
        </div>
        
        <div class="voucher-details">
            <p><strong>${entity}:</strong> ${entityName}</p>
            ${voucher.description ? `<p><strong>Descripción:</strong> ${voucher.description}</p>` : ''}
            <p><strong>Responsable:</strong> ${voucher.user?.name || 'N/A'}</p>
        </div>
        
        <table class="voucher-table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                    <th>Costo Unit.</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${(voucher.details || []).map(detail => `
                    <tr>
                        <td>${detail.code || ''}</td>
                        <td>${detail.product?.name || detail.product || ''}</td>
                        <td>${formatUnit(detail.unit)}</td>
                        <td>${formatNumber(detail.quantity || 0)}</td>
                        <td>${formatCurrency(Number(detail.unitCost) || 0)}</td>
                        <td>${formatCurrency(detail.totalCost)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="5" class="text-right">TOTAL:</td>
                    <td>${formatCurrency(total)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="signature">
            <p>_________________________</p>
            <p>Firma del Responsable</p>
        </div>
    `;
}

// Cargar movimientos recientes para el dashboard
async function loadRecentMovements() {
    try {
        const response = await apiRequest('/movements?page=1&limit=5');
        
        const tbody = document.getElementById('recent-movements').querySelector('tbody');
        tbody.innerHTML = '';
        
        if (response.data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="6" class="text-center">
                    No hay movimientos recientes
                </td>
            `;
            tbody.appendChild(row);
            return;
        }
        
        // Normalizar detalles numéricos y debuggeo para detectar valores no numéricos
        response.data = (response.data || []).map(m => {
            if (m.details && Array.isArray(m.details)) {
                m.details = m.details.map(d => ({
                    ...d,
                    quantity: parseNumberSafe(d.quantity),
                    unitCost: parseNumberSafe(d.unitCost),
                    totalCost: parseNumberSafe(d.totalCost)
                }));
            }
            return m;
        });

        // Debug: log primer movimiento para inspección si hay problemas reportados
        if (response.data && response.data.length > 0) {
            const sample = response.data[0];
            console.debug('loadRecentMovements sample movement:', sample.id, sample.details && sample.details.map(d => ({quantity: d.quantity, unitCost: d.unitCost, totalCost: d.totalCost}))); 
        }

        response.data.forEach(movement => {
            const row = document.createElement('tr');
            
            let entity = '';
            if (movement.client) {
                entity = movement.client.name;
            } else if (movement.costCenter) {
                entity = movement.costCenter.name;
            }
            
            const total = (movement.details || []).reduce((sum, detail) => sum + (parseNumberSafe(detail.totalCost) || 0), 0);
            
            row.innerHTML = `
                <td>${formatDate(movement.date)}</td>
                <td>
                    <span class="status-badge ${movement.type === 'ENTRADA' ? 'status-active' : 'status-inactive'}">
                        ${movement.type === 'ENTRADA' ? 'Entrada' : 'Salida'}
                    </span>
                </td>
                <td>${movement.documentNumber || 'N/A'}</td>
                <td>${entity}</td>
                <td>${formatCurrency(total)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewMovement(${movement.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading recent movements:', error);
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('movements-table')) {
        loadMovements();
    }
});
