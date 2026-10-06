-- database/schema.sql
-- Run this file to set up the Carpool Finder database

CREATE DATABASE IF NOT EXISTS carpool_finder
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE carpool_finder;

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  phone        VARCHAR(20),
  role         ENUM('driver','rider','both') DEFAULT 'both',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- TRIPS ----------
CREATE TABLE IF NOT EXISTS trips (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  driver_id        INT NOT NULL,
  start_location   VARCHAR(150) NOT NULL,
  destination      VARCHAR(150) NOT NULL,
  trip_date        DATE NOT NULL,
  departure_time   TIME NOT NULL,
  available_seats  INT NOT NULL DEFAULT 0,
  vehicle          VARCHAR(150),
  notes            TEXT,
  status           ENUM('active','completed','cancelled') DEFAULT 'active',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- RIDE REQUESTS ----------
CREATE TABLE IF NOT EXISTS ride_requests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  trip_id      INT NOT NULL,
  rider_id     INT NOT NULL,
  message      TEXT,
  status       ENUM('pending','accepted','rejected','cancelled') DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id)  REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_request (trip_id, rider_id)  -- Rule 5: no duplicate requests
);