import { Track } from 'shoukaku';

export type LoopMode = 'none' | 'track' | 'queue';

export interface QueuedTrack {
    track: Track;
    requester: any;
}

export class QueueManager {
    public tracks: QueuedTrack[] = [];
    public current: QueuedTrack | null = null;
    public loopTrack: boolean = false;
    public loopQueue: boolean = false;

    public setLoopTrack(state: boolean) {
        this.loopTrack = state;
    }

    public setLoopQueue(state: boolean) {
        this.loopQueue = state;
    }
    public get loopMode(): LoopMode {
        if (this.loopTrack) return 'track';
        if (this.loopQueue) return 'queue';
        return 'none';
    }

    public set loopMode(mode: LoopMode) {
        if (mode === 'track') {
            this.loopTrack = true;
            this.loopQueue = false;
        } else if (mode === 'queue') {
            this.loopTrack = false;
            this.loopQueue = true;
        } else {
            this.loopTrack = false;
            this.loopQueue = false;
        }
    }

    public add(track: QueuedTrack): void {
        this.tracks.push(track);
    }

    public remove(index: number): QueuedTrack | null {
        if (index < 0 || index >= this.tracks.length) return null;
        return this.tracks.splice(index, 1)[0];
    }

    public clear(): void {
        this.tracks = [];
    }

    public shuffle(): void {
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
    }

    public get size(): number {
        return this.tracks.length;
    }
}
