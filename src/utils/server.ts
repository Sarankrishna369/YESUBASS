import express from 'express';
import cors from 'cors';
import { logger } from './logger';
import { config } from '../config/config';
import { YesubassClient } from './YesubassClient';
import { YesubassPlayer } from '../player/PlayerManager';
import { Mutex } from './Mutex';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const soundsDir = path.join(process.cwd(), 'public/sounds');
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbkwnecjjahahgncevvo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJia3duZWNqamFoYWhnbmNldnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NTkxNzEsImV4cCI6MjEwNDQzNTE3MX0.8_f2XA9Jpt8pkG8MEXvYWI9pbZcFsvGXGvQRYjBHwv0';

const soundUrlCache = new Map<string, string>();

async function uploadSoundPermanently(filename: string, buffer: Buffer, originalName?: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac'
    };
    const mimeType = mimeMap[ext] || 'audio/mpeg';

    let uploadedUrl = '';

    // 1. Upload to Supabase Storage (reliable, permanent cloud storage)
    try {
        const supaStorageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sounds/${encodeURIComponent(filename)}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': mimeType,
                'x-upsert': 'true'
            },
            body: new Uint8Array(buffer)
        });
        if (supaStorageRes.ok) {
            uploadedUrl = `${SUPABASE_URL}/storage/v1/object/public/sounds/${encodeURIComponent(filename)}`;
            logger.info(`[Soundboard] Uploaded ${filename} to Supabase Storage: ${uploadedUrl}`);
        } else {
            const errText = await supaStorageRes.text();
            logger.warn(`[Soundboard] Supabase storage upload warning: ${errText}`);
        }
    } catch (err) {
        logger.error(`[Soundboard] Supabase storage upload error:`, err);
    }

    // 2. Also upload to Catbox for instant high-speed audio CDN
    try {
        const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', blob, filename);

        const catboxRes = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form
        });
        const catboxUrl = (await catboxRes.text()).trim();
        if (catboxUrl && catboxUrl.startsWith('http')) {
            logger.info(`[Soundboard] Uploaded ${filename} to Catbox: ${catboxUrl}`);
            uploadedUrl = catboxUrl;
        }
    } catch (err) {
        logger.warn(`[Soundboard] Catbox upload error:`, err);
    }

    if (!uploadedUrl) {
        uploadedUrl = `${SUPABASE_URL}/storage/v1/object/public/sounds/${encodeURIComponent(filename)}`;
    }

    // 3. Upsert record into Supabase custom_sounds table
    try {
        const rawBase = originalName || filename;
        const displayName = path.basename(rawBase, path.extname(rawBase))
            .replace(/^\d+-/, '')
            .replace(/[_-]+/g, ' ')
            .trim() || 'Custom Sound';

        await fetch(`${SUPABASE_URL}/rest/v1/custom_sounds`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: displayName,
                filename: filename,
                url: uploadedUrl
            })
        });
        logger.info(`[Soundboard] Saved sound metadata in Supabase: "${displayName}" (${filename})`);
    } catch (dbErr) {
        logger.error(`[Soundboard] Failed to save sound metadata in Supabase:`, dbErr);
    }

    soundUrlCache.set(filename, uploadedUrl);
    return uploadedUrl;
}

async function initSoundboardPersistence() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/custom_sounds?select=*&order=created_at.desc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (res.ok) {
            const rows: any = await res.json();
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    if (row.filename && row.url) {
                        soundUrlCache.set(row.filename, row.url);
                    }
                }
                logger.info(`[Soundboard] Loaded ${rows.length} custom sounds from Supabase.`);
            }
        }
    } catch (err) {
        logger.error(`[Soundboard] Failed to load sounds from Supabase:`, err);
    }

    // Check any local sounds in public/sounds that are not yet in Supabase
    try {
        if (fs.existsSync(soundsDir)) {
            const files = fs.readdirSync(soundsDir).filter(f => !f.startsWith('.') && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f));
            for (const file of files) {
                if (!soundUrlCache.has(file)) {
                    logger.info(`[Soundboard] Syncing local sound to Supabase: ${file}`);
                    const filePath = path.join(soundsDir, file);
                    const buffer = fs.readFileSync(filePath);
                    await uploadSoundPermanently(file, buffer, file);
                }
            }
        }
    } catch (err) {
        logger.error(`[Soundboard] Failed to sync local sounds:`, err);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, soundsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.mp3';
        const rawBase = path.basename(file.originalname, ext);
        const cleanBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'sound';
        cb(null, `${Date.now()}-${cleanBase.slice(0, 60)}${ext}`);
    }
});
const upload = multer({ storage });

