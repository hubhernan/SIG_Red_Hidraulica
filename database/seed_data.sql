-- ===================================================================================
-- SIG Red Hidráulica - Datos Semilla para Catálogos
-- ===================================================================================

-- Insertar materiales comunes para tuberías y tomas
INSERT INTO cat_material_tuberia (nombre) VALUES 
('PVC (Policloruro de Vinilo)'),
('HDP (Polietileno de Alta Densidad)'),
('Manguera Negra (Polietileno)'),
('Galvanizado'),
('Cobre'),
('Asbesto-Cemento');

-- Insertar tipos de infraestructura (Válvulas y Nodos)
INSERT INTO cat_tipo_valvula (nombre) VALUES 
('Válvula de Seccionamiento'),
('Válvula Reductora de Presión'),
('Válvula de Expulsión de Aire'),
('Hidrante'),
('Tanque de Almacenamiento'),
('Caja de Registro'),
('Bomba / Rebombeo');

-- Insertar algunos sectores de ejemplo (Pedregalito)
INSERT INTO admin_sectores (nombre, descripcion) VALUES 
('Sector 1 - Zona Alta', 'Zona de mayor presión cerca del tanque principal'),
('Sector 2 - Zona Centro', 'Área densamente poblada'),
('Sector 3 - Zona Baja', 'Límite con la carretera principal');
