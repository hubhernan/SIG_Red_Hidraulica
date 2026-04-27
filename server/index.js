import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 2.2 Endpoint: Simulación de Afectación por Cierre de Válvula
app.get('/api/valvulas/:id/afectacion', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener tuberías afectadas
    const queryTuberias = `
      WITH RECURSIVE reachable_pipes AS (
          SELECT p.id, p.geom, p.identificador
          FROM red_tuberias p
          JOIN red_nodos_control n ON ST_DWithin(p.geom::geography, n.geom::geography, 2)
          WHERE n.identificador = 'TQ-001'

          UNION

          SELECT p.id, p.geom, p.identificador
          FROM red_tuberias p
          JOIN reachable_pipes rp ON ST_Intersects(p.geom, rp.geom)
          WHERE p.id <> rp.id
            AND NOT EXISTS (
                SELECT 1 FROM red_nodos_control v 
                WHERE v.id = $1 AND ST_DWithin(rp.geom::geography, v.geom::geography, 5)
            )
      ),
      affected_pipes AS (
          SELECT id, geom, identificador 
          FROM red_tuberias 
          WHERE id NOT IN (SELECT id FROM reachable_pipes)
      )
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
              'estado', 'Afectado'
          )
        ) AS feature
        FROM affected_pipes
      ) features;
    `;
    
    const resultTuberias = await pool.query(queryTuberias, [id]);

    // 2. Obtener tomas afectadas
    const queryTomas = `
      WITH RECURSIVE reachable_pipes AS (
          SELECT p.id, p.geom, p.identificador
          FROM red_tuberias p
          JOIN red_nodos_control n ON ST_DWithin(p.geom::geography, n.geom::geography, 2)
          WHERE n.identificador = 'TQ-001'

          UNION

          SELECT p.id, p.geom, p.identificador
          FROM red_tuberias p
          JOIN reachable_pipes rp ON ST_Intersects(p.geom, rp.geom)
          WHERE p.id <> rp.id
            AND NOT EXISTS (
                SELECT 1 FROM red_nodos_control v 
                WHERE v.id = $1 AND ST_DWithin(rp.geom::geography, v.geom::geography, 5)
            )
      ),
      affected_pipes AS (
          SELECT id, geom, identificador 
          FROM red_tuberias 
          WHERE id NOT IN (SELECT id FROM reachable_pipes)
      )
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
              'titular', t.titular,
              'estado', 'Afectado'
          )
        ) AS feature
        FROM tomas_domiciliarias t
        WHERE EXISTS (
            SELECT 1 FROM affected_pipes ap 
            WHERE ST_DWithin(t.geom::geography, ap.geom::geography, 20)
        )
      ) features;
    `;

    const resultTomas = await pool.query(queryTomas, [id]);

    res.json({
      tuberias_afectadas: resultTuberias.rows[0].geojson,
      tomas_afectadas: resultTomas.rows[0].geojson
    });
  } catch (error) {
    console.error('Error en /api/valvulas/:id/afectacion:', error);
    res.status(500).json({ error: 'Error al simular la afectación' });
  }
});

