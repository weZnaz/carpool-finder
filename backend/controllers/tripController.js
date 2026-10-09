const { pool } = require('../config/database');

async function getTrips(req, res) {
  const { status, search, start_location, destination, trip_date, sort } = req.query;
  let query = `
    SELECT t.*, u.name AS driver_name, u.phone AS driver_phone
    FROM trips t
    JOIN users u ON u.id = t.driver_id
    WHERE t.status = 'active' AND t.available_seats > 0
  `;
  const params = [];

  if (search) {
    query += ' AND (t.start_location LIKE ? OR t.destination LIKE ? OR u.name LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (start_location) {
    query += ' AND t.start_location LIKE ?';
    params.push(`%${start_location}%`);
  }

  if (destination) {
    query += ' AND t.destination LIKE ?';
    params.push(`%${destination}%`);
  }

  if (trip_date) {
    query += ' AND t.trip_date = ?';
    params.push(trip_date);
  }

  const orderBy = sort === 'newest' ? 't.created_at DESC' : 't.trip_date ASC, t.departure_time ASC';
  query += ` ORDER BY ${orderBy}`;

  try {
    const [rows] = await pool.execute(query, params);
    return res.json(rows);
  } catch (error) {
    console.error('Get trips error:', error);
    return res.status(500).json({ error: 'Unable to fetch trips' });
  }
}

async function createTrip(req, res) {
  const { start_location, destination, trip_date, departure_time, available_seats, fare_per_seat = 0, vehicle, notes } = req.body;
  const fare = Number(fare_per_seat);

  if (!start_location || !destination || !trip_date || !departure_time || !Number.isInteger(Number(available_seats)) || Number(available_seats) < 1 || !Number.isFinite(fare) || fare < 0 || fare > 99999999.99) {
    return res.status(400).json({ error: 'Trip details, a valid seat count, and a non-negative per-seat fare are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO trips (driver_id, start_location, destination, trip_date, departure_time, available_seats, fare_per_seat, vehicle, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, start_location.trim(), destination.trim(), trip_date, departure_time, Number(available_seats), fare, vehicle || null, notes || null]
    );

    const [rows] = await pool.query(
      `SELECT t.*, u.name AS driver_name, u.phone AS driver_phone
       FROM trips t
       JOIN users u ON u.id = t.driver_id
       WHERE t.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create trip error:', error);
    return res.status(500).json({ error: 'Unable to create trip' });
  }
}

async function updateTrip(req, res) {
  const { id } = req.params;
  const updates = req.body;

  try {
    const [tripRows] = await pool.query('SELECT * FROM trips WHERE id = ?', [id]);

    if (!tripRows.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (tripRows[0].driver_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own trips' });
    }

    if (updates.available_seats !== undefined && (!Number.isInteger(Number(updates.available_seats)) || Number(updates.available_seats) < 0)) {
      return res.status(400).json({ error: 'Available seats must be a non-negative whole number' });
    }

    if (updates.fare_per_seat !== undefined && (!Number.isFinite(Number(updates.fare_per_seat)) || Number(updates.fare_per_seat) < 0 || Number(updates.fare_per_seat) > 99999999.99)) {
      return res.status(400).json({ error: 'Per-seat fare must be a valid non-negative amount' });
    }

    if (updates.status !== undefined && !['active', 'completed', 'cancelled'].includes(updates.status)) {
      return res.status(400).json({ error: 'A valid trip status is required' });
    }

    const fields = [];
    const values = [];

    ['start_location', 'destination', 'trip_date', 'departure_time', 'available_seats', 'fare_per_seat', 'vehicle', 'notes', 'status'].forEach((field) => {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(['available_seats', 'fare_per_seat'].includes(field) ? Number(updates[field]) : updates[field]);
      }
    });

    if (!fields.length) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    values.push(id);
    await pool.execute(`UPDATE trips SET ${fields.join(', ')} WHERE id = ?`, values);

    return res.json({ message: 'Trip updated successfully' });
  } catch (error) {
    console.error('Update trip error:', error);
    return res.status(500).json({ error: 'Unable to update trip' });
  }
}

async function deleteTrip(req, res) {
  const { id } = req.params;

  try {
    const [tripRows] = await pool.query('SELECT * FROM trips WHERE id = ?', [id]);

    if (!tripRows.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (tripRows[0].driver_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own trips' });
    }

    await pool.execute('DELETE FROM trips WHERE id = ?', [id]);
    return res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Delete trip error:', error);
    return res.status(500).json({ error: 'Unable to delete trip' });
  }
}

async function getMyTrips(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, u.name AS driver_name, u.phone AS driver_phone
       FROM trips t
       JOIN users u ON u.id = t.driver_id
       WHERE t.driver_id = ? ORDER BY t.created_at DESC`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Get my trips error:', error);
    return res.status(500).json({ error: 'Unable to fetch your trips' });
  }
}

module.exports = { getTrips, createTrip, updateTrip, deleteTrip, getMyTrips };