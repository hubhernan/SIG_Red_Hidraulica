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
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', res.rows.map(r => r.table_name));
    
    const hasOcoMun = res.rows.some(r => r.table_name.toLowerCase() === 'ocomun');
    if (hasOcoMun) {
      const realName = res.rows.find(r => r.table_name.toLowerCase() === 'ocomun').table_name;
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${realName}"`);
      console.log(`Table ${realName} count:`, countRes.rows[0].count);
      
      const sridRes = await pool.query(`SELECT ST_SRID(geom) as srid FROM "${realName}" LIMIT 1`);
      console.log(`Table ${realName} SRID:`, sridRes.rows[0]?.srid);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
