import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Configuración de la conexión a PostgreSQL
const { Pool } = pg;
console.log('🔌 Intentando conectar a DB:', process.env.DB_NAME || 'sig_pedregal', 'con usuario:', process.env.DB_USER || 'postgres');
console.log('🔑 ¿Tiene contraseña?:', process.env.DB_PASSWORD ? 'Sí' : 'No');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sig_pedregal',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Verificar conexión a la base de datos
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al conectar a PostgreSQL/PostGIS:', err.message);
    console.log('👉 Asegúrate de configurar correctamente el archivo .env');
  } else {
    console.log('🚀 Conexión exitosa a PostgreSQL/PostGIS:', res.rows[0].now);
  }
});

// Endpoint de prueba
app.get('/', (req, res) => {
  res.send('API del SIG Red Hidráulica de Pedregalito funcionando 🚀');
});

// 1. Endpoint: Tomas Domiciliarias (GeoJSON)
app.get('/api/tomas', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
          'properties', jsonb_build_object(
              'identificador', identificador,
              'titular', titular,
              'direccion', direccion,
              'estado_fisico', estado_fisico
          )
        ) AS feature
        FROM tomas_domiciliarias
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/tomas:', error);
    res.status(500).json({ error: 'Error al obtener las tomas domiciliarias' });
  }
});

// 2. Endpoint: Válvulas y Nodos de Control (GeoJSON)
app.get('/api/valvulas', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
          'properties', jsonb_build_object(
              'identificador', identificador,
              'estado_operativo', estado_operativo,
              'profundidad_m', profundidad_m,
              'fecha_ultimo_mantenimiento', fecha_ultimo_mantenimiento
          )
        ) AS feature
        FROM red_nodos_control
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/valvulas:', error);
    res.status(500).json({ error: 'Error al obtener las válvulas' });
  }
});

