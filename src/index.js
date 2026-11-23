require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const {Server} = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const Room = require('./models/Room');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const storyRoutes = require('./routes/stories');
const { router: uploadRoutes, serveUploads, describeUpload, removeUpload } = require('./routes/upload');

const app = express();
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});
const PORT = process.env.PORT || 3000;


mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));


app.use(cors());
app.use(express.json());

// Legacy single-file client: http://localhost:3000/client.html
app.use(express.static(path.join(__dirname, '..', 'frontend'), { index: false }));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stories', storyRoutes);

// الملفات المرفوعة
app.use('/uploads', serveUploads());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// React + shadcn/ui app (client/), built with `npm run build:client`
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
const CLIENT_INDEX = path.join(CLIENT_DIST, 'index.html');
app.use(express.static(CLIENT_DIST));
// Any other GET (not API / uploads) returns the app, so client-side pages load
app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res, next) => {
  if (!fs.existsSync(CLIENT_INDEX)) {
    return res.send('Chat API is running. Build the web app with "npm run build:client", or open /client.html');
  }
  res.sendFile(CLIENT_INDEX);
});
app.set('io', io);

const presence = require('./socket/presence');// تخزين اونلاين

// Members of direct chats, cached so typing events don't hit the DB on every key press
const directRoomMembers = new Map(); // roomId -> [userId, userId]
async function getDirectMembers(roomId) {
  if (directRoomMembers.has(roomId)) return directRoomMembers.get(roomId);
  const room = await Room.findById(roomId).select('isDirect members').lean();
  const members = room?.isDirect ? room.members.map(String) : null;
  directRoomMembers.set(roomId, members);
  return members;
}

// Send an event to everyone viewing the room, plus both people of a direct chat
async function emitToRoom(roomId, event, payload) {
  const members = await getDirectMembers(roomId);
  let target = io.to(roomId);
  if (members) target = target.to(members.map((m) => 'user:' + m));
  target.emit(event, payload);
}

const MESSAGE_USER_FIELDS = 'username displayName avatar';

// التحقق من التوكين قبل قبول الاتصال
// The client sends the token in `auth: { token }` (or `?token=` in the query).
// If it fails, the client receives a `connect_error` with the message.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if(!token){
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if(!user){
      return next(new Error('Authentication error: User not found'));
    }
    socket.data.userId = user._id.toString();
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: ' + error.message));
  }
});

