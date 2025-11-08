
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'subroute_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect(),
};
