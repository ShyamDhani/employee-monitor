# Employee Monitor - Complete Setup Script

## Prerequisites
- Node.js 20+ installed
- MongoDB installed locally or Docker installed
- Android Studio installed (for Android app)
- Git installed

## Quick Start

### 1. Install MongoDB (if not using Docker)

**Windows:**
1. Download MongoDB Community from https://www.mongodb.com/try/download/community
2. Install with default settings
3. Start the MongoDB service

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Linux (Ubuntu):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### 3. Setup Web Dashboard

```bash
cd web-dashboard
npm install
npm run dev
```

### 4. Setup Android App

1. Open Android Studio
2. Open project: `android-app/`
3. Sync Gradle
4. Connect Android device or start emulator
5. Run the app

### 5. Docker Setup (Alternative)

```bash
docker-compose up -d
```

## ngrok Static URL Setup (IMPORTANT)

ngrok gives your dashboard a **permanent public URL** so Android devices on any network can send data to it.

### Step 1: Create ngrok Account
1. Go to https://ngrok.com/signup and create a free account
2. Go to https://dashboard.ngrok.com/get-started/your-authtoken and copy your authtoken

### Step 2: Claim Free Static Domain
1. Go to https://dashboard.ngrok.com/domains
2. Click "New Domain" and claim a free static domain (e.g., `yourname.ngrok-free.app`)
3. Note down your domain name

### Step 3: Configure
1. Edit `.env.ngrok`:
   ```
   NGROK_AUTHTOKEN=your_actual_authtoken_here
   NGROK_DOMAIN=your-chosen-domain.ngrok-free.app
   ```
2. Edit `android-app/app/src/main/java/com/employeemonitor/DeviceConfig.kt`:
   ```kotlin
   val SERVER_URL: String = "https://your-chosen-domain.ngrok-free.app"
   ```
3. Run: `start.bat`

### Step 4: Verify
1. Open ngrok inspector: http://localhost:4040
2. Open dashboard: https://your-chosen-domain.ngrok-free.app
3. Install APK on Android device - it will auto-connect to the static URL

## Configuration

### Backend (.env)
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/employee_monitor
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CLIENT_URL=http://localhost:5173
```

### Google OAuth Setup
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: http://localhost:3000/api/auth/google/callback
6. Copy Client ID and Client Secret to .env

## Default Login
- Email: admin@example.com
- Password: admin123

## API Endpoints

### Authentication
- POST /api/auth/login - Login with email/password
- POST /api/auth/register - Register new user
- GET /api/auth/me - Get current user
- GET /api/auth/google - Google SSO login

### Employees
- GET /api/employees - List all employees
- POST /api/employees/register - Register employee device
- GET /api/employees/:id - Get employee details
- PUT /api/employees/:id - Update employee
- DELETE /api/employees/:id - Delete employee

### Activity
- POST /api/activity/upload - Upload activity data
- POST /api/activity/batch - Upload activity batch
- GET /api/activity - Get activities
- GET /api/activity/timeline - Get timeline data
- GET /api/activity/summary - Get app usage summary

### Screenshots
- POST /api/screenshot/upload - Upload screenshot
- GET /api/screenshot - Get screenshots
- GET /api/screenshot/:id - Get screenshot
- POST /api/screenshot/:id/annotate - Add annotation
- DELETE /api/screenshot/:id - Delete screenshot

### Reports
- GET /api/reports/daily - Daily report
- GET /api/reports/weekly - Weekly report
- GET /api/reports/productivity - Productivity report
- GET /api/reports/employee/:id - Employee stats

## WebSocket Events

### Client -> Server
- register - Register employee device
- activity - Send activity data
- screenshot - Send screenshot data
- heartbeat - Send heartbeat

### Server -> Client
- activity:realtime - Real-time activity feed
- screenshot:new - New screenshot available
- employee:online - Employee came online
- employee:offline - Employee went offline
- command - Remote command execution

## Android App Permissions
The Android app requires the following permissions:
- Usage Stats (PACKAGE_USAGE_STATS)
- Accessibility Service
- Overlay Permission (SYSTEM_ALERT_WINDOW)
- Location (optional)
- Camera (optional)
- Microphone (optional)
- Storage
- Network
- USB (optional)

## Security Notes
1. Change JWT_SECRET in production
2. Use HTTPS in production
3. Enable MongoDB authentication
4. Configure firewall rules
5. Regular database backups
6. Enable data encryption

## Troubleshooting

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod
```

### Android App Not Connecting
1. Ensure device is on same network as server
2. Check server URL in app settings
3. Verify firewall allows connections on port 3000

### WebSocket Connection Issues
1. Check if backend server is running
2. Verify CORS settings
3. Check network connectivity

## License
MIT License
