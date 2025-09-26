const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  streamKey: {
    type: String,
    required: true
  },
  streamUrl: {
    type: String,
    required: true
  },
  videoSource: {
    type: String, // 'file' or 'url'
    required: true
  },
  videoPath: {
    type: String // file path or URL
  },
  status: {
    type: String,
    enum: ['starting', 'live', 'stopping', 'stopped', 'error'],
    default: 'starting'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  duration: {
    type: Number // in seconds
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Calculate duration when stream ends
streamSchema.pre('save', function(next) {
  if (this.endedAt && this.startedAt && !this.duration) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  next();
});

module.exports = mongoose.model('Stream', streamSchema);