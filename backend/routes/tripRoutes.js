const express = require('express');
const { getTrips, createTrip, updateTrip, deleteTrip, getMyTrips } = require('../controllers/tripController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getTrips);
router.get('/mine', authMiddleware, getMyTrips);
router.post('/', authMiddleware, createTrip);
router.put('/:id', authMiddleware, updateTrip);
router.delete('/:id', authMiddleware, deleteTrip);

module.exports = router;