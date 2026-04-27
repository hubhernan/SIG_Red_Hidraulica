import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function main() {
  try {
    console.log('Inserting test data...');

    // 1. Insert Tuberías
    const pipeQuery = `
      INSERT INTO red_tuberias (identificador, diametro_pulgadas, material_id, presion_estimada, profundidad_enterramiento_m, fecha_instalacion, geom)
      VALUES 
      ('RT-0003', 2.0, 1, 1.5, 0.8, '2024-01-15', ST_GeomFromText('LINESTRING(-99.46371922342662 19.247366934295265, -99.463600 19.248500, -99.462500 19.248400)', 4326)),
      ('RT-0004', 1.5, 2, 1.2, 0.6, '2024-02-20', ST_GeomFromText('LINESTRING(-99.462500 19.248400, -99.461500 19.248300)', 4326))
      ON CONFLICT (identificador) DO NOTHING
      RETURNING id, identificador;
    `;
    const pipeRes = await pool.query(pipeQuery);
    console.log('Tuberías insertadas:', pipeRes.rows);

    // 2. Insert Tomas Domiciliarias
    const tomasQuery = `
      INSERT INTO tomas_domiciliarias (identificador, titular, direccion, estado_fisico, material_id, geom)
      VALUES 
      ('TD-0001', 'Carlos Mendoza', 'Calle Cuauhtémoc #12', 'Funcional', 1, ST_GeomFromText('POINT(-99.46365 19.2478)', 4326)),
      ('TD-0002', 'Ana Rodríguez', 'Calle Cuauhtémoc #25', 'Funcional', 1, ST_GeomFromText('POINT(-99.4630 19.24845)', 4326)),
      ('TD-0003', 'Luis García', 'Av. Hidalgo #5', 'Suspendida', 2, ST_GeomFromText('POINT(-99.4620 19.24835)', 4326)),
      ('TD-0004', 'María López', 'Calle Independencia #8', 'Dañada', 1, ST_GeomFromText('POINT(-99.46278990794384 19.246274686877186)', 4326)),
      ('TD-0005', 'Pedro Sánchez', 'Calle Independencia #15', 'Funcional', 3, ST_GeomFromText('POINT(-99.46480241907052 19.247421244940362)', 4326))
      ON CONFLICT (identificador) DO NOTHING
      RETURNING id, identificador;
    `;
    const tomasRes = await pool.query(tomasQuery);
    console.log('Tomas insertadas:', tomasRes.rows);

    console.log('Test data inserted successfully!');
  } catch (err) {
    console.error('Error inserting test data:', err);
  } finally {
    await pool.end();
  }
}

main();