io.on('connection', (socket)=>{
  const user = socket.data.user;
  console.log('User connected: ' + user.username);

  const userId = socket.data.userId;

  // Personal room: lets us reach every tab/device of this user (used for direct messages)
  socket.join('user:' + userId);

  // Tell this client who is online right now
  socket.emit('online-users', presence.onlineUserIds().concat(userId));

  // Tell everyone else this user came online (only on their first tab)
  if (presence.addConnection(userId)) {
    socket.broadcast.emit('user-online', { userId, username: user.username });
  }

  // الانضمام الى الغرف
  socket.on('join-room', async (data) =>{
    const roomId = data?.roomId;
    if(!roomId){
      socket.emit('error', 'Room ID is required to join a room');
      return;
    }

    try {
      const room = await Room.findById(roomId);
      if(!room){
        socket.emit('error', 'Room not found');
        return;
      }
      if(room.isPrivate || room.isDirect){
        const isMember = room.members?.some(
          (m) => m.toString() === socket.data.userId
        );
        if(!isMember){
          socket.emit('error', 'Access denied: You are not a member of this private room');
          return;
        }
      }
      await socket.join(roomId);
      socket.emit('joined-room', { roomId });
      console.log(`User ${user.username} joined room ${room.name}`);
    } catch (error) {
      socket.emit('error', 'Error occurred while joining room: ' + error.message);
    }
  })

  // مغادرة الغرفة
  socket.on('leave-room', (data) => {
    const roomId = data?.roomId;
    if(!roomId) return;
    socket.leave(roomId);
  })

  // ارسال رسالة (نص و/او ملف)
  socket.on('send-message', async (data) => {
    const { roomId } = data || {};
    const text = typeof data?.text === 'string' ? data.text.trim() : '';

    // Never trust attachment metadata from the client: rebuild it from the stored file
    let attachment = null;
    if (data?.attachment) {
      attachment = describeUpload(data.attachment.url, data.attachment.name);
      if (!attachment) {
        socket.emit('error', 'Invalid attachment');
        return;
      }
    }

    if(!roomId || (!text && !attachment)){
      socket.emit('error', 'Room ID and message text or a file are required');
      return;
    }
    if(!socket.rooms.has(roomId)){
      socket.emit('error', 'You must join the room before sending messages');
      return;
    }

    try {
      const message = await Message.create({
        room: roomId,
        user: userId,
        text,
        attachment,
      })

      const populated = await Message.findById(message._id)
      .populate('user', MESSAGE_USER_FIELDS)
      .lean();

      // In a direct chat this also reaches the other person's personal room,
      // so they get it (and an unread badge) even if the chat isn't open
      await emitToRoom(roomId, 'new-message', populated);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', 'Error occurred while sending message: ' + error.message);
    }
  })

  // Load a message and make sure the current user wrote it
  async function findOwnMessage(messageId) {
    if (!mongoose.isValidObjectId(messageId)) throw new Error('Invalid message ID');
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');
    if (message.user.toString() !== userId) throw new Error('You can only change your own messages');
    if (message.deleted) throw new Error('This message was deleted');
    return message;
  }

  // تعديل رسالة
  socket.on('edit-message', async (data) => {
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    try {
      const message = await findOwnMessage(data?.messageId);
      if (!text && !message.attachment) throw new Error('Message text is required');
      if (text === message.text) return;

      message.text = text;
      message.editedAt = new Date();
      await message.save();

      await emitToRoom(message.room.toString(), 'message-updated', {
        _id: message._id,
        room: message.room,
        text: message.text,
        editedAt: message.editedAt,
      });
    } catch (error) {
      socket.emit('error', 'Could not edit message: ' + error.message);
    }
  })

  // حذف رسالة (يظهر مكانها "تم حذف هذه الرسالة")
  socket.on('delete-message', async (data) => {
    try {
      const message = await findOwnMessage(data?.messageId);
      if (message.attachment) removeUpload(message.attachment.url);
      message.deleted = true;
      message.text = '';
      message.attachment = null;
      await message.save();

      await emitToRoom(message.room.toString(), 'message-deleted', {
        _id: message._id,
        room: message.room,
      });
    } catch (error) {
      socket.emit('error', 'Could not delete message: ' + error.message);
    }
  })

  // اشعار الكتابة / توقف الكتابة
  async function relayTyping(event, data) {
    const roomId = data?.roomId;
    if(!roomId || !socket.rooms.has(roomId)) return;
    const payload = { roomId, userId, username: user.username };

    // In direct chats send it to the other person's personal room, so they see
    // "typing..." in their chat list even when the chat isn't open
    const members = await getDirectMembers(roomId).catch(() => null);
    const others = (members || []).filter((m) => m !== userId).map((m) => 'user:' + m);
    socket.to(roomId).to(others).emit(event, payload);
  }

  socket.on('typing-start', (data) => relayTyping('user-typing', data));
  socket.on('typing-stop', (data) => relayTyping('user-stop-typing', data));

  socket.on('disconnect', async () => {
    console.log('user disconnected: ' + socket.id);
    // Only offline once the user's last tab/device has disconnected
    if (!presence.removeConnection(userId)) return;

    const lastSeen = new Date();
    io.emit('user-offline', { userId, lastSeen });
    try {
      await User.updateOne({ _id: userId }, { lastSeen });
    } catch (error) {
      console.error('Error saving lastSeen:', error);
    }
  })
})



server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
