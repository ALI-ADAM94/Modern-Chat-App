const express = require('express');
const router = express.Router();
const { getOrCreateDirectRoom, createRoom, getRooms, getRoomById, getRoomMessages } = require('../controllers/roomController');
const auth = require('../middleware/auth');



router.post('/', auth, createRoom);
router.post('/direct/:userId', auth, getOrCreateDirectRoom);
router.get('/', auth, getRooms);
router.get('/:id', auth, getRoomById);
router.get('/:id/messages', auth, getRoomMessages);


module.exports = router;