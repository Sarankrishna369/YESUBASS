# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - Production Readiness Release

### Added
- **Global Mutex System**: Implemented an asynchronous `Mutex` lock on `joinVoiceChannel` and `playNext` queue processing to completely eradicate race conditions and Lavalink websocket desyncs.
- **CooldownManager**: Added per-user and per-guild rate limiting on heavy interaction commands (`/play`, `/skip`, `/pause`, etc.) to prevent API abuse.
- **Node Failover Auto-Recovery**: Activated native `moveOnDisconnect` in Shoukaku to automatically hot-swap to backup Lavalink nodes without dropping user voice sessions.
- **Production Audit Logging**: Replaced generic `console.log` lines with `Winston` structured logging across the bot to track connection integrity.
- **Boot Validation**: Added strict `.env` validation on startup. The bot will intelligently error out and exit before connecting to Discord if critical tokens or passwords are missing.
- **Unit Testing Suite**: Deployed Jest with mathematical lock testing.

### Changed
- Refactored `YesubassPlayer` logic to drop the massive, slow MongoDB history layer, making queues drastically lighter, purely memory-driven, and lightning fast.
- Cleaned up startup sequence logs, grouping commands, buttons, and events to avoid console spam.
- Enhanced `voiceStateUpdate.ts` timeout tracking to securely cancel timeouts if a user immediately rejoins an empty channel, fixing a silent memory leak.

### Removed
- Removed Mongoose, MongoDB schemas, and all persistent database logic.
- Removed arbitrary user account models.
- Removed dead code across `src/buttons/loop.ts` and `src/commands/play.ts`.