export function startApiServer(client: YesubassClient) {
    const app = express();
    const searchCache = new Map<string, { timestamp: number, results: any[] }>();
    const trackCache = new Map<string, any>();
    app.use(cors());
    app.use(express.json());
    app.use('/sounds', express.static(soundsDir));
    app.get('/', (req, res) => {
        res.send('YESUBASS V2 is running!');
    });

    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'UP', timestamp: Date.now() });
    });

    app.get('/metrics', (req, res) => {
        const memory = process.memoryUsage();
        res.status(200).json({
            memory: {
                rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
            },
            uptime: process.uptime()
        });
    });

    app.post('/api/soundboard/play', async (req, res) => {
        const { userId, soundName } = req.body;
        if (!userId || !soundName) {
            return res.status(400).json({ error: 'Missing userId or soundName' });
        }

        let targetVoiceChannelId: string | null = null;
        let targetGuildId: string | null = null;

        for (const [guildId, guild] of client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member && member.voice.channelId) {
                targetVoiceChannelId = member.voice.channelId;
                targetGuildId = guildId;
                break;
            }
        }

        if (!targetVoiceChannelId || !targetGuildId) {
            return res.status(404).json({ error: 'User is not in a voice channel.' });
        }

        logger.info(`[API] Soundboard request for sound: ${soundName} by user: ${userId} in guild: ${targetGuildId}`);

        try {
            let player = client.players.get(targetGuildId);
            
            if (!player) {
                let joinLock = client.joinLocks.get(targetGuildId);
                if (!joinLock) {
                    joinLock = new Mutex();
                    client.joinLocks.set(targetGuildId, joinLock);
                }

                const unlock = await joinLock.lock();
                try {
                    player = client.players.get(targetGuildId);
                    if (!player) {
                        const node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
                        if (!node) {
                            return res.status(503).json({ error: 'No Lavalink nodes are currently available.' });
                        }

                        const guild = client.guilds.cache.get(targetGuildId);
                        const shoukakuPlayer = await client.lavalink.shoukaku.joinVoiceChannel({
                            guildId: targetGuildId,
                            channelId: targetVoiceChannelId,
                            shardId: guild?.shardId ?? 0,
                            deaf: true
                        });
                        
                        player = new YesubassPlayer(client, shoukakuPlayer, targetGuildId, '', targetVoiceChannelId);
                        client.players.set(targetGuildId, player);
                        logger.info(`[API] Joined voice channel for soundboard in guild ${targetGuildId}`);
                    }
                } finally {
                    unlock();
                }
            }

            const node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
            if (!node) {
                return res.status(503).json({ error: 'No Lavalink nodes available.' });
            }

            let searchUrl = soundName;
            // If it's a known built-in sound, map it to a youtube search or specific URL
            const builtInSounds: Record<string, string> = {
                'Airhorn': 'https://www.youtube.com/watch?v=2Tt04ZSlbZ0',
                'Ba Dum Tss': 'https://www.youtube.com/watch?v=obKLdou0LH0',
                'Bruh': 'https://www.youtube.com/watch?v=2ZIpFytCSVc',
                'Sad Trombone': 'https://www.youtube.com/watch?v=CQeezCdF4cg',
                'Applause': 'https://www.youtube.com/watch?v=YXrgpQ-O20M',
                'Crickets': 'https://www.youtube.com/watch?v=K8E_zMLCRNg',
                'Nani!?': 'https://www.youtube.com/watch?v=7uZO_nUuFIE',
                'Quack': 'https://www.youtube.com/watch?v=x8oPqE-Gq70'
            };

            if (builtInSounds[soundName]) {
                searchUrl = builtInSounds[soundName];
            } else if (!soundName.startsWith('http')) {
                // Must be a custom sound
                if (soundUrlCache.has(soundName)) {
                    searchUrl = soundUrlCache.get(soundName)!;
                } else {
                    // Try to resolve from Supabase
                    try {
                        const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/custom_sounds?or=(filename.eq.${encodeURIComponent(soundName)},name.eq.${encodeURIComponent(soundName)})&select=url&limit=1`, {
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`
                            }
                        });
                        if (supaRes.ok) {
                            const rows: any = await supaRes.json();
                            if (Array.isArray(rows) && rows.length > 0 && rows[0].url) {
                                searchUrl = rows[0].url;
                                soundUrlCache.set(soundName, rows[0].url);
                            }
                        }
                    } catch (dbErr) {
                        logger.error('[Soundboard] Error querying Supabase for sound URL:', dbErr);
                    }

                    if (!searchUrl.startsWith('http')) {
                        const localFilePath = path.join(soundsDir, path.basename(soundName));
                        if (fs.existsSync(localFilePath)) {
                            try {
                                const buffer = fs.readFileSync(localFilePath);
                                searchUrl = await uploadSoundPermanently(path.basename(soundName), buffer);
                            } catch {
                                const cleanName = soundName.replace(/^\d+-/, '').replace(/_+/g, ' ').replace('.mp3', '');
                                searchUrl = `ytsearch:${cleanName} sound effect`;
                            }
                        } else {
                            const cleanName = soundName.replace(/^\d+-/, '').replace(/_+/g, ' ').replace('.mp3', '');
                            searchUrl = `ytsearch:${cleanName} sound effect`;
                        }
                    }
                }
            }

            const result = await node.rest.resolve(searchUrl);
            if (!result || !result.data) {
                return res.status(404).json({ error: 'Sound track could not be resolved.' });
            }

            const track: any = result.loadType === 'search' ? result.data[0] : (result.loadType === 'playlist' ? result.data.tracks[0] : result.data);
            
            if (track && track.encoded) {
                const user = client.users.cache.get(userId) || { id: userId, username: 'Web User' };
                // Add to queue and play if nothing is playing
                player.queue.add({ track: track as any, requester: user as any });
                if (!player.queue.current) {
                    await player.playNext();
                }
                res.status(200).json({ success: true, message: `Playing ${soundName}` });
            } else {
                res.status(404).json({ error: 'Sound not found' });
            }

        } catch (error) {
            logger.error(`[API] Failed to play soundboard:`, error);
            res.status(500).json({ error: 'Failed to process request.' });
        }
    });

    app.get('/api/soundboard/list', async (req, res) => {
        try {
            const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/custom_sounds?select=*&order=created_at.desc`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            let customRows: Array<{ id?: number, name: string, filename: string, url: string }> = [];
            if (supaRes.ok) {
                customRows = await supaRes.json();
                for (const row of customRows) {
                    if (row.filename && row.url) {
                        soundUrlCache.set(row.filename, row.url);
                    }
                }
            }

            const existingFilenames = new Set(customRows.map(r => r.filename));
            if (fs.existsSync(soundsDir)) {
                const localFiles = fs.readdirSync(soundsDir).filter(f => !f.startsWith('.') && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f));
                for (const f of localFiles) {
                    if (!existingFilenames.has(f)) {
                        existingFilenames.add(f);
                        customRows.push({
                            name: f.replace(/^\d+-/, '').replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim(),
                            filename: f,
                            url: soundUrlCache.get(f) || `/sounds/${f}`
                        });
                    }
                }
            }

            return res.status(200).json({
                sounds: Array.from(existingFilenames),
                soundData: customRows
            });
        } catch (err) {
            logger.error('[API] Failed to list sounds:', err);
            try {
                const files = fs.readdirSync(soundsDir).filter(f => !f.startsWith('.') && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f));
                return res.status(200).json({ sounds: files });
            } catch {
                return res.status(500).json({ error: 'Failed to list sounds' });
            }
        }
    });

    app.post('/api/soundboard/upload', upload.single('sound'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const buffer = fs.readFileSync(req.file.path);
            const permanentUrl = await uploadSoundPermanently(req.file.filename, buffer, req.file.originalname);
            return res.status(200).json({ 
                success: true, 
                filename: req.file.filename,
                url: permanentUrl
            });
        } catch (uploadErr) {
            logger.error('[API] Error during sound upload persistence:', uploadErr);
            return res.status(200).json({ 
                success: true, 
                filename: req.file.filename,
                warning: 'Saved locally, cloud sync pending'
            });
        }
    });

    app.delete('/api/soundboard/delete', async (req, res) => {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Missing filename' });
        const safeName = path.basename(filename);

        try {
            // Delete from Supabase database
            await fetch(`${SUPABASE_URL}/rest/v1/custom_sounds?filename=eq.${encodeURIComponent(safeName)}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            // Delete from Supabase storage
            await fetch(`${SUPABASE_URL}/storage/v1/object/sounds`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prefixes: [safeName] })
            });

            // Delete from local disk
            const targetPath = path.join(soundsDir, safeName);
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }

            soundUrlCache.delete(safeName);
            return res.status(200).json({ success: true });
        } catch (err) {
            logger.error('[API] Failed to delete sound:', err);
            return res.status(500).json({ error: 'Failed to delete file' });
        }
    });

    app.post('/api/music/play', async (req, res) => {
        const { userId, query } = req.body;
        if (!userId || !query) {
            return res.status(400).json({ error: 'Missing userId or query' });
        }

        let targetVoiceChannelId: string | null = null;
        let targetGuildId: string | null = null;

        for (const [guildId, guild] of client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member && member.voice.channelId) {
                targetVoiceChannelId = member.voice.channelId;
                targetGuildId = guildId;
                break;
            }
        }

        if (!targetVoiceChannelId || !targetGuildId) {
            return res.status(404).json({ error: 'User is not in a voice channel.' });
        }

        try {
            let player = client.players.get(targetGuildId);
            
            if (!player) {
                let joinLock = client.joinLocks.get(targetGuildId);
                if (!joinLock) {
                    joinLock = new Mutex();
                    client.joinLocks.set(targetGuildId, joinLock);
                }

                const unlock = await joinLock.lock();
                try {
                    player = client.players.get(targetGuildId);
                    if (!player) {
                        const node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
                        if (!node) {
                            return res.status(503).json({ error: 'No Lavalink nodes are currently available.' });
                        }

                        const guild = client.guilds.cache.get(targetGuildId);
                        const shoukakuPlayer = await client.lavalink.shoukaku.joinVoiceChannel({
                            guildId: targetGuildId,
                            channelId: targetVoiceChannelId,
                            shardId: guild?.shardId ?? 0,
                            deaf: true
                        });
                        
                        // We don't have a text channel ID from the web interface, so we just use the voice channel ID or an empty string
                        player = new YesubassPlayer(client, shoukakuPlayer, targetGuildId, '', targetVoiceChannelId);
                        client.players.set(targetGuildId, player);
                        logger.info(`[API] Joined voice channel in guild ${targetGuildId}`);
                    }
                } finally {
                    unlock();
                }
            }

            const cachedTrack = trackCache.get(query) || trackCache.get(query.toLowerCase());
            let trackAdded: any = null;

            if (cachedTrack) {
                trackAdded = cachedTrack;
                const user = client.users.cache.get(userId) || { id: userId, username: 'Web User' };
                player.queue.add({ track: cachedTrack, requester: user as any });
            } else {
                const node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
                if (!node) {
                    return res.status(503).json({ error: 'No Lavalink nodes available.' });
                }

                let searchPrefix = 'ytsearch:';
                if (query.startsWith('http://') || query.startsWith('https://')) {
                    searchPrefix = '';
                }

                let result: any = null;
                try {
                    result = await node.rest.resolve(`${searchPrefix}${query}`);
                } catch (resolveErr: any) {
                    if (searchPrefix === 'ytsearch:') {
                        try {
                            result = await node.rest.resolve(`ytmsearch:${query}`);
                        } catch (e2) {
                            try {
                                result = await node.rest.resolve(`scsearch:${query}`);
                            } catch (e3) {}
                        }
                    }
                    if (!result) throw resolveErr;
                }

                if (!result || !result.data) {
                    return res.status(404).json({ error: 'No results found.' });
                }

                if (result.loadType === 'playlist') {
                    const tracks = result.data.tracks;
                    trackAdded = tracks[0];
                    for (const track of tracks) {
                        const user = client.users.cache.get(userId) || { id: userId, username: 'Web User' };
                        player.queue.add({ track, requester: user as any });
                    }
                } else if (result.loadType === 'search' || result.loadType === 'track') {
                    const track = result.loadType === 'search' ? result.data[0] : result.data;
                    trackAdded = track;
                    const user = client.users.cache.get(userId) || { id: userId, username: 'Web User' };
                    player.queue.add({ track, requester: user as any });
                } else {
                    return res.status(404).json({ error: 'No results found.' });
                }
            }

            if (!player.queue.current) {
                await player.playNext();
            }

            res.status(200).json({ success: true, track: trackAdded?.info?.title || 'Track' });

        } catch (error: any) {
            logger.error(`[API] Failed to process music play:`, error);
            if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too many')) {
                return res.status(429).json({ error: 'Audio provider is currently busy. Please try again in a moment.' });
            }
            res.status(500).json({ error: 'Failed to process request.' });
        }
    });

    app.post('/api/music/control', async (req, res) => {
        const { userId, action } = req.body;
        if (!userId || !action) {
            return res.status(400).json({ error: 'Missing userId or action' });
        }

        let targetGuildId: string | null = null;
        for (const [guildId, guild] of client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member && member.voice.channelId) {
                targetGuildId = guildId;
                break;
            }
        }

        // Fallback: If user is not currently in a voice channel, look for any guild where the user is present and bot is playing
        if (!targetGuildId) {
            for (const [guildId, guild] of client.guilds.cache) {
                if (guild.members.cache.has(userId) && client.players.has(guildId)) {
                    targetGuildId = guildId;
                    break;
                }
            }
        }

        if (!targetGuildId) {
            return res.status(404).json({ error: 'User is not in a voice channel or no active bot player found.' });
        }

        const player = client.players.get(targetGuildId);
        if (!player) {
            return res.status(404).json({ error: 'No active player in this server.' });
        }

        try {
            switch (action) {
                case 'pause':
                    await player.player.setPaused(true);
                    break;
                case 'play':
                    await player.player.setPaused(false);
                    break;
                case 'skip_next':
                case 'skip_prev':
                    if (player.queue.loopTrack) {
                        player.queue.loopTrack = false;
                    }
                    await player.playNext();
                    return res.status(200).json({
                        success: true,
                        message: 'Skipped track',
                        currentTrack: player.queue.current?.track?.info?.title || 'No track playing',
                        isPlaying: !!player.queue.current && !player.player.paused
                    });
                case 'volume':
                    const vol = parseInt(req.body.value, 10);
                    if (!isNaN(vol) && vol >= 0 && vol <= 100) {
                        await player.player.setGlobalVolume(vol);
                    }
                    break;
                case 'seek':
                    const pos = parseInt(req.body.value, 10);
                    if (!isNaN(pos) && pos >= 0) {
                        await player.player.seekTo(pos);
                    }
                    break;
                case 'stop':
                case 'leave':
                case 'exit':
                case 'disconnect':
                    await player.destroy();
                    break;
                case 'remove_queue': {
                    const removeIdx = parseInt(req.body.index ?? req.body.value, 10);
                    if (!isNaN(removeIdx) && removeIdx >= 0 && removeIdx < player.queue.tracks.length) {
                        const removed = player.queue.remove(removeIdx);
                        logger.info(`[API] Removed track at index ${removeIdx}: ${removed?.track?.info?.title}`);
                        return res.status(200).json({ success: true, message: `Removed track at index ${removeIdx}` });
                    } else {
                        return res.status(400).json({ error: 'Invalid track index' });
                    }
                }
                case 'clear_queue':
                    player.queue.clear();
                    logger.info(`[API] Queue cleared by user ${userId}`);
                    return res.status(200).json({ success: true, message: 'Queue cleared' });
                default:
                    return res.status(400).json({ error: 'Invalid action' });
            }
            logger.info(`[API] Music control request: ${action} by user: ${userId}`);
            res.status(200).json({ success: true, message: `Action ${action} executed` });
        } catch (error) {
            logger.error(`[API] Failed to execute control action ${action}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/music/queue/remove', async (req, res) => {
        const { userId, index } = req.body;
        if (!userId || index === undefined) {
            return res.status(400).json({ error: 'Missing userId or index' });
        }

        let targetGuildId: string | null = null;
        for (const [guildId, guild] of client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member && member.voice.channelId) {
                targetGuildId = guildId;
                break;
            }
        }
        if (!targetGuildId) {
            for (const [guildId, guild] of client.guilds.cache) {
                if (guild.members.cache.has(userId) && client.players.has(guildId)) {
                    targetGuildId = guildId;
                    break;
                }
            }
        }
        if (!targetGuildId) {
            return res.status(404).json({ error: 'No active player or voice channel found.' });
        }

        const player = client.players.get(targetGuildId);
        if (!player) {
            return res.status(404).json({ error: 'No active player in this server.' });
        }

        const idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 0 || idx >= player.queue.tracks.length) {
            return res.status(400).json({ error: 'Invalid track index' });
        }

        const removed = player.queue.remove(idx);
        logger.info(`[API] Queue item ${idx} removed: ${removed?.track?.info?.title}`);
        res.status(200).json({ success: true, removedTitle: removed?.track?.info?.title || 'Track' });
    });

    app.post('/api/music/queue/clear', async (req, res) => {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        let targetGuildId: string | null = null;
        for (const [guildId, guild] of client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member && member.voice.channelId) {
                targetGuildId = guildId;
                break;
            }
        }
        if (!targetGuildId) {
            for (const [guildId, guild] of client.guilds.cache) {
                if (guild.members.cache.has(userId) && client.players.has(guildId)) {
                    targetGuildId = guildId;
                    break;
                }
            }
        }
        if (!targetGuildId) {
            return res.status(404).json({ error: 'No active player found.' });
        }

        const player = client.players.get(targetGuildId);
        if (!player) {
            return res.status(404).json({ error: 'No active player.' });
        }

        player.queue.clear();
        logger.info(`[API] Queue cleared by user: ${userId}`);
        res.status(200).json({ success: true, message: 'Queue cleared' });
    });

    app.get('/api/music/search', async (req, res) => {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Missing query' });
        }

        const trimmed = query.trim();
        if (trimmed.length < 2) {
            return res.status(200).json({ results: [] });
        }

        const cacheKey = trimmed.toLowerCase();
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 300000) {
            return res.status(200).json({ results: cached.results });
        }

        const node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
        if (!node) {
            return res.status(503).json({ error: 'No Lavalink nodes available.' });
        }

        try {
            let searchPrefix = 'ytsearch:';
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                searchPrefix = '';
            }

            let result: any = null;
            try {
                result = await node.rest.resolve(`${searchPrefix}${trimmed}`);
            } catch (err: any) {
                if (searchPrefix === 'ytsearch:') {
                    try {
                        result = await node.rest.resolve(`ytmsearch:${trimmed}`);
                    } catch (err2) {
                        try {
                            result = await node.rest.resolve(`scsearch:${trimmed}`);
                        } catch (err3) {}
                    }
                }
            }

            if (!result || !result.data) {
                return res.status(200).json({ results: [] });
            }

            let tracks: any[] = [];
            if (result.loadType === 'search') {
                tracks = Array.isArray(result.data) ? result.data.slice(0, 8) : [];
            } else if (result.loadType === 'track') {
                tracks = [result.data];
            } else if (result.loadType === 'playlist') {
                tracks = Array.isArray(result.data.tracks) ? result.data.tracks.slice(0, 8) : [];
            } else {
                return res.status(200).json({ results: [] });
            }

            // Cache track objects in memory for instant zero-latency playback
            for (const t of tracks) {
                if (t && t.info) {
                    if (t.info.uri) trackCache.set(t.info.uri, t);
                    if (t.info.title) trackCache.set(t.info.title.toLowerCase(), t);
                }
            }
            if (trackCache.size > 300) {
                const keys = Array.from(trackCache.keys()).slice(0, 50);
                keys.forEach(k => trackCache.delete(k));
            }

            const formatted = tracks
                .filter((t: any) => t && t.info && t.info.title)
                .map((t: any) => ({
                    title: t.info.title,
                    author: t.info.author || 'Unknown Artist',
                    uri: t.info.uri || '',
                    identifier: t.info.identifier || '',
                    duration: t.info.length || 0
                }));

            searchCache.set(cacheKey, { timestamp: Date.now(), results: formatted });
            if (searchCache.size > 200) {
                const keys = Array.from(searchCache.keys()).slice(0, 50);
                keys.forEach(k => searchCache.delete(k));
            }

            res.status(200).json({ results: formatted });
        } catch (err) {
            logger.error(`[API] Search failed:`, err);
            res.status(200).json({ results: [] });
        }
    });

    app.post('/api/music/leave', async (req, res) => {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        let targetGuildId: string | null = null;
        for (const [guildId, guild] of client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member && member.voice.channelId) {
                targetGuildId = guildId;
                break;
            }
        }

        if (!targetGuildId) {
            return res.status(404).json({ error: 'User is not in a voice channel.' });
        }

        const player = client.players.get(targetGuildId);
        if (!player) {
            return res.status(404).json({ error: 'No active player in this server.' });
        }

        try {
            await player.destroy();
            logger.info(`[API] Bot kicked by user: ${userId} in guild: ${targetGuildId}`);
            res.status(200).json({ success: true, message: 'Disconnected' });
        } catch (error) {
            logger.error(`[API] Failed to kick bot:`, error);
            res.status(500).json({ error: 'Failed to kick bot.' });
        }
    });

    app.get('/api/music/status', async (req, res) => {
        try {
            const { userId } = req.query;
            if (!userId || typeof userId !== 'string') {
                return res.status(400).json({ error: 'Missing userId' });
            }

            let targetGuildId: string | null = null;
            for (const [guildId, guild] of client.guilds.cache) {
                const member = guild.members.cache.get(userId);
                if (member && member.voice.channelId) {
                    targetGuildId = guildId;
                    break;
                }
            }

            if (!targetGuildId) {
                for (const [guildId, guild] of client.guilds.cache) {
                    if (guild.members.cache.has(userId) && client.players.has(guildId)) {
                        targetGuildId = guildId;
                        break;
                    }
                }
            }

            if (!targetGuildId) {
                return res.status(200).json({ isPlaying: false, currentTrack: 'Not in a voice channel', position: 0, duration: 0, queue: [] });
            }

            const player = client.players.get(targetGuildId);
            if (!player || !player.queue.current) {
                return res.status(200).json({ isPlaying: false, currentTrack: 'No track playing', position: 0, duration: 0, queue: [] });
            }

            const upcomingQueue = player.queue.tracks.slice(0, 25).map((q, idx) => ({
                index: idx,
                title: q?.track?.info?.title || 'Unknown',
                author: q?.track?.info?.author || 'Unknown',
                uri: q?.track?.info?.uri || '',
                duration: q?.track?.info?.length || 0
            }));

            res.status(200).json({
                isPlaying: !player.player.paused,
                currentTrack: player.queue.current?.track?.info?.title || 'Unknown Track',
                volume: player.player.filters?.volume ?? 100, // fallback for volume
                position: player.player.position,
                duration: player.queue.current?.track?.info?.length || 0,
                queue: upcomingQueue
            });
        } catch (error) {
            logger.error(`[API] Error in /api/music/status:`, error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    app.get('/api/bot/stats', (req, res) => {
        try {
            const memberCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            const serverCount = client.guilds.cache.size;
            const uptime = client.uptime ? Math.floor(client.uptime / 1000) : 0;
            const ping = client.ws.ping;

            res.status(200).json({
                activeMembers: memberCount,
                serverCount: serverCount,
                uptime: uptime,
                ping: ping
            });
        } catch (error) {
            logger.error(`[API] Error in /api/bot/stats:`, error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    app.listen(config.port, () => {
        logger.success(`Keep-alive server listening on port ${config.port}`);
        initSoundboardPersistence().catch(err => logger.error('[Soundboard] Init persistence error:', err));
    });
}
