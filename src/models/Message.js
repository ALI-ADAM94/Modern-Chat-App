const mongoose = require('mongoose');

// ملف مرفق (صورة أو ملف)
const attachmentSchema = new mongoose.Schema({
    url: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ['image', 'video', 'audio', 'file'], default: 'file' },
    isImage: { type: Boolean, default: false },
}, { _id: false });

const messageSchema = new mongoose.Schema({
    room :{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text:{
        type: String,
        trim: true,
        maxlength: 5000,
        default: ''
    },
    attachment:{
        type: attachmentSchema,
        default: null
    },
    // تعديل الرسالة
    editedAt:{
        type: Date,
        default: null
    },
    // حذف الرسالة (يبقى مكانها "تم حذف هذه الرسالة")
    deleted:{
        type: Boolean,
        default: false
    }
}, {timestamps: true});

// A message needs text or an attachment (unless it was deleted)
messageSchema.pre('validate', function () {
    if (!this.deleted && !this.text && !this.attachment) {
        this.invalidate('text', 'Message text or attachment is required');
    }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
