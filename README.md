# Riff Music

A modern web-based sheet music viewer and library application with MIDI playback support. Upload, view, edit, and play back MusicXML files with an interactive piano keyboard and real-time note highlighting.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### 🎵 Music Viewing
- **Interactive Sheet Music Rendering** - Powered by Verovio WASM engine
- **MIDI Playback** - Real-time audio synthesis with Tone.js
- **Visual Highlighting** - Notes and measures highlighted during playback
- **Auto-scroll** - Sheet music automatically scrolls to follow playback
- **Interactive Piano** - Visual keyboard that highlights notes on click or during playback

### 📚 Library Management
- **Upload MusicXML Files** - Support for `.musicxml`, `.xml`, and `.mxl` formats
- **Bulk Upload** - Upload multiple files at once
- **Load from URL** - Import MusicXML from any web URL
- **Drag & Drop** - Intuitive file upload via drag and drop
- **Album Covers** - Add custom album images to your scores
- **Metadata Editing** - Edit title, composer, arranger, and album information
- **Public Sharing** - Publish scores to a common library for others to view

### 🔐 Authentication
- **Email/Password Registration** - Secure account creation with email verification
- **Google OAuth** - One-click sign-in with Google
- **Session Management** - Secure session handling with automatic renewal

### 🎨 User Experience
- **Dark/Light Theme** - Toggle between themes with localStorage persistence
- **Progressive Web App (PWA)** - Install as a native app on any device
- **Responsive Design** - Works seamlessly on desktop and mobile
- **No Framework Bloat** - Built with vanilla TypeScript for fast loading

## Tech Stack

### Frontend
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **Verovio** - WASM-based music notation rendering
- **Tone.js** - Audio synthesis and MIDI playback
- **Custom Router** - Lightweight hash-based navigation

### Backend
- **Cloudflare Workers** - Edge computing platform
- **Hono** - Fast web framework for Workers
- **Cloudflare D1** - Serverless SQLite database
- **Cloudflare Email Workers** - Email verification service

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account (for deployment)
- Google OAuth credentials (optional, for Google sign-in)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/riff-music.git
cd riff-music
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create D1 database
wrangler d1 create sheet-music-db

# Update wrangler.toml with your database_id

# Apply schema
wrangler d1 execute sheet-music-db --file=./schema.sql
```

4. Configure environment variables in `wrangler.toml`:
```toml
[vars]
GOOGLE_CLIENT_ID = "your-google-client-id"
APP_URL = "http://localhost:8787"
```

5. Set secrets:
```bash
wrangler secret put GOOGLE_CLIENT_SECRET
```

### Development

Start the development server:
```bash
npm run dev
```

This will build the frontend and start the Cloudflare Workers development server at `http://localhost:8787`.

For frontend-only development:
```bash
npm run dev:frontend
```

### Deployment

Build and deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Project Structure

```
riff-music/
├── public/              # Static assets
│   ├── favicon.png
│   ├── logo.svg
│   ├── manifest.json   # PWA manifest
│   └── sw.js           # Service worker
├── src/
│   ├── pages/          # Page components
│   │   ├── library.ts  # Score library view
│   │   ├── login.ts    # Authentication page
│   │   └── viewer.ts   # Sheet music viewer
│   ├── api.ts          # Frontend API client
│   ├── audio-player.ts # Audio synthesis
│   ├── main.ts         # Application entry point
│   ├── midi-playback.ts # MIDI playback controller
│   ├── music-xml-loader.ts # MusicXML file handling
│   ├── note-data.ts    # Note information utilities
│   ├── piano-keyboard.ts # Virtual piano component
│   ├── router.ts       # Client-side routing
│   ├── sheet-renderer.ts # Verovio integration
│   ├── style.css       # Application styles
│   ├── verovio-init.ts # Verovio initialization
│   └── worker.ts       # Cloudflare Worker (backend)
├── index.html
├── schema.sql          # Database schema
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml       # Cloudflare Workers config
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in with email/password
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/verify` - Verify email address

### Scores
- `GET /api/scores` - Get user's scores
- `POST /api/scores` - Create new score
- `GET /api/scores/:id` - Get score by ID
- `PUT /api/scores/:id` - Update score
- `DELETE /api/scores/:id` - Delete score
- `GET /api/scores/public` - Get public scores
- `POST /api/scores/:id/publish` - Make score public
- `POST /api/scores/:id/unpublish` - Make score private

## Security

- **Password Hashing** - PBKDF2 with 100,000 iterations and random salt
- **Session Management** - HttpOnly cookies with secure flag in production
- **CSRF Protection** - State tokens for OAuth flows
- **SQL Injection Prevention** - Parameterized queries with field whitelisting
- **Email Verification** - Required before account activation

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Verovio](https://www.verovio.org/) - Music notation rendering engine
- [Tone.js](https://tonejs.github.io/) - Web Audio framework
- [Hono](https://hono.dev/) - Lightweight web framework
- [Cloudflare](https://www.cloudflare.com/) - Edge computing platform

## Support

For issues and questions, please open an issue on GitHub.
