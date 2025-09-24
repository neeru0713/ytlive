# YouTube Live Streaming Application

A full-stack web application that enables live streaming to YouTube using FFmpeg. Upload videos or provide video URLs and stream them directly to your YouTube channel.

## Features

- 🎥 **Video Upload & URL Support**: Upload video files or stream from URLs
- 📡 **Real-time Streaming**: FFmpeg integration for professional streaming
- 🎛️ **Stream Management**: Start, stop, and monitor streaming status
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔒 **Secure File Handling**: Large file upload support with automatic cleanup
- ⚡ **Real-time Status Updates**: Live streaming status and progress tracking

## Prerequisites

Before running this application, ensure you have:

- **Node.js** (v14 or higher)
- **FFmpeg** installed and accessible in PATH
- **YouTube Stream Key** from YouTube Studio

### Installing FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from [FFmpeg official website](https://ffmpeg.org/download.html) and add to PATH.

## Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd youtube-streaming-app
```

2. **Install dependencies:**
```bash
npm install
cd server && npm install && cd ..
```

3. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Usage

1. **Start the application:**
```bash
npm run dev
```

This will start both the frontend (Vite) and backend (Express) servers concurrently.

2. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

3. **Get your YouTube Stream Key:**
   - Go to [YouTube Studio](https://studio.youtube.com)
   - Navigate to "Create" → "Go Live"
   - Copy your stream key

4. **Start Streaming:**
   - Enter your stream key
   - Upload a video file or provide a video URL
   - Click "Go Live"
   - Monitor the streaming status

## API Endpoints

### POST /api/go-live
Start a new stream.

**Body (multipart/form-data):**
- `streamUrl`: RTMP stream URL (default: rtmp://a.rtmp.youtube.com/live2/)
- `streamKey`: YouTube stream key
- `videoFile`: Video file to upload (optional)
- `videoLink`: Video URL (optional, if no file uploaded)

**Response:**
```json
{
  "message": "Stream started successfully",
  "status": "live"
}
```

### POST /api/stop
Stop the current stream.

**Response:**
```json
{
  "message": "Stream stopped successfully", 
  "status": "idle"
}
```

### GET /api/status
Get current streaming status.

**Response:**
```json
{
  "status": "live",
  "hasActiveProcess": true
}
```

### GET /api/health
Health check endpoint.

## Deployment

### VPS Deployment with Nginx

1. **Install dependencies on your VPS:**
```bash
sudo apt update
sudo apt install nodejs npm nginx ffmpeg
```

2. **Clone and setup the application:**
```bash
git clone <repository-url>
cd youtube-streaming-app
npm install
cd server && npm install && cd ..
```

3. **Build the frontend:**
```bash
npm run build
```

4. **Configure Nginx:**
Create `/etc/nginx/sites-available/streaming-app`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/youtube-streaming-app/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for large file uploads
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }

    # Increase max file upload size
    client_max_body_size 2G;
}
```

5. **Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/streaming-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

6. **Setup SSL with Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

7. **Create systemd service for the backend:**
Create `/etc/systemd/system/streaming-app.service`:

```ini
[Unit]
Description=YouTube Streaming App Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/youtube-streaming-app/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

8. **Start the service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable streaming-app
sudo systemctl start streaming-app
```

## Configuration

### Environment Variables

- `PORT`: Backend server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `UPLOAD_DIR`: Directory for uploaded files
- `MAX_FILE_SIZE`: Maximum file upload size in bytes
- `FFMPEG_PATH`: Path to FFmpeg binary (optional)

### FFmpeg Settings

The application uses optimized FFmpeg settings for YouTube streaming:

- **Video Codec**: H.264 (libx264)
- **Video Bitrate**: Up to 3000k
- **Audio Codec**: AAC
- **Audio Bitrate**: 128k
- **Format**: FLV for RTMP

## Troubleshooting

### Common Issues

1. **FFmpeg not found:**
   - Ensure FFmpeg is installed and in PATH
   - Set `FFMPEG_PATH` environment variable if needed

2. **Large file upload failures:**
   - Check Nginx `client_max_body_size` setting
   - Verify disk space available

3. **Stream not starting:**
   - Verify YouTube stream key is correct
   - Check if stream is enabled in YouTube Studio
   - Monitor server logs for FFmpeg errors

4. **Permission errors:**
   - Ensure upload directory is writable
   - Check file permissions on the server

### Logs

- Backend logs: Check console output or systemd logs
- Nginx logs: `/var/log/nginx/error.log`
- FFmpeg output: Logged to console

## Security Considerations

- **File Upload Validation**: Only video files are accepted
- **File Size Limits**: 2GB maximum upload size
- **Automatic Cleanup**: Old uploaded files are automatically removed
- **Stream Key Security**: Stream keys are handled as passwords
- **Process Management**: Proper cleanup of FFmpeg processes

## Performance Optimization

- **File Cleanup**: Automatic removal of old uploaded files
- **Process Management**: Efficient FFmpeg process handling
- **Buffer Settings**: Optimized for streaming performance
- **Compression**: Frontend assets are optimized for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and support:
1. Check the troubleshooting section
2. Review server logs
3. Open an issue on GitHub

---

**Note**: This application requires a valid YouTube channel and stream key to function. Ensure you have the necessary permissions and comply with YouTube's terms of service.# ytlive
