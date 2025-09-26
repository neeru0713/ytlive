const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes and middleware
const authRoutes = require('./routes/auth');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Global variable to track the current FFmpeg process
let currentStreamProcess = null;
let streamStatus = 'idle';

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/youtube-streaming', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp4|avi|mov|mkv|flv|wmv|webm)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a video file.'));
    }
  }
});

// Utility function to kill FFmpeg process
const killStreamProcess = () => {
  return new Promise((resolve) => {
    if (currentStreamProcess && !currentStreamProcess.killed) {
      currentStreamProcess.kill('SIGTERM');
      
      // Force kill if process doesn't terminate within 5 seconds
      const forceKill = setTimeout(() => {
        if (currentStreamProcess && !currentStreamProcess.killed) {
          currentStreamProcess.kill('SIGKILL');
        }
        resolve();
      }, 5000);
      
      currentStreamProcess.on('exit', () => {
        clearTimeout(forceKill);
        currentStreamProcess = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
};

// Utility function to start FFmpeg streaming
const startFFmpegStream = (inputSource, streamUrl, streamKey) => {
  return new Promise((resolve, reject) => {
    const rtmpUrl = `${streamUrl}${streamKey}`;
    
    // FFmpeg command optimized for YouTube streaming
    const ffmpegArgs = [
      '-re',                          // Read input at native frame rate
      '-i', inputSource,              // Input source
      '-c:v', 'libx264',             // Video codec
      '-preset', 'veryfast',         // Encoding speed
      '-maxrate', '3000k',           // Maximum bitrate
      '-bufsize', '6000k',           // Buffer size
      '-pix_fmt', 'yuv420p',         // Pixel format for compatibility
      '-g', '50',                    // Keyframe interval
      '-c:a', 'aac',                 // Audio codec
      '-b:a', '128k',                // Audio bitrate
      '-ac', '2',                    // Audio channels
      '-ar', '44100',                // Audio sample rate
      '-f', 'flv',                   // Output format for RTMP
      rtmpUrl                        // RTMP destination
    ];

    console.log('Starting FFmpeg with args:', ffmpegArgs.join(' '));
    
    currentStreamProcess = spawn('ffmpeg', ffmpegArgs);
    
    let streamStarted = false;
    
    currentStreamProcess.stdout.on('data', (data) => {
      console.log(`FFmpeg stdout: ${data}`);
    });
    
    currentStreamProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`FFmpeg stderr: ${output}`);
      
      // Check for stream start indicators
      if (!streamStarted && (output.includes('Stream mapping:') || output.includes('Press [q] to stop'))) {
        streamStarted = true;
        streamStatus = 'live';
        resolve();
      }
    });
    
    currentStreamProcess.on('error', (error) => {
      console.error('FFmpeg process error:', error);
      streamStatus = 'error';
      currentStreamProcess = null;
      reject(error);
    });
    
    currentStreamProcess.on('exit', (code, signal) => {
      console.log(`FFmpeg process exited with code ${code} and signal ${signal}`);
      
      if (code === 0) {
        streamStatus = 'idle';
      } else if (code !== null) {
        streamStatus = 'error';
      }
      
      currentStreamProcess = null;
      
      if (!streamStarted && code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    // Timeout in case FFmpeg doesn't start properly
    setTimeout(() => {
      if (!streamStarted) {
        reject(new Error('FFmpeg failed to start within timeout period'));
      }
    }, 30000);
  });
};

// Route: Start streaming
app.post('/api/go-live', auth, upload.single('videoFile'), async (req, res) => {
  try {
    const { streamUrl, streamKey, videoLink } = req.body;
    
    if (!streamUrl || !streamKey) {
      return res.status(400).send('Stream URL and Stream Key are required');
    }
    
    // Stop any existing stream
    if (currentStreamProcess) {
      await killStreamProcess();
    }
    
    streamStatus = 'starting';
    
    let inputSource;
    
    if (req.file) {
      // Use uploaded file
      inputSource = req.file.path;
      console.log('Using uploaded file:', inputSource);
    } else if (videoLink) {
      // Use video URL
      inputSource = videoLink;
      console.log('Using video URL:', inputSource);
    } else {
      return res.status(400).send('Either video file or video link is required');
    }
    
    // Validate stream URL format
    if (!streamUrl.includes('rtmp://')) {
      return res.status(400).send('Invalid RTMP stream URL');
    }
    
    try {
      await startFFmpegStream(inputSource, streamUrl, streamKey);
      res.json({ 
        message: 'Stream started successfully',
        status: 'live'
      });
    } catch (error) {
      console.error('Failed to start stream:', error);
      streamStatus = 'error';
      res.status(500).send(`Failed to start stream: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error in /api/go-live:', error);
    streamStatus = 'error';
    res.status(500).send('Internal server error');
  }
});

// Route: Stop streaming
app.post('/api/stop', auth, async (req, res) => {
  try {
    streamStatus = 'stopping';
    await killStreamProcess();
    streamStatus = 'idle';
    
    // Clean up old uploaded files (optional)
    try {
      const files = await fs.readdir(uploadsDir);
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath);
          console.log('Cleaned up old file:', file);
        }
      }
    } catch (cleanupError) {
      console.error('Error cleaning up files:', cleanupError);
    }
    
    res.json({ 
      message: 'Stream stopped successfully',
      status: 'idle'
    });
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).send('Failed to stop stream');
  }
});

// Route: Get stream status
app.get('/api/status', auth, (req, res) => {
  res.json({
    status: streamStatus,
    hasActiveProcess: !!currentStreamProcess
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    streamStatus: streamStatus
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('File too large. Maximum size is 2GB.');
    }
    return res.status(400).send(`Upload error: ${error.message}`);
  }
  
  console.error('Unhandled error:', error);
  res.status(500).send('Internal server error');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Gracefully shutting down...');
  
  if (currentStreamProcess) {
    console.log('Stopping active stream...');
    await killStreamProcess();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Gracefully shutting down...');
  
  if (currentStreamProcess) {
    console.log('Stopping active stream...');
    await killStreamProcess();
  }
  
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Upload directory:', uploadsDir);
});

module.exports = app;