// 2.1 Endpoint: Actualizar Estado de Válvula (Administración)
app.put('/api/valvulas/:id', async (req, res) => {
  const { id } = req.params;
  const { estado_operativo } = req.body;
  
  if (!['Abierta', 'Cerrada', 'Mantenimiento'].includes(estado_operativo)) {
    return res.status(400).json({ error: 'Estado operativo no válido' });
  }

  try {
    const query = `
      UPDATE red_nodos_control
      SET estado_operativo = $1
      WHERE id = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [estado_operativo, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Válvula no encontrada' });
    }
    
    res.json({ message: 'Estado actualizado exitosamente', valvula: result.rows[0] });
  } catch (error) {
    console.error('Error en PUT /api/valvulas:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la válvula' });
  }
});

// 3. Endpoint: Red de Tuberías (GeoJSON)
app.get('/api/tuberias', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         t.id,
          'geometry',   ST_AsGeoJSON(ST_Transform(t.geom, 4326))::jsonb,
          'properties', jsonb_build_object(
              'identificador', t.identificador,
              'diametro_pulgadas', t.diametro_pulgadas,
              'presion_estimada', t.presion_estimada,
              'longitud_calculada', t.longitud_calculada,
              'material', m.nombre
          )
        ) AS feature
        FROM red_tuberias t
        LEFT JOIN cat_material_tuberia m ON t.material_id = m.id
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/tuberias:', error);
    res.status(500).json({ error: 'Error al obtener la red de tuberías' });
  }
});

// 3.1 Endpoint: Sectores Administrativos (GeoJSON)
app.get('/api/sectores', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
          'properties', jsonb_build_object(
              'nombre', nombre,
              'descripcion', descripcion
          )
        ) AS feature
        FROM admin_sectores
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/sectores:', error);
    res.status(500).json({ error: 'Error al obtener los sectores' });
  }
});

// 3.2 Endpoint: Manzanas (GeoJSON)
app.get('/api/manzanas', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(ST_SetSRID(geom, 32614), 4326))::jsonb,
          'properties', jsonb_build_object(
              'nomvial', nomvial,
              'cvegeo', cvegeo
          )
        ) AS feature
        FROM "OcoFrenteManz"
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/manzanas:', error);
    res.status(500).json({ error: 'Error al obtener las manzanas' });
  }
});

// 3.3 Endpoint: Límite Municipal (GeoJSON)
app.get('/api/municipio', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(ST_SetSRID(geom, 32614), 4326))::jsonb,
          'properties', to_jsonb(t.*) - 'geom'
        ) AS feature
        FROM "OcoMun" t
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/municipio:', error);
    res.status(500).json({ error: 'Error al obtener el límite municipal' });
  }
});

// 3.4 Endpoint: Límite Colonia (GeoJSON)
app.get('/api/colonia', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(ST_SetSRID(geom, 32614), 4326))::jsonb,
          'properties', jsonb_build_object(
              'nombre', nombre
          )
        ) AS feature
        FROM admin_colonia
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error en /api/colonia:', error);
    res.status(500).json({ error: 'Error al obtener el límite de la colonia' });
  }
});// 3.5 Endpoint Dinámico: Capas Genéricas (GeoJSON)
app.get('/api/layers/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         id,
          'geometry',   ST_AsGeoJSON(ST_Transform(ST_SetSRID(geom, 32614), 4326))::jsonb,
          'properties', to_jsonb(t.*) - 'geom'
        ) AS feature
        FROM "${table}" t
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error(`Error en /api/layers/${table}:`, error);
    res.status(500).json({ error: `Error al obtener la capa ${table}` });
  }
});

// 3.6 Endpoint: Estadísticas de la Red
app.get('/api/estadisticas', async (req, res) => {
  try {
    const tuberiasQuery = `SELECT COALESCE(SUM(longitud_calculada), 0) as total_m FROM red_tuberias`;
    const valvulasQuery = `SELECT estado_operativo, COUNT(*) as count FROM red_nodos_control GROUP BY estado_operativo`;
    const tomasQuery = `SELECT estado_fisico, COUNT(*) as count FROM tomas_domiciliarias GROUP BY estado_fisico`;
    const fugasQuery = `SELECT COUNT(*) as count FROM reportes_fugas`;

    const tuberiasRes = await pool.query(tuberiasQuery);
    const valvulasRes = await pool.query(valvulasQuery);
    const tomasRes = await pool.query(tomasQuery);
    const fugasRes = await pool.query(fugasQuery);

    // Format valves count
    const valvulas = {
      abiertas: 0,
      cerradas: 0,
      mantenimiento: 0,
      total: 0
    };
    valvulasRes.rows.forEach(row => {
      const state = row.estado_operativo?.toLowerCase();
      const count = parseInt(row.count, 10);
      valvulas.total += count;
      if (state === 'abierta') valvulas.abiertas += count;
      else if (state === 'cerrada') valvulas.cerradas += count;
      else if (state === 'mantenimiento') valvulas.mantenimiento += count;
    });

    // Format tomas count
    const tomas = {
      activo: 0,
      inactivo: 0,
      irregular: 0,
      total: 0
    };
    tomasRes.rows.forEach(row => {
      const state = row.estado_fisico?.toLowerCase();
      const count = parseInt(row.count, 10);
      tomas.total += count;
      if (state === 'bueno' || state === 'activo' || state === 'operativa') tomas.activo += count;
      else if (state === 'malo' || state === 'inactivo' || state === 'suspendida') tomas.inactivo += count;
      else if (state === 'irregular' || state === 'clandestina') tomas.irregular += count;
    });

    res.json({
      longitud_tuberias_km: (parseFloat(tuberiasRes.rows[0].total_m) / 1000).toFixed(2),
      valvulas,
      tomas,
      fugas_activas: parseInt(fugasRes.rows[0].count, 10)
    });
  } catch (error) {
    console.error('Error en /api/estadisticas:', error);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});


// 4. Endpoint: Reportar Fuga (POST)
app.post('/api/reportes', async (req, res) => {
  const { tipo_reporte, descripcion, lat, lng } = req.body;
  try {
    const query = `
      INSERT INTO reportes_fugas (tipo_reporte, descripcion, geom)
      VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326))
      RETURNING id;
    `;
    const result = await pool.query(query, [tipo_reporte, descripcion, lng, lat]);
    res.status(201).json({ message: 'Reporte creado exitosamente', id: result.rows[0].id });
  } catch (error) {
    console.error('Error en POST /api/reportes:', error);
    res.status(500).json({ error: 'Error al registrar el reporte' });
  }
});
// 4.1 Endpoint: Obtener todos los Reportes (GET)
app.get('/api/reportes', async (req, res) => {
  try {
    const query = `
      SELECT id, tipo_reporte, descripcion, estado, 
             fecha_reporte,
             ST_X(geom) as lng, ST_Y(geom) as lat 
      FROM reportes_fugas 
      ORDER BY fecha_reporte DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en GET /api/reportes:', error);
    res.status(500).json({ error: 'Error al obtener los reportes' });
  }
});

// 4.2 Endpoint: Actualizar Estado del Reporte (PUT)
app.put('/api/reportes/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const query = `
      UPDATE reportes_fugas 
      SET estado = $1 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await pool.query(query, [estado, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.json({ message: 'Estado del reporte actualizado', reporte: result.rows[0] });
  } catch (error) {
    console.error('Error en PUT /api/reportes:', error);
    res.status(500).json({ error: 'Error al actualizar el reporte' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
