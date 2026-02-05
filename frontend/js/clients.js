let clients = [];
let currentClientPage = 1;
let totalClientPages = 1;

// Cargar clientes
async function loadClients(page = 1, search = '') {
    try {
        showLoading('clients-table');
        
        const response = await apiRequest(`/clients?page=${page}&limit=10&search=${search}`);
        
        clients = response.data;
        currentClientPage = response.meta.page;
        totalClientPages = response.meta.totalPages;
        
        renderClientsTable();
        createPagination('clients-pagination', currentClientPage, totalClientPages, 
            (newPage) => loadClients(newPage, search));
        
    } catch (error) {
        console.error('Error loading clients:', error);
    } finally {
        hideLoading();
    }
}

// Renderizar tabla de clientes
function renderClientsTable() {
    const tbody = document.getElementById('clients-table').querySelector('tbody');
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" class="text-center">
                No se encontraron clientes
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${client.code}</td>
            <td>
                <strong>${client.name}</strong>
                ${client.address ? `<br><small>${client.address}</small>` : ''}
            </td>
            <td>${client.email || '-'}</td>
            <td>${client.phone || '-'}</td>
            <td>${client.taxId || '-'}</td>
            <td>
                <span class="status-badge ${client.isActive ? 'status-active' : 'status-inactive'}">
                    ${client.isActive ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="editClient(${client.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="deleteClient(${client.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-sm btn-outline" onclick="viewClientMovements(${client.id})" title="Movimientos">
                    <i class="fas fa-exchange-alt"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Buscar clientes
function searchClients() {
    const search = document.getElementById('client-search').value;
    loadClients(1, search);
}

// Mostrar modal para agregar cliente
function showAddClientModal() {
    resetForm('client-form');
    document.getElementById('client-modal-title').textContent = 'Nuevo Cliente';
    document.getElementById('client-id').value = '';
    showModal('client-modal');
}

// Editar cliente
async function editClient(id) {
    try {
        const client = await apiRequest(`/clients/${id}`);
        
        document.getElementById('client-modal-title').textContent = 'Editar Cliente';
        document.getElementById('client-id').value = client.id;
        document.getElementById('client-code').value = client.code;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-email').value = client.email || '';
        document.getElementById('client-phone').value = client.phone || '';
        document.getElementById('client-address').value = client.address || '';
        document.getElementById('client-tax-id').value = client.taxId || '';
        document.getElementById('client-active').checked = client.isActive;
        
        showModal('client-modal');
    } catch (error) {
        showAlert('Error al cargar el cliente', 'error');
    }
}

// Guardar cliente
async function saveClient() {
    if (!validateForm('client-form')) {
        showAlert('Por favor, complete los campos requeridos', 'warning');
        return;
    }
    
    const clientData = {
        code: document.getElementById('client-code').value,
        name: document.getElementById('client-name').value,
        email: document.getElementById('client-email').value || undefined,
        phone: document.getElementById('client-phone').value || undefined,
        address: document.getElementById('client-address').value || undefined,
        taxId: document.getElementById('client-tax-id').value || undefined,
        isActive: document.getElementById('client-active').checked
    };
    
    const clientId = document.getElementById('client-id').value;
    
    try {
        if (clientId) {
            // Actualizar cliente existente
            await apiRequest(`/clients/${clientId}`, {
                method: 'PATCH',
                body: JSON.stringify(clientData)
            });
            showAlert('Cliente actualizado exitosamente', 'success');
        } else {
            // Crear nuevo cliente
            await apiRequest('/clients', {
                method: 'POST',
                body: JSON.stringify(clientData)
            });
            showAlert('Cliente creado exitosamente', 'success');
        }
        
        closeModal();
        loadClients(currentClientPage);
        
    } catch (error) {
        showAlert(error.message || 'Error al guardar el cliente', 'error');
    }
}

// Eliminar cliente (desactivar)
async function deleteClient(id) {
    if (!confirm('¿Está seguro de que desea desactivar este cliente?')) {
        return;
    }
    
    try {
        await apiRequest(`/clients/${id}`, {
            method: 'DELETE'
        });
        
        showAlert('Cliente desactivado exitosamente', 'success');
        loadClients(currentClientPage);
        
    } catch (error) {
        showAlert(error.message || 'Error al desactivar el cliente', 'error');
    }
}

// Ver movimientos del cliente
async function viewClientMovements(id) {
    try {
        const client = await apiRequest(`/clients/${id}`);
        const movements = await apiRequest(`/clients/${id}/movements`);
        
        // Implementar vista de movimientos del cliente
        alert(`Movimientos del cliente: ${client.name}\nTotal: ${movements.length} movimientos`);
        
    } catch (error) {
        showAlert('Error al cargar los movimientos del cliente', 'error');
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('clients-table')) {
        loadClients();
    }
});