// 2.4 Endpoints: Panel PostGIS
app.get('/api/postgis/consultas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (id === '1') {
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
                'titular', t.titular,
                'detalle', 'Sin tubería cercana (> 30m)'
            )
          ) AS feature
          FROM tomas_domiciliarias t
          WHERE NOT EXISTS (
              SELECT 1 FROM red_tuberias p 
              WHERE ST_DWithin(t.geom::geography, p.geom::geography, 30)
          )
        ) features;
      `;
      const result = await pool.query(query);
      return res.json({
        titulo: 'Tomas Domiciliarias Aisladas',
        descripcion: 'Tomas que se encuentran a más de 30 metros de cualquier tubería registrada (Posibles conexiones irregulares).',
        geojson: result.rows[0].geojson
      });
    } 
    
    if (id === '2') {
      const query = `
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        ) AS geojson
        FROM (
          SELECT jsonb_build_object(
            'type',       'Feature',
            'id',         s.id,
            'geometry',   ST_AsGeoJSON(ST_Transform(ST_SetSRID(s.geom, 32614), 4326))::jsonb,
            'properties', jsonb_build_object(
                'nombre', s.nombre,
                'detalle', CONCAT(COUNT(f.id), ' fugas reportadas')
            )
          ) AS feature
          FROM admin_sectores s
          LEFT JOIN reportes_fugas f ON ST_Contains(ST_Transform(ST_SetSRID(s.geom, 32614), 4326), f.geom)
          GROUP BY s.id, s.geom, s.nombre
        ) features;
      `;
      const result = await pool.query(query);
      return res.json({
        titulo: 'Fugas por Sector',
        descripcion: 'Conteo espacial de reportes de fugas contenidos dentro de cada sector hidrométrico.',
        geojson: result.rows[0].geojson
      });
    }

    if (id === '3') {
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
                'detalle', CONCAT('Diámetro: ', diametro_pulgadas, ' pulgadas')
            )
          ) AS feature
          FROM red_tuberias
          WHERE diametro_pulgadas > 2
        ) features;
      `;
      const result = await pool.query(query);
      return res.json({
        titulo: 'Tuberías de Mayor Diámetro',
        descripcion: 'Tuberías con diámetro superior a 2 pulgadas (Líneas principales).',
        geojson: result.rows[0].geojson
      });
    }

    res.status(400).json({ error: 'Consulta no válida' });
  } catch (error) {
    console.error('Error en /api/postgis/consultas:', error);
    res.status(500).json({ error: 'Error al ejecutar consulta espacial' });
  }
});

