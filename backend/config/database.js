// backend/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbName = process.env.DB_NAME || 'carpool_finder';
const ssl = process.env.DB_SSL_CA
  ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') }
  : process.env.DB_SSL === 'true' ? {} : undefined;
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ...(ssl ? { ssl } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let initializedPool = null;
let initializationPromise = null;

async function initializeDatabase() {
  if (initializedPool) {
    return initializedPool;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (process.env.DB_AUTO_CREATE !== 'false') {
        const adminConnection = await mysql.createConnection({
          host: baseConfig.host,
          port: baseConfig.port,
          user: baseConfig.user,
          password: baseConfig.password,
          ...(ssl ? { ssl } : {}),
          multipleStatements: true
        });

        await adminConnection.query(
          `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await adminConnection.end();
      }

      initializedPool = mysql.createPool({
        ...baseConfig,
        database: dbName
      });

      await initializedPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(150) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          role ENUM('driver','rider','both') DEFAULT 'both',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await initializedPool.query(`
        CREATE TABLE IF NOT EXISTS trips (
          id INT AUTO_INCREMENT PRIMARY KEY,
          driver_id INT NOT NULL,
          start_location VARCHAR(150) NOT NULL,
          destination VARCHAR(150) NOT NULL,
          trip_date DATE NOT NULL,
          departure_time TIME NOT NULL,
          available_seats INT NOT NULL DEFAULT 0,
          fare_per_seat DECIMAL(10,2) NOT NULL DEFAULT 0,
          vehicle VARCHAR(150),
          notes TEXT,
          status ENUM('active','completed','cancelled') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      const [fareColumns] = await initializedPool.query("SHOW COLUMNS FROM trips LIKE 'fare_per_seat'");
      if (!fareColumns.length) {
        await initializedPool.query('ALTER TABLE trips ADD COLUMN fare_per_seat DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER available_seats');
      }

      await initializedPool.query(`
        CREATE TABLE IF NOT EXISTS ride_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trip_id INT NOT NULL,
          rider_id INT NOT NULL,
          message TEXT,
          status ENUM('pending','accepted','rejected','cancelled') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
          FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_request (trip_id, rider_id)
        );
      `);

      await initializedPool.query(`
        CREATE TABLE IF NOT EXISTS ride_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NOT NULL,
          sender_id INT NOT NULL,
          message_text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES ride_requests(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_ride_messages_request_created (request_id, created_at)
        );
      `);

      return initializedPool;
    })();
  }

  return initializationPromise;
}

const pool = {
  query(...args) {
    return initializeDatabase().then((dbPool) => dbPool.query(...args));
  },
  execute(...args) {
    return initializeDatabase().then((dbPool) => dbPool.execute(...args));
  },
  getConnection() {
    return initializeDatabase().then((dbPool) => dbPool.getConnection());
  }
};

async function testConnection() {
  try {
    const dbPool = await initializeDatabase();
    const [rows] = await dbPool.query('SELECT 1 AS ok');

    if (rows && rows[0] && rows[0].ok === 1) {
      console.log('✅ MySQL connected successfully');
      return true;
    }

    return false;
  } catch (err) {
    console.error('⚠️ MySQL connection failed:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection, initializeDatabase };