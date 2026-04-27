# Documento Técnico: Sistema de Información Geográfica (SIG) de la Red Hidráulica
**Proyecto:** Gestión y Monitoreo de la Red de Agua Potable - Pedregalito
**Fecha:** 26 de abril de 2026

---

## 1. Resumen Ejecutivo
Se ha desarrollado e implementado un Sistema de Información Geográfica (SIG) web e interoperable para la administración, visualización y análisis de la infraestructura hidráulica de la comunidad de Pedregalito. El sistema centraliza la información cartográfica y permite la toma de decisiones basada en datos espaciales.

---

## 2. Arquitectura del Sistema
El ecosistema tecnológico se divide en tres capas principales:

### Base de Datos Espacial (PostGIS)
*   **Motor:** PostgreSQL 15 + Extensión PostGIS.
*   **Modelo de Datos:** Tablas relacionales con restricciones topológicas para:
    *   `red_tuberias` (Geometrías `LINESTRING`).
    *   `red_nodos_control` (Válvulas, Hidrantes, Tanques - Geometrías `POINT`).
    *   `tomas_domiciliarias` (Geometrías `POINT`).

### Backend (API REST)
*   **Tecnologías:** Node.js + Express.
*   **Funciones clave:** Consultas espaciales nativas (`ST_AsGeoJSON`, `ST_Distance`, `ST_Buffer`), algoritmos de ruteo y conversiones WKT.

### Frontend (Visor Web Interactivo)
*   **Tecnologías:** React + Vite + Leaflet + Lucide Icons.
*   **Diseño:** Interfaz oscura premium, responsiva y orientada a la experiencia de usuario (UX).

---

## 3. Módulos y Funcionalidades Logradas

### Fase 1: Importación de Datos Históricos
*   Módulo de carga masiva que lee archivos GeoJSON.
*   Normalización automática de atributos (mapeo a catálogos de materiales y diámetros).

### Fase 2: Levantamiento de Información en Campo
*   **Herramientas de dibujo directo:** Permite a los operadores trazar tuberías vértice a vértice y ubicar válvulas/tomas mediante GPS o clics en el mapa.
*   **Formularios Dinámicos:** Captura de datos técnicos (material, estado, titular) en tiempo real.

### Fase 3: Interoperabilidad con QGIS Desktop
*   Acceso directo a la base de datos centralizada mediante parámetros PostGIS.
*   Sincronización bidireccional inmediata entre escritorio y plataforma web.

---

## 4. Funciones de Análisis Avanzado

### Simulación de Corte de Suministro
*   Algoritmo que evalúa la topología de la red.
*   Al "Cerrar" una válvula, calcula aguas abajo qué tuberías y tomas domiciliarias se quedan sin flujo de agua.

### Panel de Consultas PostGIS
*   Consultas espaciales preconfiguradas ejecutadas directamente en el motor de base de datos (Ej: Identificar tomas aisladas a más de 30 metros de la red principal).

### Gestión de Usuarios y Permisos
*   Roles diferenciados (*Administrador, Operador, Ciudadano*) que controlan la visibilidad de herramientas de edición y datos confidenciales.

---

## 5. Próximos Pasos Recomendados
1.  **Validación de Topología en Campo:** Iniciar barridos sistemáticos de actualización.
2.  **Módulo de Reportes Ciudadanos:** Integración pública para fugas.
