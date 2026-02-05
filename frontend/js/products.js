let products = [];
let currentProductPage = 1;
let totalProductPages = 1;

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
        s = s.replace(/\\./g, '').replace(',', '.');
    } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

// Cargar productos
async function loadProducts(page = 1, search = '', filter = 'all') {
    try {
        showLoading('products-table');
        
        const response = await apiRequest(`/products?page=${page}&limit=10&search=${search}`);
        
        products = response.data;
        currentProductPage = response.meta.page;
        totalProductPages = response.meta.totalPages;
        
        renderProductsTable();
        createPagination('products-pagination', currentProductPage, totalProductPages, loadProducts);
        
    } catch (error) {
        console.error('Error loading products:', error);
    } finally {
        hideLoading();
    }
}

// Renderizar tabla de productos
function renderProductsTable() {
    const tbody = document.getElementById('products-table').querySelector('tbody');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="9" class="text-center">
                No se encontraron productos
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    products.forEach(product => {
        const row = document.createElement('tr');
        const stock = parseNumberSafe(product.stock);
        const minStock = parseNumberSafe(product.minStock);
        const unitCost = parseNumberSafe(product.unitCost);
        const totalValue = stock * unitCost;
        const isLowStock = stock <= minStock;
        
        row.innerHTML = `
            <td>${product.code}</td>
            <td>
                <strong>${product.name}</strong>
                ${product.description ? `<br><small class="text-muted">${product.description}</small>` : ''}
            </td>
            <td>${formatUnit(product.unit)}</td>
            <td>
                ${formatNumber(stock)}
                ${isLowStock ? '<i class="fas fa-exclamation-triangle text-danger ml-1"></i>' : ''}
            </td>
            <td>${formatNumber(minStock)}</td>
            <td>${formatCurrency(unitCost)}</td>
            <td>${formatCurrency(totalValue)}</td>
            <td>
                <span class="status-badge ${product.isActive ? 'status-active' : 'status-inactive'}">
                    ${product.isActive ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="editProduct(${product.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="deleteProduct(${product.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="viewProductHistory(${product.id})" title="Historial">
                    <i class="fas fa-history"></i>
                </button>
            </td>
        `;
        
        if (isLowStock) {
            row.classList.add('table-danger');
        }
        
        tbody.appendChild(row);
    });
}

// Formatear unidad
function formatUnit(unit) {
    const units = {
        'UNIDAD': 'Unidad',
        'KILOGRAMO': 'Kg',
        'GRAMO': 'g',
        'LIBRA': 'lb',
        'ONZA': 'oz',
        'LITRO': 'L',
        'MILILITRO': 'mL',
        'GALON': 'gal',
        'CAJA': 'Caja',
        'POMO': 'Pomo',
        'PAR': 'Par',
        'METRO': 'm',
        'CENTIMETRO': 'cm'
    };
    return units[unit] || unit;
}

// Buscar productos
function searchProducts() {
    const search = document.getElementById('product-search').value;
    loadProducts(1, search);
}

// Filtrar productos
function filterProducts() {
    const filter = document.getElementById('product-filter').value;
    // Implementar filtrado según necesidad
    console.log('Filter:', filter);
}

// Mostrar modal para agregar producto
function showAddProductModal() {
    resetForm('product-form');
    document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
    document.getElementById('product-id').value = '';
    showModal('product-modal');
}

// Editar producto
async function editProduct(id) {
    try {
        const product = await apiRequest(`/products/${id}`);
        
        document.getElementById('product-modal-title').textContent = 'Editar Producto';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-code').value = product.code;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-unit').value = product.unit;
        document.getElementById('product-unit-cost').value = product.unitCost;
        document.getElementById('product-min-stock').value = product.minStock;
        document.getElementById('product-max-stock').value = product.maxStock || '';
        document.getElementById('product-active').checked = product.isActive;
        
        showModal('product-modal');
    } catch (error) {
        showAlert('Error al cargar el producto', 'error');
    }
}

// Guardar producto
async function saveProduct() {
    if (!validateForm('product-form')) {
        showAlert('Por favor, complete los campos requeridos', 'warning');
        return;
    }
    
    const productData = {
        code: document.getElementById('product-code').value,
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        unit: document.getElementById('product-unit').value,
        unitCost: parseFloat(document.getElementById('product-unit-cost').value),
        minStock: parseFloat(document.getElementById('product-min-stock').value),
        isActive: document.getElementById('product-active').checked
    };
    
    const maxStock = document.getElementById('product-max-stock').value;
    if (maxStock) {
        productData.maxStock = parseFloat(maxStock);
    }
    
    const productId = document.getElementById('product-id').value;
    
    try {
        if (productId) {
            // Actualizar producto existente
            await apiRequest(`/products/${productId}`, {
                method: 'PATCH',
                body: JSON.stringify(productData)
            });
            showAlert('Producto actualizado exitosamente', 'success');
        } else {
            // Crear nuevo producto
            await apiRequest('/products', {
                method: 'POST',
                body: JSON.stringify(productData)
            });
            showAlert('Producto creado exitosamente', 'success');
        }
        
        closeModal();
        loadProducts(currentProductPage);
        
    } catch (error) {
        showAlert(error.message || 'Error al guardar el producto', 'error');
    }
}

// Eliminar producto (desactivar)
async function deleteProduct(id) {
    if (!confirm('¿Está seguro de que desea desactivar este producto?')) {
        return;
    }
    
    try {
        await apiRequest(`/products/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('Producto desactivado exitosamente', 'success');
        loadProducts(currentProductPage);
        
    } catch (error) {
        showAlert(error.message || 'Error al desactivar el producto', 'error');
    }
}

// Ver historial del producto
async function viewProductHistory(id) {
    try {
        // Implementar vista de historial
        showAlert('Funcionalidad en desarrollo', 'info');
    } catch (error) {
        showAlert('Error al cargar el historial', 'error');
    }
}

// Cargar productos bajo stock para el dashboard
async function loadLowStockProducts() {
    try {
        const response = await apiRequest('/products/low-stock');
        
        const container = document.getElementById('low-stock-list');
        container.innerHTML = '';
        
        if (response.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No hay productos bajo stock</p>';
            return;
        }
        
        response.forEach(product => {
            const item = document.createElement('div');
            item.className = 'low-stock-item';
            item.innerHTML = `
                <div>
                    <strong>${product.name}</strong><br>
                    <small>Código: ${product.code}</small>
                </div>
                <div class="text-right">
                    <span class="text-danger">${formatNumber(product.stock)} ${formatUnit(product.unit)}</span><br>
                    <small>Mínimo: ${formatNumber(product.minStock)}</small>
                </div>
            `;
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error loading low stock products:', error);
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('products-table')) {
        loadProducts();
    }
});
