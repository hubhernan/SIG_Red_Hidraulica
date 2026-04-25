-- ===================================================================================
-- SIG Red Hidráulica - Pedregal de Guadalupe Hidalgo (Pedregalito), Ocoyoacac
-- Script de Creación de Base de Datos Espacial (PostgreSQL + PostGIS)
-- ===================================================================================

-- Habilitar extensión espacial
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. CAPAS ADMINISTRATIVAS (Polígonos)
-- ==========================================
CREATE TABLE admin_estado (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE admin_municipio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL, -- Ocoyoacac
    estado_id INTEGER REFERENCES admin_estado(id),
    geom GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE admin_colonia (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL, -- Pedregal de Guadalupe Hidalgo
    municipio_id INTEGER REFERENCES admin_municipio(id),
    geom GEOMETRY(Polygon, 4326)
);

CREATE TABLE admin_paraje (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL, -- Pedregalito
    colonia_id INTEGER REFERENCES admin_colonia(id),
    geom GEOMETRY(Polygon, 4326)
);

CREATE TABLE admin_sectores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    geom GEOMETRY(Polygon, 4326)
);

CREATE TABLE admin_manzanas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL,
    sector_id INTEGER REFERENCES admin_sectores(id),
    geom GEOMETRY(Polygon, 4326)
);

-- Índices espaciales
CREATE INDEX idx_admin_colonia_geom ON admin_colonia USING GIST (geom);
CREATE INDEX idx_admin_sectores_geom ON admin_sectores USING GIST (geom);

-- ==========================================
-- 2. INFRAESTRUCTURA HIDRÁULICA (Líneas y Puntos)
-- ==========================================

-- Catálogos
CREATE TABLE cat_material_tuberia (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL -- PVC, HDP, Manguera Negra, etc.
);

CREATE TABLE cat_tipo_valvula (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL -- Válvula, Reductor, Hidrante, Tanque
);

-- Topología: Líneas (Red Tuberías)
CREATE TABLE red_tuberias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identificador VARCHAR(50) UNIQUE NOT NULL,
    longitud_calculada NUMERIC(10, 2), -- Generada en trigger o vista
    diametro_pulgadas NUMERIC(5, 2),
    material_id INTEGER REFERENCES cat_material_tuberia(id),
    presion_estimada NUMERIC(5, 2),
    profundidad_enterramiento_m NUMERIC(5, 2),
    fecha_instalacion DATE,
    geom GEOMETRY(LineString, 4326)
);

-- Trigger para calcular longitud automáticamente en metros (transformando a EPSG:3857 temporalmente o usando Geografía)
CREATE OR REPLACE FUNCTION calc_longitud_tuberia()
RETURNS TRIGGER AS $$
BEGIN
    NEW.longitud_calculada := ST_Length(NEW.geom::geography);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_longitud
BEFORE INSERT OR UPDATE ON red_tuberias
FOR EACH ROW EXECUTE FUNCTION calc_longitud_tuberia();


-- Topología: Puntos (Nodos y Válvulas)
CREATE TABLE red_nodos_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identificador VARCHAR(50) UNIQUE NOT NULL,
    tipo_id INTEGER REFERENCES cat_tipo_valvula(id),
    material VARCHAR(50),
    estado_operativo VARCHAR(20) CHECK (estado_operativo IN ('Abierta', 'Cerrada', 'Mantenimiento')),
    fecha_ultimo_mantenimiento DATE,
    profundidad_m NUMERIC(5, 2),
    geom GEOMETRY(Point, 4326)
);

-- Topología: Puntos (Tomas Domiciliarias)
CREATE TABLE tomas_domiciliarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identificador VARCHAR(50) UNIQUE NOT NULL,
    titular VARCHAR(150),
    direccion TEXT,
    manzana_id INTEGER REFERENCES admin_manzanas(id),
    estado_fisico VARCHAR(20) CHECK (estado_fisico IN ('Funcional', 'Dañada', 'Suspendida')),
    material_id INTEGER REFERENCES cat_material_tuberia(id),
    evidencia_url TEXT, -- Link a S3 o servidor local para la foto
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(Point, 4326)
);

-- Índices espaciales
CREATE INDEX idx_red_tuberias_geom ON red_tuberias USING GIST (geom);
CREATE INDEX idx_red_nodos_geom ON red_nodos_control USING GIST (geom);
CREATE INDEX idx_tomas_domiciliarias_geom ON tomas_domiciliarias USING GIST (geom);

-- ==========================================
-- 3. REPORTES CIUDADANOS (Participación)
-- ==========================================
CREATE TABLE reportes_fugas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_reporte VARCHAR(100),
    descripcion TEXT,
    evidencia_url TEXT,
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Revisión', 'Resuelto', 'Descartado')),
    fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_reportes_fugas_geom ON reportes_fugas USING GIST (geom);

-- ==========================================
-- 4. USUARIOS Y ROLES (Seguridad Básica)
-- ==========================================
CREATE TABLE auth_roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL -- Administrador, Operador de Campo, Ciudadano
);

CREATE TABLE auth_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_completo VARCHAR(150),
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255),
    rol_id INTEGER REFERENCES auth_roles(id),
    activo BOOLEAN DEFAULT true
);

-- Insertar roles básicos
INSERT INTO auth_roles (nombre) VALUES ('Administrador'), ('Operador de Campo'), ('Ciudadano');
