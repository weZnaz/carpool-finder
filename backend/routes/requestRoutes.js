const express = require('express');
const {
  getMyRequests,
  createRequest,
  getTripRequests,
  getRideMessages,
  createRideMessage,
  updateRequestStatus,
  cancelMyRequest
} = require('../controllers/requestController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/my', authMiddleware, getMyRequests);
router.get('/trip/:tripId', authMiddleware, getTripRequests);
router.get('/:id/messages', authMiddleware, getRideMessages);
router.post('/:id/messages', authMiddleware, createRideMessage);
router.post('/', authMiddleware, createRequest);
router.patch('/:id/cancel', authMiddleware, cancelMyRequest);
router.patch('/:id/status', authMiddleware, updateRequestStatus);

module.exports = router;