const { pool } = require('../config/database');

async function getMyRequests(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, t.start_location, t.destination, t.trip_date, t.departure_time,
              driver.name AS driver_name, rider.name AS rider_name
       FROM ride_requests r
       JOIN trips t ON t.id = r.trip_id
       JOIN users driver ON driver.id = t.driver_id
       JOIN users rider ON rider.id = r.rider_id
       WHERE r.rider_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Get my requests error:', error);
    return res.status(500).json({ error: 'Unable to fetch requests' });
  }
}

async function createRequest(req, res) {
  const { trip_id, message } = req.body;

  if (!trip_id) {
    return res.status(400).json({ error: 'Trip ID is required' });
  }

  try {
    const [tripRows] = await pool.query('SELECT * FROM trips WHERE id = ?', [trip_id]);

    if (!tripRows.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (tripRows[0].driver_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot request your own trip' });
    }

    const [existingRows] = await pool.query(
      'SELECT id FROM ride_requests WHERE trip_id = ? AND rider_id = ?',
      [trip_id, req.user.id]
    );

    if (existingRows.length) {
      return res.status(409).json({ error: 'You already requested this trip' });
    }

    if (tripRows[0].status !== 'active' || tripRows[0].available_seats < 1) {
      return res.status(400).json({ error: 'This ride is no longer available' });
    }

    const [result] = await pool.execute(
      'INSERT INTO ride_requests (trip_id, rider_id, message, status) VALUES (?, ?, ?, ?)',
      [trip_id, req.user.id, message || null, 'pending']
    );

    const [rows] = await pool.query(
      `SELECT r.*, t.start_location, t.destination
       FROM ride_requests r
       JOIN trips t ON t.id = r.trip_id
       WHERE r.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already requested this trip' });
    }
    console.error('Create request error:', error);
    return res.status(500).json({ error: 'Unable to create ride request' });
  }
}

async function getTripRequests(req, res) {
  const { tripId } = req.params;

  try {
    const [tripRows] = await pool.query('SELECT * FROM trips WHERE id = ?', [tripId]);

    if (!tripRows.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (tripRows[0].driver_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view requests for your own trips' });
    }

    const [rows] = await pool.query(
      `SELECT r.*, u.name AS rider_name, u.email AS rider_email
       FROM ride_requests r
       JOIN users u ON u.id = r.rider_id
       WHERE r.trip_id = ?
       ORDER BY r.created_at DESC`,
      [tripId]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Get trip requests error:', error);
    return res.status(500).json({ error: 'Unable to fetch trip requests' });
  }
}

async function updateRequestStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['accepted', 'rejected'];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'A valid status is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requestRows] = await connection.query(
      `SELECT r.*, t.driver_id, t.status AS trip_status, t.available_seats
       FROM ride_requests r
       JOIN trips t ON t.id = r.trip_id
       WHERE r.id = ? FOR UPDATE`,
      [id]
    );

    if (!requestRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }

    const rideRequest = requestRows[0];
    if (rideRequest.driver_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'You can only update requests for your own trips' });
    }

    if (rideRequest.status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ error: 'Only pending requests can be updated' });
    }

    if (status === 'accepted') {
      if (rideRequest.trip_status !== 'active' || rideRequest.available_seats < 1) {
        await connection.rollback();
        return res.status(409).json({ error: 'No seats are available for this ride' });
      }
      await connection.query('UPDATE trips SET available_seats = available_seats - 1 WHERE id = ?', [rideRequest.trip_id]);
    }

    await connection.query('UPDATE ride_requests SET status = ? WHERE id = ?', [status, id]);
    await connection.commit();
    return res.json({ message: 'Request status updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update request status error:', error);
    return res.status(500).json({ error: 'Unable to update request status' });
  } finally {
    connection.release();
  }
}

async function cancelMyRequest(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT * FROM ride_requests WHERE id = ? AND rider_id = ? FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }
    if (rows[0].status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ error: 'Only pending requests can be cancelled' });
    }

    await connection.query('UPDATE ride_requests SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await connection.commit();
    return res.json({ message: 'Request cancelled successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Cancel ride request error:', error);
    return res.status(500).json({ error: 'Unable to cancel ride request' });
  } finally {
    connection.release();
  }
}

module.exports = { getMyRequests, createRequest, getTripRequests, updateRequestStatus, cancelMyRequest };