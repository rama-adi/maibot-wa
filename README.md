# Maimai WhatsApp Bot (MaiBot-WA)

A WhatsApp bot designed for the Maimai arcade rhythm game community, providing music information, game updates, and administrative tools through WhatsApp messaging.

## 🎮 Features

### 🎵 Music Information
- **Music Search**: Get detailed information about Maimai songs including:
  - Song title, artist, and version information
  - BPM and difficulty levels (Basic, Advanced, Expert, Master, Re:Master)
  - Chart types (DX/Standard) with internal level values
  - Regional availability (China, International, Japan)
  - Special U･TA･GE mode information with warnings

### 🚪 Gate Information
- **KALEID×SCOPE Gate Tracker**: Real-time information about gate conditions
  - Current unlock requirements based on days since release
  - Life requirements and difficulty progression
  - Detailed unlock conditions and course information
  - Support for all gate colors (Blue, White, Violet, Black, Yellow, Red)

### 🛠️ Administrative Features
- **Group Management**: Add/remove WhatsApp groups to whitelist
- **Admin Controls**: Admin-only commands for bot management
- **Rate Limiting**: Built-in message limits to prevent spam
- **Real-time Dashboard**: Web interface for monitoring and control

### 🔧 Technical Features
- **Fonnte Integration**: WhatsApp Business API integration
- **Database**: Drizzle ORM with SQLite for data persistence
- **Rate Limiting**: Per-user and per-group message limits
- **Live Logging**: Real-time bot activity monitoring
- **Docker Support**: Containerized deployment ready

## 📋 Prerequisites

- Node.js 18+ or Bun runtime
- Fonnte WhatsApp Business API account
- SQLite database
- Environment variables configuration

## 🚀 Quick Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd maibot-wa
```

### 2. Install Dependencies
```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# WhatsApp API Configuration
WHATSAPP_PHONE_NUMBER=your_phone_number
WHATSAPP_API_KEY=your_fonnte_api_key

# Security
SECRET_PATH=/your-secret-webhook-path
DASHBOARD_KEY=your_dashboard_password

# Optional: Database URL (defaults to local SQLite)
DATABASE_URL=file:./data/sqlite.db
```

### 4. Database Setup
```bash
# Run database migrations
bun run migrate
```

### 5. Start the Bot
```bash
# Development mode with hot reload
bun run dev

# Production mode
bun start
```

## 🐳 Docker Deployment

### Build and Run
```bash
# Build the Docker image
docker build -t maibot-wa .

# Run the container
docker run -p 3000:3000 \
  -e WHATSAPP_PHONE_NUMBER=your_phone_number \
  -e WHATSAPP_API_KEY=your_fonnte_api_key \
  -e SECRET_PATH=/your-secret-webhook-path \
  -e DASHBOARD_KEY=your_dashboard_password \
  maibot-wa
```

### Docker Compose
```yaml
version: '3.8'
services:
  maibot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - WHATSAPP_PHONE_NUMBER=your_phone_number
      - WHATSAPP_API_KEY=your_fonnte_api_key
      - SECRET_PATH=/your-secret-webhook-path
      - DASHBOARD_KEY=your_dashboard_password
    volumes:
      - ./data:/usr/src/app/data
```

## 💬 Usage

### Direct Messages
Send commands directly to the bot:
```
music folern
gateinfo blue
help
```

### Group Messages
Tag the bot in groups (requires group whitelist):
```
@BotName music tsunagite
@BotName gateinfo
@BotName help
```

### Available Commands

| Command | Description | Example | Access |
|---------|-------------|---------|---------|
| `help` | Show available commands and usage | `help` | Public |
| `music <query>` | Search for song information | `music folern` | Public |
| `gateinfo [gate]` | Get gate unlock information | `gateinfo blue` | Public |
| `addgroup` | Add current group to whitelist | `addgroup` | Admin only |
| `addadmin <number>` | Add user as admin | `addadmin 628123456789` | Admin only |

## 🌐 Dashboard

Access the web dashboard at `http://localhost:3000/dashboard` for:
- Real-time bot activity monitoring
- Command execution interface
- Live log streaming
- Administrative controls

## 📊 Rate Limits

- **Individual users**: 100 messages per day
- **Groups**: 1000 messages per day
- **Admin commands**: Rate limit exempt

## 🔧 Configuration

### Database Schema
The bot uses SQLite with Drizzle ORM. Main tables include:
- `songs`: Maimai song database with difficulty charts
- `allowedGroups`: Whitelisted WhatsApp groups
- `admins`: Bot administrators

### Command System
Commands are modular and located in `src/handlers/`. Each command implements:
- Name and description
- Admin-only flag
- Availability (DM/Group/Both)
- Execution logic

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues, questions, or feature requests:
1. Check existing GitHub issues
2. Create a new issue with detailed information
3. Contact the maintainer for urgent matters

## 🔄 Updates

The bot automatically syncs with the latest Maimai game data and gate information. Database migrations handle schema updates seamlessly.

---

Built with ❤️ for the Maimai community using Bun, TypeScript, and Drizzle ORM.
