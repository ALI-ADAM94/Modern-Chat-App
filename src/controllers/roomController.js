const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');

const createRoom = async (req, res) =>{
    try{
        const {name, description, isPrivate} = req.body;

        if(!name?.trim()){
            return res.status(400).json({error: 'Room name is required'});
        }

        const room = await Room.create({
            name: name.trim(),
            description: description?.trim(),
            isPrivate: isPrivate === true,
            createdBy : req.user._id,
            members: [req.user._id],
        })

        const populated = await Room.findById(room._id)
        .populate('createdBy', 'username displayName')

        res.status(201).json(populated);
    } catch (error) {
        console.error('Error creating room:', error);
        return res.status(500).json({error: 'Error occurred while creating room'});
    }
}

const getRooms = async (req, res) =>{
    try{
        // Direct (1-to-1) chats are listed under users, not rooms
        const rooms = await Room.find({ isDirect: { $ne: true } })
        .populate('createdBy', 'username displayName')
        .sort({ createdAt: -1 })
        .lean();

        res.json(rooms);
    } catch (error) {
        console.error('Error getting rooms:', error);
        return res.status(500).json({error: 'Error occurred while getting rooms'});
    }
}

const getRoomById = async (req, res) =>{
    try{
        const room = await Room.findById(req.params.id)
        .populate('createdBy', 'username displayName')
        .lean();

        if(!room){
            return res.status(404).json({error: 'Room not found'});
        }

        res.json(room);
    } catch (error) {
        console.error('Error getting room:', error);
        return res.status(500).json({error: 'Error occurred while getting room'});
    }
}
const getRoomMessages = async(req, res) =>{
    try{
        const roomId = req.params.id;

        // Only members may read private rooms and direct chats
        const room = await Room.findById(roomId).select('isPrivate isDirect members').lean();
        if(!room){
            return res.status(404).json({error: 'Room not found'});
        }
        const isMember = room.members?.some((m) => m.toString() === req.user._id.toString());
        if((room.isPrivate || room.isDirect) && !isMember){
            return res.status(403).json({error: 'Access denied'});
        }

        const limit = Math.min(parseInt(req.query.limit) || 50, 100)
        const skip = parseInt(req.query.skip) || 0;

        const messages = await Message.find({room: roomId})
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate('user', 'username displayName')
        .lean();

        res.json(messages);
    } catch (error) {
        console.error('Error getting room messages:', error);
        return res.status(500).json({error: 'Error occurred while getting room messages'});
    }
}


// فتح محادثة خاصة مع مستخدم
// POST /api/rooms/direct/:userId -> returns the 1-to-1 room with that user, creating it if needed
const getOrCreateDirectRoom = async (req, res) =>{
    try{
        const me = req.user._id;
        const otherId = req.params.userId;

        if(otherId === me.toString()){
            return res.status(400).json({error: 'You cannot chat with yourself'});
        }
        const other = await User.findById(otherId).select('_id');
        if(!other){
            return res.status(404).json({error: 'User not found'});
        }

        let room = await Room.findOne({
            isDirect: true,
            members: { $all: [me, other._id], $size: 2 },
        });

        if(!room){
            room = await Room.create({
                name: 'direct',
                isDirect: true,
                isPrivate: true,
                createdBy: me,
                members: [me, other._id],
            });
        }

        res.json(room);
    } catch (error) {
        console.error('Error opening direct chat:', error);
        return res.status(500).json({error: 'Error occurred while opening chat'});
    }
}

module.exports = {
    getOrCreateDirectRoom,
    createRoom,
    getRooms,
    getRoomById,
    getRoomMessages
}