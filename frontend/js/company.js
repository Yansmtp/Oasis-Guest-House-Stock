// Cargar información de la empresa
async function loadCompanyInfo() {
    try {
        const company = await apiRequest('/company');
        
        document.getElementById('company-name').value = company.name || '';
        document.getElementById('company-tax-id').value = company.taxId || '';
        document.getElementById('company-address').value = company.address || '';
        document.getElementById('company-phone').value = company.phone || '';
        document.getElementById('company-email').value = company.email || '';
        document.getElementById('company-website').value = company.website || '';
        document.getElementById('company-low-stock').value = company.lowStockThreshold || 10;
        
        // Cargar logo si existe
        if (company.logo) {
            const logoImg = document.getElementById('company-logo');

            // Normalizar la URL del logo: si la API devuelve una ruta relativa, prefijarla con API_BASE_URL
            let logoUrl = company.logo;
            if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
                if (typeof API_BASE_URL !== 'undefined') {
                    logoUrl = API_BASE_URL.replace(/\/$/, '') + '/' + logoUrl.replace(/^\//, '');
                } else {
                    // Si API_BASE_URL no está definida, intentar con '/uploads' absoluto en servidor (cosa que fallará si el frontend corre en otro puerto)
                    logoUrl = logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl;
                }
            }

            logoImg.src = logoUrl;
            logoImg.style.display = 'block';
            document.getElementById('no-logo').style.display = 'none';
        } else {
            document.getElementById('company-logo').style.display = 'none';
            document.getElementById('no-logo').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading company info:', error);
        showAlert('Error al cargar la información de la empresa', 'error');
    }
}

// Guardar información de la empresa
async function saveCompanyInfo() {
    const companyId = 1; // Asumimos que solo hay una empresa
    
    const companyData = {
        name: document.getElementById('company-name').value || undefined,
        taxId: document.getElementById('company-tax-id').value || undefined,
        address: document.getElementById('company-address').value || undefined,
        phone: document.getElementById('company-phone').value || undefined,
        email: document.getElementById('company-email').value || undefined,
        website: document.getElementById('company-website').value || undefined,
        lowStockThreshold: parseFloat(document.getElementById('company-low-stock').value) || 10
    };
    
    try {
        await apiRequest(`/company/${companyId}`, {
            method: 'PUT',
            body: JSON.stringify(companyData)
        });
        
        showAlert('Información de la empresa actualizada exitosamente', 'success');
        
    } catch (error) {
        showAlert(error.message || 'Error al guardar la información de la empresa', 'error');
    }
}

// Subir logo de la empresa
async function uploadLogo() {
    const companyId = 1;
    const fileInput = document.getElementById('logo-file');

    if (!fileInput) {
        console.error('uploadLogo: elemento #logo-file no encontrado');
        showAlert('Elemento de archivo no encontrado', 'error');
        return;
    }

    const file = fileInput.files[0];

    if (!file) {
        showAlert('Por favor, seleccione un archivo', 'warning');
        return;
    }

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        showAlert('Solo se permiten archivos JPG, PNG o SVG', 'error');
        return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showAlert('El archivo no debe superar los 5MB', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
        // Validaciones básicas de entorno
        if (typeof API_BASE_URL === 'undefined') {
            throw new Error('API_BASE_URL no está definido en la aplicación');
        }

        const token = (typeof getToken === 'function') ? getToken() : null;
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        console.log('uploadLogo: enviando a', `${API_BASE_URL}/company/${companyId}/logo`, 'headers', !!token);

        let response = await fetch(`${API_BASE_URL}/company/${companyId}/logo`, {
            method: 'PUT',
            headers,
            body: formData
        });

        // Si el servidor rechaza PUT (405) o devuelve error, reintentar con POST
        if (!response.ok) {
            if (response.status === 405) {
                console.warn('PUT no soportado, reintentando con POST');
                response = await fetch(`${API_BASE_URL}/company/${companyId}/logo`, {
                    method: 'POST',
                    headers,
                    body: formData
                });
            }
        }

        if (!response.ok) {
            // Intentar leer cuerpo con detalle del error
            let errDetails = '';
            try {
                const errJson = await response.json();
                errDetails = errJson.message || errJson.error || JSON.stringify(errJson);
            } catch (e) {
                errDetails = await response.text();
            }
            throw new Error(`Error ${response.status}: ${response.statusText} - ${errDetails}`);
        }

        const result = await response.json();
        console.log('uploadLogo: respuesta', result);

        // Resolver URL del logo (soporta rutas relativas devueltas por la API)
        let logoPath = result.logo || result.path || result.filename || null;
        if (logoPath) {
            // Construir candidatos de ruta para intentar (en orden)
            const candidates = [];

            if (/^https?:\/\//i.test(logoPath)) {
                // URL absoluta
                candidates.push(logoPath);
            } else {
                // Ruta tal como la devuelve la API
                candidates.push(logoPath);
                // Prefijar con API_BASE_URL
                candidates.push(API_BASE_URL.replace(/\/$/, '') + '/' + logoPath.replace(/^\//, ''));
                // Prefijar con API_BASE_URL + '/api' (por si la API monta estáticos en /api)
                candidates.push(API_BASE_URL.replace(/\/$/, '') + '/api/' + logoPath.replace(/^\//, ''));
                // Intentar con /api/ (sin host) (útil para proxys locales)
                candidates.push('/api/' + logoPath.replace(/^\//, ''));
                // Intentar con / (ruta relativa a raíz)
                candidates.push('/' + logoPath.replace(/^\//, ''));
            }

            const logoImg = document.getElementById('company-logo');
            if (logoImg) {
                let attempt = 0;
                function tryNext() {
                    if (attempt >= candidates.length) {
                        console.warn('uploadLogo: no se pudo cargar el logo con ninguna ruta', candidates);
                        showAlert('El logo fue subido pero no se pudo cargar la imagen (404). Revisa la ruta en el servidor.', 'warning');
                        return;
                    }
                    const src = candidates[attempt++];
                    console.log('uploadLogo: intentando logo:', src);

                    // Colocar handlers temporales
                    logoImg.onerror = function() {
                        console.warn('uploadLogo: fallo al cargar', src);
                        tryNext();
                    };
                    logoImg.onload = function() {
                        console.log('uploadLogo: logo cargado con éxito', src);
                        logoImg.style.display = 'block';
                        const noLogoEl = document.getElementById('no-logo');
                        if (noLogoEl) noLogoEl.style.display = 'none';
                        // Limpiar handlers
                        logoImg.onerror = null;
                        logoImg.onload = null;
                    };

                    // Asignar src para iniciar la carga
                    logoImg.src = src;
                }

                tryNext();
            }
        } else {
            console.warn('uploadLogo: la API no devolvió una URL de logo', result);
        }

        showAlert('Logo actualizado exitosamente', 'success');

        // Limpiar input de archivo
        fileInput.value = '';

    } catch (error) {
        console.error('Error uploading logo:', error);
        showAlert(error.message || 'Error al subir el logo', 'error');
    }
}

// Cargar monedas y tasas
async function loadCurrencySettings() {
    try {
        const response = await apiRequest('/currencies');
        const list = response?.data || [];

        const select = document.getElementById('currency-code');
        const rateInput = document.getElementById('currency-rate');
        const effectiveEl = document.getElementById('currency-effective');

        if (!select || !rateInput) return;

        select.innerHTML = '';
        list.forEach(c => {
            const option = document.createElement('option');
            option.value = c.code;
            option.textContent = `${c.code} - ${c.name}`;
            if (c.isDefault) option.selected = true;
            select.appendChild(option);
        });

        function updateRateDisplay(code) {
            const entry = list.find(c => c.code === code);
            const rate = entry?.rate || (code === 'USD' ? 1 : 1);
            const displayRate = rate > 0 ? (1 / rate) : 0;
            rateInput.value = displayRate ? displayRate.toFixed(4) : '';

            if (effectiveEl) {
                if (entry?.effectiveFrom) {
                    effectiveEl.textContent = `Vigente desde: ${new Date(entry.effectiveFrom).toLocaleString()}`;
                } else {
                    effectiveEl.textContent = '';
                }
            }
        }

        updateRateDisplay(select.value);
        select.onchange = () => updateRateDisplay(select.value);
    } catch (error) {
        console.error('Error loading currencies:', error);
        showAlert('Error al cargar monedas', 'error');
    }
}

async function saveCurrencyRate() {
    const select = document.getElementById('currency-code');
    const rateInput = document.getElementById('currency-rate');

    if (!select || !rateInput) return;

    const code = select.value;
    const inputRate = parseFloat(rateInput.value);

    if (!inputRate || inputRate <= 0) {
        showAlert('La tasa debe ser mayor que 0', 'warning');
        return;
    }

    // Convert from "1 USD = X currency" to "USD per 1 currency"
    const normalizedRate = code === 'USD' ? 1 : (1 / inputRate);

    try {
        await apiRequest(`/currencies/${code}`, {
            method: 'PATCH',
            body: JSON.stringify({ rate: normalizedRate })
        });

        showAlert('Tasa actualizada exitosamente', 'success');
        await loadCurrencySettings();
    } catch (error) {
        console.error('Error saving currency rate:', error);
        showAlert(error.message || 'Error al actualizar la tasa', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('company-form')) {
        loadCompanyInfo();
        loadCurrencySettings();
        
        // Formulario de información de la empresa
        document.getElementById('company-form').addEventListener('submit', (e) => {
            e.preventDefault();
            saveCompanyInfo();
        });
        
        // Formulario de logo
        document.getElementById('logo-form').addEventListener('submit', (e) => {
            e.preventDefault();
            uploadLogo();
        });

        const currencyForm = document.getElementById('currency-form');
        if (currencyForm) {
            currencyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveCurrencyRate();
            });
        }

        const backupBtn = document.getElementById('maintenance-backup-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', async () => {
                try {
                    backupBtn.disabled = true;
                    await apiRequest('/maintenance/backup', { method: 'POST' });
                    showAlert('Backup creado exitosamente', 'success');
                } catch (error) {
                    showAlert(error.message || 'Error al crear backup', 'error');
                } finally {
                    backupBtn.disabled = false;
                }
            });
        }

        const resetBtn = document.getElementById('maintenance-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const ok = confirm('Esto borrará todos los datos. ¿Desea continuar?');
                if (!ok) return;
                const confirmText = prompt('Escriba RESET para confirmar:');
                if (confirmText !== 'RESET') {
                    showAlert('Confirmación incorrecta. Operación cancelada.', 'warning');
                    return;
                }
                try {
                    resetBtn.disabled = true;
                    const res = await apiRequest('/maintenance/reset', {
                        method: 'POST',
                        body: JSON.stringify({ confirm: 'RESET' })
                    });
                    if (res?.ok === false) {
                        throw new Error(res.message || 'Confirmación requerida');
                    }
                    showAlert('Base de datos restablecida. Se recomienda reiniciar el backend.', 'success');
                } catch (error) {
                    showAlert(error.message || 'Error al restablecer', 'error');
                } finally {
                    resetBtn.disabled = false;
                }
            });
        }
    }
});
