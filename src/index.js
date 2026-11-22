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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.set('io', io);

const onlineUsers = new Set();// تخزين اونلاين

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

  onlineUsers.add(socket.data.userId);
  io.emit('user-online', { userId: socket.data.userId, username: user.username });

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
      if(room.isPrivate){
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

      io.to(roomId).emit('new-message', populated);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', 'Error occurred while sending message: ' + error.message);
    }
  })

  // اشعار الكتابة
  socket.on('typing-start', (data)=>{
    const roomId = data?.roomId;
    if(!roomId) return;
    socket.to(roomId).emit('user-typing',{
      userId: socket.data.userId,
      username: user.username,
    })
  })


  // اشعار توقف الكتابة
  socket.on('typing-stop', (data)=>{
    const roomId = data?.roomId;
    if(!roomId) return;
    socket.to(roomId).emit('user-stop-typing',{
      userId: socket.data.userId,
      username: user.username,
    })
  })

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.data.userId);
    io.emit('user-offline', { userId: socket.data.userId });
    console.log('user disconnected: ' + socket.id);
  })
})



server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
