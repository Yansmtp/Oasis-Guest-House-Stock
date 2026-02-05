// Funciones administrativas

async function showAdminModule() {
    setActiveMenu('admin');
    
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="fas fa-shield-alt me-2"></i>Panel Administrativo</h2>
        </div>
        
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>ADVERTENCIA:</strong> Estas acciones pueden eliminar datos permanentemente.
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header bg-danger text-white">
                        <h5 class="mb-0"><i class="fas fa-trash-alt me-2"></i>Eliminar Datos</h5>
                    </div>
                    <div class="card-body">
                        <p>Elimina todos los datos del sistema excepto la configuración de la empresa.</p>
                        
                        <div class="mb-3">
                            <label for="adminPassword" class="form-label">Contraseña Administrativa</label>
                            <input type="password" class="form-control" id="adminPassword" 
                                   placeholder="Ingrese 'admin123' para confirmar">
                        </div>
                        
                        <button class="btn btn-danger" onclick="confirmDataDeletion()">
                            <i class="fas fa-trash-alt me-2"></i>Eliminar Todos los Datos
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header bg-warning text-dark">
                        <h5 class="mb-0"><i class="fas fa-redo me-2"></i>Restablecer Stock</h5>
                    </div>
                    <div class="card-body">
                        <p>Restablece el stock de todos los productos a cero.</p>
                        
                        <div class="mb-3">
                            <label for="stockPassword" class="form-label">Contraseña Administrativa</label>
                            <input type="password" class="form-control" id="stockPassword" 
                                   placeholder="Ingrese 'admin123' para confirmar">
                        </div>
                        
                        <button class="btn btn-warning" onclick="confirmStockReset()">
                            <i class="fas fa-redo me-2"></i>Restablecer Stock
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0"><i class="fas fa-key me-2"></i>Cambiar Contraseña</h5>
            </div>
            <div class="card-body">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Para cambiar la contraseña administrativa, modifique el archivo <code>auth.service.ts</code> en el backend.
                </div>
                
                <div class="card">
                    <div class="card-body bg-light">
                        <h6>Credenciales actuales:</h6>
                        <p><strong>Email:</strong> admin@casarenta.com</p>
                        <p><strong>Contraseña:</strong> admin123</p>
                        <small class="text-muted">Cambie estas credenciales en producción</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function confirmDataDeletion() {
    const password = document.getElementById('adminPassword').value;
    const adminPassword = 'admin123';
    
    if (password !== adminPassword) {
        showAlert('Contraseña incorrecta', 'danger');
        return;
    }
    
    if (confirm('¿ESTÁ SEGURO? Esta acción eliminará TODOS los datos excepto la configuración de la empresa. Esta acción NO se puede deshacer.')) {
        deleteAllData();
    }
}

function confirmStockReset() {
    const password = document.getElementById('stockPassword').value;
    const adminPassword = 'admin123';
    
    if (password !== adminPassword) {
        showAlert('Contraseña incorrecta', 'danger');
        return;
    }
    
    if (confirm('¿Restablecer el stock de todos los productos a cero?')) {
        resetStock();
    }
}

async function deleteAllData() {
    try {
        showAlert('Eliminando datos...', 'info');
        
        // Obtener y eliminar movimientos
        const movements = await fetchWithAuth('/movements');
        for (const movement of movements) {
            await fetchWithAuth(`/movements/${movement.id}`, { method: 'DELETE' });
        }
        
        // Obtener y eliminar productos
        const products = await fetchWithAuth('/products');
        for (const product of products) {
            await fetchWithAuth(`/products/${product.id}`, { method: 'DELETE' });
        }
        
        // Obtener y eliminar clientes
        const clients = await fetchWithAuth('/clients');
        for (const client of clients) {
            await fetchWithAuth(`/clients/${client.id}`, { method: 'DELETE' });
        }
        
        // Obtener y eliminar centros de costo
        const costCenters = await fetchWithAuth('/cost-centers');
        for (const center of costCenters) {
            await fetchWithAuth(`/cost-centers/${center.id}`, { method: 'DELETE' });
        }
        
        showAlert('Datos eliminados correctamente', 'success');
        setTimeout(() => {
            showSection('dashboard');
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting data:', error);
        showAlert('Error al eliminar datos', 'danger');
    }
}

async function resetStock() {
    try {
        showAlert('Restableciendo stock...', 'info');
        
        const products = await fetchWithAuth('/products');
        
        for (const product of products) {
            await fetchWithAuth(`/products/${product.id}`, {
                method: 'PUT',
                body: JSON.stringify({ currentStock: 0 })
            });
        }
        
        showAlert('Stock restablecido correctamente', 'success');
        setTimeout(() => {
            showSection('dashboard');
        }, 2000);
        
    } catch (error) {
        console.error('Error resetting stock:', error);
        showAlert('Error al restablecer stock', 'danger');
    }
}

// Exportar función para uso global
window.showAdminModule = showAdminModule;
window.confirmDataDeletion = confirmDataDeletion;
window.confirmStockReset = confirmStockReset;