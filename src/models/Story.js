const mongoose = require('mongoose');

// القصص (مثل حالة واتساب) - تختفي بعد 24 ساعة
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

const storySchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type:{
        type: String,
        enum: ['image', 'video', 'link'],
        required: true
    },
    // For image/video stories: the uploaded file (/uploads/...)
    mediaUrl:{
        type: String,
        default: ''
    },
    // For link stories: an http(s) URL (Instagram, YouTube, TikTok, ...)
    link:{
        type: String,
        default: ''
    },
    caption:{
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
    },
    // Who has seen it
    viewers:[{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now },
        _id: false
    }],
    expiresAt:{
        type: Date,
        default: () => new Date(Date.now() + STORY_LIFETIME_MS),
        index: true
    }
}, {timestamps: true});

const Story = mongoose.model('Story', storySchema);

module.exports = Story;
