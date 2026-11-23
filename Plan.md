# Modern Chat App — Project Plan

A real-time chat app (like WhatsApp) built with **Node.js, Express 5, Socket.IO 4 and MongoDB (Mongoose)**, with a single-page web client in `frontend/client.html`.

- **Run:** `npm run dev`, then open http://localhost:3000/client.html
- **Repo:** https://github.com/ALI-ADAM94/Modern-Chat-App (branch `main`)
- **Config (`.env`, never committed):** `PORT`, `MONGO_URI`, `JWT_SECRET`

---

## 1. Goals / الأهداف

1. Private and group chat in real time.
2. Feel like a modern messenger: live online status, typing, unread badges, stories, media.
3. Secure by default: JWT auth, members-only private chats, safe file handling.
4. Simple to run: one backend and one HTML page, no build step.

---

## 2. Roadmap

### ✅ Phase 1: Core chat (done)
- [x] Register / login with JWT (bcrypt passwords)
- [x] Group rooms (public and private), create rooms
- [x] Real-time messages over Socket.IO, message history
- [x] Typing indicator

### ✅ Phase 2: Messenger experience (done)
- [x] WhatsApp-style user list with live **Online / last seen / typing...**
- [x] 1-to-1 direct chats with unread badges
- [x] Multi-tab presence (offline only when the last tab closes)
- [x] Search users (name, username, about) with highlighting; search rooms

### ✅ Phase 3: Messages & media (done)
- [x] Edit and delete your own messages (live for everyone)
- [x] Send files, images, videos and audio (max 50 MB): paste, drag & drop, or 📎
- [x] File viewer: images (zoom), video and audio players, PDF and text preview
- [x] Emoji picker with categories and recently used emojis

### ✅ Phase 4: Profile & stories (done)
- [x] Account settings dashboard: photo, display name, username, email, about, password
- [x] Profile changes appear live for other users
- [x] **Stories**: photo, video or social media link, visible for 24 hours, with seen/unseen rings, a view counter and a viewer list for the owner, and delete

### 🔜 Phase 5: Next ideas
- [ ] Read receipts (✓✓) and delivered status
- [ ] Message reactions and replies (quote a message)
- [ ] Voice notes recorded in the browser
- [ ] Manage members of private rooms (invite / remove)
- [ ] Push / browser notifications for new messages
- [ ] Story replies (reply to a story in a direct chat)
- [ ] Rate limiting and input sanitizing middleware
- [ ] Automated tests (Jest + supertest + socket.io-client)
- [ ] Deployment (Render / Railway + MongoDB Atlas) and CI on GitHub Actions
- [ ] Move uploads to cloud storage (S3 / Cloudinary)

---

## 3. Project structure

```
src/
  index.js              Express app, Socket.IO auth + events
  middleware/auth.js    JWT "Bearer" auth for REST routes
  models/               User, Room, Message, Story
  controllers/          auth + rooms logic
  routes/               auth, rooms, users, upload, stories
  socket/presence.js    who is online (counts tabs per user)
frontend/client.html    the whole web client (login, chats, rooms, stories, settings)
uploads/                uploaded files (git-ignored)
```

---

## 4. REST API

Auth = header `Authorization: Bearer <token>`

### Auth
- `POST /api/auth/register` - {username, email, password}
- `POST /api/auth/login` - {email, password} => {token, user}

### Rooms
- `GET /api/rooms` (Auth) - group rooms (direct chats are not listed)
- `POST /api/rooms` (Auth) - {name, description?, isPrivate} (the creator becomes a member)
- `GET /api/rooms/:id` (Auth) - room details
- `GET /api/rooms/:id/messages` (Auth) - ?limit=50&skip=0, newest first; private rooms are members only
- `POST /api/rooms/direct/:userId` (Auth) - open or create a 1-to-1 chat => room

### Users & account / الحساب
- `GET /api/users` (Auth) - ?search=ali => [{_id, username, displayName, avatar, about, lastSeen, online}]
- `GET /api/users/me` (Auth) - my profile
- `PATCH /api/users/me` (Auth) - {displayName?, username?, email?, about?, avatar?} (avatar = url from /api/upload, or "" to remove)
- `PATCH /api/users/me/password` (Auth) - {currentPassword, newPassword}

### Uploads / الملفات
- `POST /api/upload` (Auth) - multipart/form-data, field "file", max 50 MB => {url, name, mimeType, size, kind, isImage}
  - `kind`: `image` (png, jpg, gif, webp), `video` (mp4, webm, ogv, mov), `audio` (mp3, wav, m4a, ogg), or `file`
- `GET /uploads/<file>` - images, videos and audio are served inline; every other file is a download (so an uploaded file can never run scripts)

### Stories / القصص (24 hours)
- `GET /api/stories` (Auth) => [{user, stories: [{_id, type, mediaUrl, link, caption, createdAt, expiresAt, seen, viewCount, viewers?}], allSeen}] (mine first, then unseen)
- `POST /api/stories` (Auth) - {type: "image" | "video", mediaUrl, caption?} or {type: "link", link, caption?} (link must be http/https)
- `POST /api/stories/:id/view` (Auth) - mark as seen
- `DELETE /api/stories/:id` (Auth) - owner only (also deletes the file)

---

## 5. Socket.IO events

Connect with `io(url, { auth: { token } })`. A wrong token gives `connect_error`.

### Client → server
- `join-room` - {roomId} => the server replies `joined-room` {roomId}
- `leave-room` - {roomId}
- `send-message` - {roomId, text?, attachment?} (attachment = the response from /api/upload; you must have joined the room)
- `edit-message` - {messageId, text} (author only)
- `delete-message` - {messageId} (author only)
- `typing-start` / `typing-stop` - {roomId}

### Server → client
- `joined-room` - {roomId}
- `new-message` - {_id, room, text, attachment, editedAt, deleted, createdAt, user {_id, username, displayName, avatar}}
- `message-updated` - {_id, room, text, editedAt}
- `message-deleted` - {_id, room}
- `user-typing` / `user-stop-typing` - {roomId, userId, username}
- `online-users` - [userId] (sent once, on connect)
- `user-online` - {userId, username}
- `user-offline` - {userId, lastSeen}
- `user-updated` - {_id, username, displayName, avatar, about} (profile changed)
- `story-added` / `story-deleted` - {userId, storyId}
- `story-viewed` - {storyId, viewCount} (only to the story's owner)
- `error` - error text

---

## 6. Security notes

- Passwords hashed with bcrypt; JWT expires after 7 days.
- Private rooms and direct chats: only members can join or read history.
- Only the author can edit or delete a message, and the server checks this.
- Uploads get random file names. Only known image, video and audio types are served inline, and the server rebuilds attachment info itself instead of trusting the client.
- Story links must be `http(s)`, so `javascript:` links are rejected.
- `.env`, `node_modules/` and `uploads/` are git-ignored.