// 2.5 Endpoint: Importar Datos (GeoJSON)
app.post('/api/importar', async (req, res) => {
  const { layer, geojson } = req.body;
  
  if (!layer || !geojson || !geojson.features) {
    return res.status(400).json({ error: 'Datos de importación inválidos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let insertedCount = 0;

    for (const feature of geojson.features) {
      const geomStr = JSON.stringify(feature.geometry);
      const props = feature.properties || {};

      if (layer === 'tuberias') {
        const materialStr = props.material || 'PVC';
        const resMat = await client.query("SELECT id FROM cat_material_tuberia WHERE nombre ILIKE $1", [materialStr]);
        let materialId = 1; 
        if (resMat.rows.length > 0) {
          materialId = resMat.rows[0].id;
        }

        const query = `
          INSERT INTO red_tuberias (identificador, material_id, diametro_pulgadas, geom)
          VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
          RETURNING id;
        `;
        const values = [
          props.identificador || `RT-IMP-${Math.floor(Math.random() * 10000)}`,
          materialId,
          parseFloat(props.diametro_pulgadas) || 2,
          geomStr
        ];
        await client.query(query, values);
        insertedCount++;
      } 
      
      else if (layer === 'valvulas') {
        const query = `
          INSERT INTO red_nodos_control (identificador, tipo_id, estado_operativo, geom)
          VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
          RETURNING id;
        `;
        const values = [
          props.identificador || `RN-IMP-${Math.floor(Math.random() * 10000)}`,
          parseInt(props.tipo_id) || 1, 
          props.estado_operativo || 'Abierta',
          geomStr
        ];
        await client.query(query, values);
        insertedCount++;
      } 
      
      else if (layer === 'tomas') {
        const query = `
          INSERT INTO tomas_domiciliarias (identificador, titular, estado_fisico, geom)
          VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
          RETURNING id;
        `;
        const values = [
          props.identificador || `TD-IMP-${Math.floor(Math.random() * 10000)}`,
          props.titular || 'Importado via Web',
          props.estado_fisico || 'Funcional',
          geomStr
        ];
        await client.query(query, values);
        insertedCount++;
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Importación exitosa. Se insertaron ${insertedCount} elementos.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en POST /api/importar:', error);
    res.status(500).json({ error: 'Error al importar datos: ' + error.message });
  } finally {
    client.release();
  }
});

// 2.6 Endpoints: Creación de Infraestructura (Levantamiento en Campo)
app.post('/api/tomas', async (req, res) => {
  const { identificador, titular, direccion, estado_fisico, material_id, lat, lng } = req.body;
  try {
    const query = `
      INSERT INTO tomas_domiciliarias (identificador, titular, direccion, estado_fisico, material_id, geom)
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
      RETURNING id;
    `;
    const values = [
      identificador || `TD-NEW-${Math.floor(Math.random() * 10000)}`,
      titular || 'Nuevo Usuario',
      direccion || '',
      estado_fisico || 'Funcional',
      material_id ? parseInt(material_id) : 1,
      parseFloat(lng),
      parseFloat(lat)
    ];
    const result = await pool.query(query, values);
    res.json({ message: 'Toma registrada exitosamente.', id: result.rows[0].id });
  } catch (error) {
    console.error('Error en POST /api/tomas:', error);
    res.status(500).json({ error: 'Error al registrar toma: ' + error.message });
  }
});

app.post('/api/valvulas', async (req, res) => {
  const { identificador, tipo_id, estado_operativo, lat, lng } = req.body;
  try {
    const query = `
      INSERT INTO red_nodos_control (identificador, tipo_id, estado_operativo, geom)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
      RETURNING id;
    `;
    const values = [
      identificador || `RN-NEW-${Math.floor(Math.random() * 10000)}`,
      tipo_id ? parseInt(tipo_id) : 1,
      estado_operativo || 'Abierta',
      parseFloat(lng),
      parseFloat(lat)
    ];
    const result = await pool.query(query, values);
    res.json({ message: 'Válvula/Nodo registrado exitosamente.', id: result.rows[0].id });
  } catch (error) {
    console.error('Error en POST /api/valvulas:', error);
    res.status(500).json({ error: 'Error al registrar válvula: ' + error.message });
  }
});

app.post('/api/tuberias', async (req, res) => {
  const { identificador, material_id, diametro_pulgadas, coordinates } = req.body;
  try {
    if (!coordinates || coordinates.length < 2) {
      return res.status(400).json({ error: 'Se requieren al menos 2 vértices para una tubería.' });
    }
    const wktCoords = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
    const wkt = `LINESTRING(${wktCoords})`;

    const query = `
      INSERT INTO red_tuberias (identificador, material_id, diametro_pulgadas, geom)
      VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))
      RETURNING id;
    `;
    const values = [
      identificador || `RT-NEW-${Math.floor(Math.random() * 10000)}`,
      material_id ? parseInt(material_id) : 1,
      parseFloat(diametro_pulgadas) || 2,
      wkt
    ];
    const result = await pool.query(query, values);
    res.json({ message: 'Tubería registrada exitosamente.', id: result.rows[0].id });
  } catch (error) {
    console.error('Error en POST /api/tuberias:', error);
    res.status(500).json({ error: 'Error al registrar tubería: ' + error.message });
  }
});

// 2.3 Endpoints: Gestión de Usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.nombre_completo, u.email, r.nombre as rol, u.activo 
      FROM auth_usuarios u 
      JOIN auth_roles r ON u.rol_id = r.id 
      ORDER BY u.nombre_completo
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en GET /api/usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.put('/api/usuarios/:id/rol', async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  try {
    const query = `
      UPDATE auth_usuarios 
      SET rol_id = (SELECT id FROM auth_roles WHERE nombre = $1) 
      WHERE id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [rol, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Rol actualizado exitosamente' });
  } catch (error) {
    console.error('Error en PUT /api/usuarios/:id/rol:', error);
    res.status(500).json({ error: 'Error al actualizar el rol del usuario' });
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
      if (state === 'bueno' || state === 'activo' || state === 'operativa' || state === 'funcional') tomas.activo += count;
      else if (state === 'malo' || state === 'inactivo' || state === 'suspendida' || state === 'dañada') tomas.inactivo += count;
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

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
