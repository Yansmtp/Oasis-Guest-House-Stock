-- Script de configuración inicial para PostgreSQL

-- Crear base de datos
CREATE DATABASE inventario_casa_renta
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Spanish_Spain.1252'
    LC_CTYPE = 'Spanish_Spain.1252'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Conectar a la base de datos
\c inventario_casa_renta;

-- Crear extensión para UUID si es necesario
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear usuario administrador (ajusta la contraseña)
CREATE USER inventario_admin WITH PASSWORD 'admin123';
GRANT ALL PRIVILEGES ON DATABASE inventario_casa_renta TO inventario_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO inventario_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO inventario_admin;

-- Nota: Las tablas se crearán automáticamente con Prisma Migrate
-- Ejecuta: npx prisma migrate dev

-- Insertar datos iniciales (opcional)
INSERT INTO "User" (email, name, password, role) VALUES 
('admin@casarenta.com', 'Administrador', '$2b$10$YourHashedPasswordHere', 'ADMIN');

INSERT INTO "Company" (name, lowStockThreshold) VALUES 
('Casa de Renta S.A.', 10);

-- Datos de ejemplo para pruebas
INSERT INTO "Product" (code, name, unit, unitCost, stock, minStock) VALUES
('PROD-001', 'Cemento 50kg', 'KILOGRAMO', 15.50, 100, 20),
('PROD-002', 'Pintura Blanca 1L', 'LITRO', 8.75, 50, 10),
('PROD-003', 'Ladrillo', 'UNIDAD', 0.85, 1000, 200),
('PROD-004', 'Arena Fina', 'KILOGRAMO', 0.25, 5000, 1000),
('PROD-005', 'Tubería PVC 1/2"', 'METRO', 1.20, 200, 50);

INSERT INTO "Client" (code, name, email, phone, taxId) VALUES
('CLI-001', 'Constructora XYZ', 'contacto@xyz.com', '555-1234', '12345678901'),
('CLI-002', 'Arquitectos Asociados', 'info@arquitectos.com', '555-5678', '98765432109'),
('CLI-003', 'Ingeniería Civil SAC', 'ventas@ingcivil.com', '555-9012', '45678912304');

INSERT INTO "CostCenter" (code, name, description) VALUES
('CC-001', 'Obra Principal', 'Edificio principal de la casa renta'),
('CC-002', 'Mantenimiento', 'Departamento de mantenimiento general'),
('CC-003', 'Administración', 'Oficinas administrativas'),
('CC-004', 'Jardinería', 'Áreas verdes y jardines');

-- Verificar datos
SELECT 'Productos:' as tipo, COUNT(*) as cantidad FROM "Product"
UNION ALL
SELECT 'Clientes:', COUNT(*) FROM "Client"
UNION ALL
SELECT 'Centros de Costo:', COUNT(*) FROM "CostCenter"
UNION ALL
SELECT 'Empresa:', COUNT(*) FROM "Company";

-- Consejos para producción:
-- 1. Cambia todas las contraseñas por unas seguras
-- 2. Configura SSL para la base de datos
-- 3. Establece backups regulares
-- 4. Configura índices según tus patrones de consulta
-- 5. Considera particionar tablas grandes