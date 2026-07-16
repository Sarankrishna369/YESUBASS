export function generateProgressBar(current: number, total: number, size: number = 20): string {
    if (total === 0) return '━'.repeat(size);
    
    const progress = Math.round((size * current) / total);
    const emptyProgress = size - progress;

    const progressText = '━'.repeat(progress);
    const emptyProgressText = '━'.repeat(emptyProgress);
    const bar = progressText + '●' + emptyProgressText;
    
    return bar;
}

export function formatTime(ms: number): string {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    const parts = [];
    if (hours > 0) {
        parts.push(hours.toString());
        parts.push(minutes.toString().padStart(2, '0'));
    } else {
        parts.push(minutes.toString());
    }
    parts.push(seconds.toString().padStart(2, '0'));

    return parts.join(':');
}
