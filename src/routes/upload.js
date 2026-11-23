const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const auth = require('../middleware/auth');

const router = express.Router();

// مجلد الملفات المرفوعة
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB (videos)

// Only these types are served inline (shown/played in the page). Everything else
// (including SVG/HTML) is served as a download, so an uploaded file can never run
// scripts on our origin.
const MEDIA_TYPES = {
  // images
  '.png': { mime: 'image/png', kind: 'image' },
  '.jpg': { mime: 'image/jpeg', kind: 'image' },
  '.jpeg': { mime: 'image/jpeg', kind: 'image' },
  '.gif': { mime: 'image/gif', kind: 'image' },
  '.webp': { mime: 'image/webp', kind: 'image' },
  // videos
  '.mp4': { mime: 'video/mp4', kind: 'video' },
  '.webm': { mime: 'video/webm', kind: 'video' },
  '.ogv': { mime: 'video/ogg', kind: 'video' },
  '.mov': { mime: 'video/quicktime', kind: 'video' },
  // audio
  '.mp3': { mime: 'audio/mpeg', kind: 'audio' },
  '.wav': { mime: 'audio/wav', kind: 'audio' },
  '.m4a': { mime: 'audio/mp4', kind: 'audio' },
  '.ogg': { mime: 'audio/ogg', kind: 'audio' },
  '.oga': { mime: 'audio/ogg', kind: 'audio' },
};

// Public URLs look like /uploads/<32 hex chars>.<ext>
const UPLOAD_URL_RE = /^\/uploads\/([a-f0-9]{32}(\.[a-z0-9]{1,10})?)$/;

function safeExt(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + safeExt(file.originalname)),
});

const upload = multer({ storage, limits: { fileSize: MAX_SIZE, files: 1 } });

// Build attachment info from a stored file. Used both after upload and to
// validate attachments sent with messages/stories (never trust client metadata).
function describeUpload(url, originalName) {
  const match = UPLOAD_URL_RE.exec(url || '');
  if (!match) return null;
  const filePath = path.join(UPLOAD_DIR, match[1]);
  if (!fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();
  const media = MEDIA_TYPES[ext];
  const name = String(originalName || match[1]).replace(/[\r\n"]/g, '').slice(0, 200) || match[1];
  return {
    url,
    name,
    mimeType: media?.mime || 'application/octet-stream',
    size: fs.statSync(filePath).size,
    kind: media?.kind || 'file', // image | video | audio | file
    isImage: media?.kind === 'image',
  };
}

// Delete a stored file (e.g. when its message or story is deleted)
function removeUpload(url) {
  const match = UPLOAD_URL_RE.exec(url || '');
  if (!match) return;
  fs.promises.unlink(path.join(UPLOAD_DIR, match[1])).catch(() => {});
}

// رفع ملف
// POST /api/upload (multipart/form-data, field "file") -> attachment info
router.post('/', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 50 MB)' : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded (use form field "file")' });
    }
    // Browsers send file names as latin1; convert so Arabic names survive
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    res.status(201).json(describeUpload('/uploads/' + req.file.filename, originalName));
  });
});

// Static serving with safe headers (express.static handles video range requests)
function serveUploads() {
  return express.static(UPLOAD_DIR, {
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const media = MEDIA_TYPES[path.extname(filePath).toLowerCase()];
      if (media) {
        res.setHeader('Content-Type', media.mime);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  });
}

module.exports = { router, serveUploads, describeUpload, removeUpload };
