const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { admin } = require('./config/firebase');

// Import routes and middleware
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const streamRoutes = require('./routes/streams');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// FFmpeg absolute path (from .env)
const FFMPEG_PATH = process.env.FFMPEG_PATH || "C:\\ffmpeg\\bin\\ffmpeg.exe";

// Global variables
let currentStreamProcess = null;
let streamStatus = "idle";
let currentStreamId = null;

// Middleware
app.use(cors());
app.use(express.json());

// Firestore database
const db = admin.firestore();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/streams', streamRoutes);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${timestamp}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp4|avi|mov|mkv|flv|wmv|webm)$/i;
    allowedTypes.test(file.originalname)
      ? cb(null, true)
      : cb(new Error("Invalid file type"));
  },
});

// Kill FFmpeg process
const killStreamProcess = () => {
  return new Promise((resolve) => {
    if (currentStreamProcess && !currentStreamProcess.killed) {
      currentStreamProcess.kill("SIGTERM");
      const forceKill = setTimeout(() => {
        if (!currentStreamProcess.killed) currentStreamProcess.kill("SIGKILL");
        resolve();
      }, 5000);
      currentStreamProcess.on("exit", () => {
        clearTimeout(forceKill);
        currentStreamProcess = null;
        resolve();
      });
    } else resolve();
  });
};

// Start FFmpeg streaming
const startFFmpegStream = (inputSource, streamUrl, streamKey, shouldLoop = false) => {
  return new Promise((resolve, reject) => {
    // Convert Windows backslashes to forward slashes for FFmpeg
    if (inputSource.startsWith("C:"))
      inputSource = inputSource.replace(/\\/g, "/");

    const rtmpUrl = `${streamUrl.replace(/\/?$/, "/")}${streamKey}`;
    
    let ffmpegArgs = ["-re"];
    
    // Add loop parameter if needed
    if (shouldLoop) {
      ffmpegArgs.push("-stream_loop", "-1");
    }
    
    ffmpegArgs = ffmpegArgs.concat([
      "-i",
      inputSource,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-maxrate",
      "3000k",
      "-bufsize",
      "6000k",
      "-pix_fmt",
      "yuv420p",
      "-g",
      "50",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-f",
      "flv",
      rtmpUrl,
    ]);

    console.log("Starting FFmpeg with args:", ffmpegArgs.join(" "));

    currentStreamProcess = spawn(FFMPEG_PATH, ffmpegArgs);

    let streamStarted = false;

    currentStreamProcess.stdout.on("data", (data) =>
      console.log(`FFmpeg stdout: ${data}`)
    );
    currentStreamProcess.stderr.on("data", (data) => {
      const output = data.toString();
      console.log(`FFmpeg stderr: ${output}`);
      if (
        !streamStarted &&
        (output.includes("Stream mapping:") ||
          output.includes("Press [q] to stop"))
      ) {
        streamStarted = true;
        streamStatus = "live";
        resolve();
      }
    });

    currentStreamProcess.on("error", (error) => {
      console.error("FFmpeg process error:", error);
      streamStatus = "error";
      currentStreamProcess = null;
      reject(error);
    });

    currentStreamProcess.on("exit", (code, signal) => {
      console.log(
        `FFmpeg process exited with code ${code} and signal ${signal}`
      );
      if (code === 0) streamStatus = "idle";
      else if (code !== null) streamStatus = "error";
      currentStreamProcess = null;
      if (!streamStarted && code !== 0)
        reject(new Error(`FFmpeg exited with code ${code}`));
    });

    setTimeout(() => {
      if (!streamStarted)
        reject(new Error("FFmpeg failed to start within timeout"));
    }, 30000);
  });
};

// Route: Start streaming
app.post('/api/go-live', auth, upload.single('videoFile'), async (req, res) => {
  try {
    const { streamUrl, streamKey, videoLink, loopVideo } = req.body;
    if (!streamUrl || !streamKey)
      return res.status(400).send("Stream URL and Stream Key are required");

    if (currentStreamProcess) await killStreamProcess();
    streamStatus = "starting";

    let inputSource;
    let videoSource;
    let videoPath;
    const shouldLoop = loopVideo === 'true' || loopVideo === true;

    if (req.file) {
      inputSource = req.file.path;
      videoSource = 'file';
      videoPath = req.file.path;
      console.log("Using uploaded file:", inputSource);
    } else if (videoLink) {
      inputSource = videoLink;
      videoSource = 'url';
      videoPath = videoLink;
      console.log("Using video URL:", inputSource);
    } else {
      return res
        .status(400)
        .send("Either video file or video link is required");
    }

    if (!streamUrl.includes("rtmp://"))
      return res.status(400).send("Invalid RTMP stream URL");

    // Create stream record in Firestore
    const streamData = {
      userId: req.user.uid,
      streamKey,
      streamUrl,
      videoSource,
      videoPath,
      loopVideo: shouldLoop,
      status: 'starting',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const streamRef = await db.collection('streams').add(streamData);
    currentStreamId = streamRef.id;

    try {
      await startFFmpegStream(inputSource, streamUrl, streamKey, shouldLoop);
      
      // Update stream status
      await db.collection('streams').doc(currentStreamId).update({
        status: 'live',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ message: "Stream started successfully", status: "live" });
    } catch (error) {
      console.error("Failed to start stream:", error);
      
      // Update stream with error
      await db.collection('streams').doc(currentStreamId).update({
        status: 'error',
        errorMessage: error.message,
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      streamStatus = "error";
      currentStreamId = null;
      res.status(500).send(`Failed to start stream: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in /api/go-live:", error);
    streamStatus = "error";
    res.status(500).send("Internal server error");
  }
});

// Route: Stop streaming
app.post('/api/stop', auth, async (req, res) => {
  try {
    streamStatus = "stopping";
    
    // Find and update active stream
    if (currentStreamId) {
      await db.collection('streams').doc(currentStreamId).update({
        status: 'stopping',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await killStreamProcess();
    streamStatus = "idle";

    // Update stream record
    if (currentStreamId) {
      const streamDoc = await db.collection('streams').doc(currentStreamId).get();
      if (streamDoc.exists) {
        const streamData = streamDoc.data();
        const startTime = streamData.startedAt?.toDate?.() || new Date();
        const endTime = new Date();
        const duration = Math.floor((endTime - startTime) / 1000);

        await db.collection('streams').doc(currentStreamId).update({
          status: 'stopped',
          endedAt: admin.firestore.FieldValue.serverTimestamp(),
          duration: duration,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      currentStreamId = null;
    }

    // Optional: cleanup old files
    try {
      const files = await fs.readdir(uploadsDir);
      const now = Date.now();
      const oneHourAgo = now - 3600 * 1000;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath);
          console.log("Cleaned up old file:", file);
        }
      }
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }

    res.json({ message: "Stream stopped successfully", status: "idle" });
  } catch (error) {
    console.error("Error stopping stream:", error);
    res.status(500).send("Failed to stop stream");
  }
});

// Route: Get stream status
app.get('/api/status', auth, (req, res) => {
  res.json({
    status: streamStatus,
    hasActiveProcess: !!currentStreamProcess
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), streamStatus });
});

// Multer error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE")
      return res.status(400).send("File too large. Max 2GB.");
    return res.status(400).send(`Upload error: ${error.message}`);
  }
  console.error("Unhandled error:", error);
  res.status(500).send("Internal server error");
});

// Graceful shutdown
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}. Shutting down...`);
    if (currentStreamProcess) await killStreamProcess();
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log("Upload directory:", uploadsDir);
});

module.exports = app;