const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Story = require('../models/Story');
const { describeUpload, removeUpload } = require('./upload');

const USER_FIELDS = 'username displayName avatar';

// Only real web links: http(s), no javascript:, data:, etc.
function cleanLink(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href.slice(0, 500);
  } catch {
    return null;
  }
}

// حذف القصص المنتهية وملفاتها
async function removeExpiredStories() {
  try {
    const expired = await Story.find({ expiresAt: { $lte: new Date() } }).select('mediaUrl').lean();
    if (expired.length === 0) return;
    expired.forEach((s) => removeUpload(s.mediaUrl));
    await Story.deleteMany({ _id: { $in: expired.map((s) => s._id) } });
    console.log(`Removed ${expired.length} expired stories`);
  } catch (error) {
    console.error('Error removing expired stories:', error);
  }
}
setInterval(removeExpiredStories, 10 * 60 * 1000).unref(); // every 10 minutes

// Shape a story for the client. Only the owner sees who viewed it.
function present(story, meId) {
  const mine = String(story.user._id || story.user) === meId;
  const out = {
    _id: story._id,
    user: story.user,
    type: story.type,
    mediaUrl: story.mediaUrl,
    link: story.link,
    caption: story.caption,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    seen: story.viewers.some((v) => String(v.user?._id || v.user) === meId),
    viewCount: story.viewers.length,
  };
  if (mine) out.viewers = story.viewers;
  return out;
}

// قائمة القصص الفعالة
// GET /api/stories -> [{ user, stories: [...], allSeen }] (mine first, then unseen first)
router.get('/', auth, async (req, res) => {
  try {
    const meId = req.user._id.toString();
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: 1 })
      .populate('user', USER_FIELDS)
      .populate('viewers.user', USER_FIELDS)
      .lean();

    const groups = new Map();
    for (const story of stories) {
      if (!story.user) continue; // user was deleted
      const key = String(story.user._id);
      if (!groups.has(key)) groups.set(key, { user: story.user, stories: [] });
      groups.get(key).stories.push(present(story, meId));
    }

    const result = [...groups.values()].map((g) => ({
      ...g,
      allSeen: g.stories.every((s) => s.seen),
      latest: g.stories[g.stories.length - 1].createdAt,
    }));

    result.sort((a, b) => {
      const aMine = String(a.user._id) === meId;
      const bMine = String(b.user._id) === meId;
      if (aMine !== bMine) return aMine ? -1 : 1;
      if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
      return new Date(b.latest) - new Date(a.latest);
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting stories:', error);
    res.status(500).json({ error: 'Error occurred while getting stories' });
  }
});

// نشر قصة
// POST /api/stories {type: 'image'|'video', mediaUrl, caption?} or {type: 'link', link, caption?}
router.post('/', auth, async (req, res) => {
  try {
    const { type, mediaUrl, link, caption } = req.body || {};
    const data = { user: req.user._id, type, caption: String(caption || '').trim().slice(0, 200) };

    if (type === 'image' || type === 'video') {
      const file = describeUpload(mediaUrl);
      if (!file || file.kind !== type) {
        return res.status(400).json({ error: `Story needs an uploaded ${type}` });
      }
      data.mediaUrl = file.url;
    } else if (type === 'link') {
      const url = cleanLink(link);
      if (!url) return res.status(400).json({ error: 'Link must be a valid http(s) URL' });
      data.link = url;
    } else {
      return res.status(400).json({ error: 'Story type must be image, video or link' });
    }

    const story = await Story.create(data);
    await story.populate('user', USER_FIELDS);

    req.app.get('io').emit('story-added', { userId: req.user._id.toString(), storyId: story._id });
    res.status(201).json(present(story.toObject(), req.user._id.toString()));
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Error occurred while creating story' });
  }
});

// تسجيل مشاهدة
// POST /api/stories/:id/view
router.post('/:id/view', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid story ID' });
    const story = await Story.findOne({ _id: req.params.id, expiresAt: { $gt: new Date() } });
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const me = req.user._id.toString();
    const isOwner = story.user.toString() === me;
    const alreadySeen = story.viewers.some((v) => v.user.toString() === me);
    if (!isOwner && !alreadySeen) {
      story.viewers.push({ user: req.user._id });
      await story.save();
      // Tell the owner (all their tabs) in real time
      req.app.get('io').to('user:' + story.user.toString()).emit('story-viewed', {
        storyId: story._id,
        viewCount: story.viewers.length,
      });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Error viewing story:', error);
    res.status(500).json({ error: 'Error occurred while viewing story' });
  }
});

// حذف قصة (صاحبها فقط)
// DELETE /api/stories/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid story ID' });
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own stories' });
    }
    removeUpload(story.mediaUrl);
    await story.deleteOne();
    req.app.get('io').emit('story-deleted', { userId: req.user._id.toString(), storyId: story._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Error occurred while deleting story' });
  }
});

module.exports = router;
