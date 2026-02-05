let costCenters = [];
let currentCostCenterPage = 1;
let totalCostCenterPages = 1;

// Cargar centros de costo
async function loadCostCenters(page = 1, search = '') {
    try {
        showLoading('cost-centers-table');
        
        const response = await apiRequest(`/cost-centers?page=${page}&limit=10&search=${search}`);
        
        costCenters = response.data;
        currentCostCenterPage = response.meta.page;
        totalCostCenterPages = response.meta.totalPages;
        
        renderCostCentersTable();
        createPagination('cost-centers-pagination', currentCostCenterPage, totalCostCenterPages, 
            (newPage) => loadCostCenters(newPage, search));
        
    } catch (error) {
        console.error('Error loading cost centers:', error);
    } finally {
        hideLoading();
    }
}

// Renderizar tabla de centros de costo
function renderCostCentersTable() {
    const tbody = document.getElementById('cost-centers-table').querySelector('tbody');
    tbody.innerHTML = '';
    
    if (costCenters.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="5" class="text-center">
                No se encontraron centros de costo
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    costCenters.forEach(center => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${center.code}</td>
            <td>
                <strong>${center.name}</strong>
                ${center.description ? `<br><small>${center.description}</small>` : ''}
            </td>
            <td>${center.description || '-'}</td>
            <td>
                <span class="status-badge ${center.isActive ? 'status-active' : 'status-inactive'}">
                    ${center.isActive ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="editCostCenter(${center.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="deleteCostCenter(${center.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="viewCostCenterMovements(${center.id})" title="Movimientos">
                    <i class="fas fa-exchange-alt"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Buscar centros de costo
function searchCostCenters() {
    const search = document.getElementById('cost-center-search').value;
    loadCostCenters(1, search);
}

// Mostrar modal para agregar centro de costo
function showAddCostCenterModal() {
    resetForm('cost-center-form');
    document.getElementById('cost-center-modal-title').textContent = 'Nuevo Centro de Costo';
    document.getElementById('cost-center-id').value = '';
    showModal('cost-center-modal');
}

// Editar centro de costo
async function editCostCenter(id) {
    try {
        const center = await apiRequest(`/cost-centers/${id}`);
        
        document.getElementById('cost-center-modal-title').textContent = 'Editar Centro de Costo';
        document.getElementById('cost-center-id').value = center.id;
        document.getElementById('cost-center-code').value = center.code;
        document.getElementById('cost-center-name').value = center.name;
        document.getElementById('cost-center-description').value = center.description || '';
        document.getElementById('cost-center-active').checked = center.isActive;
        
        showModal('cost-center-modal');
    } catch (error) {
        showAlert('Error al cargar el centro de costo', 'error');
    }
}

// Guardar centro de costo
async function saveCostCenter() {
    if (!validateForm('cost-center-form')) {
        showAlert('Por favor, complete los campos requeridos', 'warning');
        return;
    }
    
    const centerData = {
        code: document.getElementById('cost-center-code').value,
        name: document.getElementById('cost-center-name').value,
        description: document.getElementById('cost-center-description').value || undefined,
        isActive: document.getElementById('cost-center-active').checked
    };
    
    const centerId = document.getElementById('cost-center-id').value;
    
    try {
        if (centerId) {
            // Actualizar centro de costo existente
            await apiRequest(`/cost-centers/${centerId}`, {
                method: 'PATCH',
                body: JSON.stringify(centerData)
            });
            showAlert('Centro de costo actualizado exitosamente', 'success');
        } else {
            // Crear nuevo centro de costo
            await apiRequest('/cost-centers', {
                method: 'POST',
                body: JSON.stringify(centerData)
            });
            showAlert('Centro de costo creado exitosamente', 'success');
        }
        
        closeModal();
        loadCostCenters(currentCostCenterPage);
        
    } catch (error) {
        showAlert(error.message || 'Error al guardar el centro de costo', 'error');
    }
}

// Eliminar centro de costo (desactivar)
async function deleteCostCenter(id) {
    if (!confirm('¿Está seguro de que desea desactivar este centro de costo?')) {
        return;
    }
    
    try {
        await apiRequest(`/cost-centers/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('Centro de costo desactivado exitosamente', 'success');
        loadCostCenters(currentCostCenterPage);
        
    } catch (error) {
        showAlert(error.message || 'Error al desactivar el centro de costo', 'error');
    }
}

// Ver movimientos del centro de costo
async function viewCostCenterMovements(id) {
    try {
        const center = await apiRequest(`/cost-centers/${id}`);
        const movements = await apiRequest(`/cost-centers/${id}/movements`);
        
        // Implementar vista de movimientos del centro de costo
        alert(`Movimientos del centro de costo: ${center.name}\nTotal: ${movements.length} movimientos`);
        
    } catch (error) {
        showAlert('Error al cargar los movimientos del centro de costo', 'error');
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('cost-centers-table')) {
        loadCostCenters();
    }
});