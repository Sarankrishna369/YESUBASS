import { CooldownManager } from '../src/utils/CooldownManager';

describe('CooldownManager', () => {
    it('should enforce cooldowns correctly', () => {
        const cooldown = new CooldownManager();
        const userId = '123';
        const guildId = '456';
        const commandName = 'play';

        // First check should pass
        expect(cooldown.check(userId, guildId, commandName, 500)).toBe(true);
        
        // Second check immediately after should fail
        expect(cooldown.check(userId, guildId, commandName, 500)).toBe(false);

        // Time left should be close to 500ms
        const timeLeft = cooldown.getTimeLeft(userId, guildId, commandName);
        expect(timeLeft).toBeGreaterThan(0);
        expect(timeLeft).toBeLessThanOrEqual(500);
    });

    it('should allow execution after cooldown expires', async () => {
        const cooldown = new CooldownManager();
        
        expect(cooldown.check('1', '1', 'cmd', 100)).toBe(true);
        expect(cooldown.check('1', '1', 'cmd', 100)).toBe(false);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 150));
        
        expect(cooldown.check('1', '1', 'cmd', 100)).toBe(true);
    });

    it('should isolate cooldowns per user and guild', () => {
        const cooldown = new CooldownManager();
        
        // User 1 in Guild 1
        expect(cooldown.check('U1', 'G1', 'cmd', 1000)).toBe(true);
        
        // User 2 in Guild 1 (should pass)
        expect(cooldown.check('U2', 'G1', 'cmd', 1000)).toBe(true);
        
        // User 1 in Guild 2 (should pass)
        expect(cooldown.check('U1', 'G2', 'cmd', 1000)).toBe(true);
        
        // User 1 in Guild 1 again (should fail)
        expect(cooldown.check('U1', 'G1', 'cmd', 1000)).toBe(false);
    });
});
