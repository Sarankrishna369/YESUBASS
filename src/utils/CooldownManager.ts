export class CooldownManager {
    private cooldowns: Map<string, number> = new Map();

    public check(userId: string, guildId: string, commandName: string, durationMs: number): boolean {
        const key = `${userId}-${guildId}-${commandName}`;
        const now = Date.now();
        const expirationTime = this.cooldowns.get(key);

        if (expirationTime && now < expirationTime) {
            return false;
        }

        this.cooldowns.set(key, now + durationMs);
        return true;
    }

    public getTimeLeft(userId: string, guildId: string, commandName: string): number {
        const key = `${userId}-${guildId}-${commandName}`;
        const expirationTime = this.cooldowns.get(key);
        if (!expirationTime) return 0;
        return Math.max(0, expirationTime - Date.now());
    }

    public clear(userId: string, guildId: string, commandName: string) {
        const key = `${userId}-${guildId}-${commandName}`;
        this.cooldowns.delete(key);
    }
}
