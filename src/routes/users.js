const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const presence = require('../socket/presence');
const { describeUpload } = require('./upload');

// Fields other users may see
const PUBLIC_FIELDS = 'username displayName avatar about lastSeen';

function publicProfile(user) {
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    about: user.about,
  };
}

// قائمة المستخدمين مع حالة الاتصال
// GET /api/users?search=ali -> every user except me, with `online` and `lastSeen`
router.get('/', auth, async (req, res) => {
  try {
    const filter = { _id: { $ne: req.user._id } };

    // Optional search by username or display name (case-insensitive)
    const search = String(req.query.search || '').trim().slice(0, 50);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ username: re }, { displayName: re }];
    }

    const users = await User.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ username: 1 })
      .lean();

    res.json(users.map((u) => ({ ...u, online: presence.isOnline(u._id) })));
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Error occurred while getting users' });
  }
});

// ===== اعدادات الحساب =====

// GET /api/users/me -> my full profile (without password)
router.get('/me', auth, (req, res) => {
  const me = req.user.toObject();
  delete me.password;
  res.json(me);
});

// PATCH /api/users/me {displayName?, username?, email?, about?, avatar?}
router.patch('/me', auth, async (req, res) => {
  try {
    const user = req.user;
    const { displayName, username, email, about, avatar } = req.body || {};

    if (displayName !== undefined) {
      user.displayName = String(displayName).trim().slice(0, 50);
    }
    if (about !== undefined) {
      user.about = String(about).trim().slice(0, 140);
    }

    if (username !== undefined) {
      const value = String(username).trim();
      if (value.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
      if (value !== user.username && await User.exists({ username: value })) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      user.username = value;
    }

    if (email !== undefined) {
      const value = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ error: 'Invalid email' });
      if (value !== user.email && await User.exists({ email: value })) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
      user.email = value;
    }

    if (avatar !== undefined) {
      if (avatar === '' || avatar === null) {
        user.avatar = '';
      } else {
        // Avatar must be an image uploaded through /api/upload
        const file = describeUpload(avatar);
        if (!file?.isImage) return res.status(400).json({ error: 'Avatar must be an uploaded image (png, jpg, gif, webp)' });
        user.avatar = file.url;
      }
    }

    await user.save();

    // Let everyone update this user's name/avatar in real time
    req.app.get('io').emit('user-updated', publicProfile(user));

    const me = user.toObject();
    delete me.password;
    res.json(me);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error occurred while updating profile' });
  }
});

// PATCH /api/users/me/password {currentPassword, newPassword}
router.patch('/me/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const ok = await bcrypt.compare(String(currentPassword), req.user.password);
    if (!ok) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    req.user.password = await bcrypt.hash(String(newPassword), 10);
    await req.user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Error occurred while changing password' });
  }
});

module.exports = router;
