
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'subroute_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const schemaCreationQuery = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      abn VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      make VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      registration VARCHAR(20) UNIQUE NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trips (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE,
      start_odometer INTEGER NOT NULL,
      end_odometer INTEGER,
      distance REAL,
      purpose VARCHAR(50) CHECK (purpose IN ('business', 'personal')),
      notes TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
      description VARCHAR(255) NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      category VARCHAR(50) NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorite_places (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      is_home BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes for performance
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE c.relname = 'idx_vehicles_user_id' AND c.relkind = 'i') THEN
        CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE c.relname = 'idx_trips_user_id' AND c.relkind = 'i') THEN
        CREATE INDEX idx_trips_user_id ON trips(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE c.relname = 'idx_expenses_user_id' AND c.relkind = 'i') THEN
        CREATE INDEX idx_expenses_user_id ON expenses(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE c.relname = 'idx_favorite_places_user_id' AND c.relkind = 'i') THEN
        CREATE INDEX idx_favorite_places_user_id ON favorite_places(user_id);
    END IF;
  END $$;
`;

export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Check if the users table exists
    const res = await client.query("SELECT to_regclass('public.users');");
    if (res.rows[0].to_regclass === null) {
      console.log('Database schema not found. Initializing...');
      await client.query(schemaCreationQuery);
      console.log('Database schema created successfully.');
    } else {
      console.log('Database schema already exists.');
    }
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err; // Re-throw the error to be caught by the server startup logic
  } finally {
    client.release();
  }
};


export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect(),
};