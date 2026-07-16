# YESUBASS V2 - Professional Discord Music Bot

YESUBASS V2 is a high-performance, fully-featured Discord music bot built with Node.js, Discord.js v14, and Shoukaku (Lavalink wrapper). Designed to be scalable and production-ready.

## Features
- **High Performance:** Uses Shoukaku and Lavalink for flawless audio playback.
- **Slash Commands Only:** Modern, native Discord command support.
- **Dynamic Queue Management:** Supports Loop, Shuffle, Autoplay, and History.
- **Beautiful UI:** Premium embeds with custom progress bars and button controls.
- **Multi-Node Lavalink Support:** Auto-failover and load balancing.
- **Render Ready:** Includes a keep-alive Express server.

## Installation

### Prerequisites
- Node.js v18 or higher
- A running Lavalink v4 Server
- Discord Bot Token & Client ID

### Setup
1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and fill in your details:
   ```env
   TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_client_id_here
   LAVALINK_HOST=localhost:2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   PORT=3000
   ```
4. Run `npm run build` to compile the TypeScript code.
5. Run `npm run start` to start the bot (or `npm run dev` for development).

## Commands
- `/play <query>`: Play a song from YouTube, SoundCloud, or URL.
- `/stop`: Stops playback and leaves the channel.
- `/skip`: Skips the current song.
- `/pause`: Pauses playback.
- `/resume`: Resumes playback.
- `/queue`: Displays the current queue.
- `/loop <mode>`: Sets loop mode to Track, Queue, or None.
- `/shuffle`: Shuffles the queue.
- `/remove <position>`: Removes a song at the specified queue position.
- `/seek <seconds>`: Seeks to a specific position in the track.
- `/volume <amount>`: Sets playback volume (0-200%).
- `/nowplaying`: Shows the currently playing song with progress.
- `/help`: Lists all available commands.

## Deployment on Render
1. Connect your GitHub repository to a new Render **Web Service**.
2. Set the Environment to `Node`.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm run start`
5. Add all Environment Variables from your `.env` in the Render dashboard.

## Lavalink Setup
You can host Lavalink locally using Java 17+, or use a free/paid Lavalink hosting provider. Ensure you update your `.env` to match the Host and Password. Multiple nodes can be added in `src/config/config.ts`.
