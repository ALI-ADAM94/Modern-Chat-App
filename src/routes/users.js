const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const presence = require('../socket/presence');

// قائمة المستخدمين مع حالة الاتصال
// GET /api/users -> every user except me, with `online` and `lastSeen`
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username displayName avatar lastSeen')
      .sort({ username: 1 })
      .lean();

    res.json(users.map((u) => ({ ...u, online: presence.isOnline(u._id) })));
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Error occurred while getting users' });
  }
});

module.exports = router;
