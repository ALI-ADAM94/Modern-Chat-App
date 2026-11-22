const Room = require('../models/Room');
const Message = require('../models/Message');

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
        const rooms = await Room.find()
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


module.exports = {
    createRoom,
    getRooms,
    getRoomById,
    getRoomMessages
}