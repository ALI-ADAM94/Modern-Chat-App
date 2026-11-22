require('dotenv').config();
const http = require('http');
const path = require('path');
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

// Serve the frontend: http://localhost:3000/client.html
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
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

  // ارسال رسالة
  socket.on('send-message', async (data) => {
    const { roomId, text } = data || {};
    if(!roomId || !text?.trim()){
      socket.emit('error', 'Room ID and message text are required');
      return;
    }
    if(!socket.rooms.has(roomId)){
      socket.emit('error', 'You must join the room before sending messages');
      return;
    }

    try {
      const message = await Message.create({
        room: roomId,
        user: socket.data.userId,
        text: text.trim(),
      })

      const populated = await Message.findById(message._id)
      .populate('user', 'username displayName')
      .lean();

      // In a direct chat, also deliver to both users' personal rooms so the
      // other person gets it (and an unread badge) even if the chat isn't open
      const members = await getDirectMembers(roomId);
      let target = io.to(roomId);
      if (members) target = target.to(members.map((m) => 'user:' + m));
      target.emit('new-message', populated);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', 'Error occurred while sending message: ' + error.message);
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
