import { Mutex } from '../src/utils/Mutex';

describe('Mutex', () => {
    it('should lock and unlock correctly', async () => {
        const mutex = new Mutex();
        expect(mutex.isLocked()).toBe(false);

        const unlock1 = await mutex.lock();
        expect(mutex.isLocked()).toBe(true);

        let locked2 = false;
        mutex.lock().then(unlock2 => {
            locked2 = true;
            unlock2();
        });

        // The second lock should wait
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(locked2).toBe(false);

        unlock1(); // Release first lock

        // Give promises time to resolve
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(locked2).toBe(true);
        expect(mutex.isLocked()).toBe(false); // Second lock immediately unlocked
    });

    it('should queue multiple locks', async () => {
        const mutex = new Mutex();
        const executionOrder: number[] = [];

        const task = async (id: number, delay: number) => {
            const unlock = await mutex.lock();
            await new Promise(resolve => setTimeout(resolve, delay));
            executionOrder.push(id);
            unlock();
        };

        await Promise.all([
            task(1, 100),
            task(2, 50),
            task(3, 10)
        ]);

        expect(executionOrder).toEqual([1, 2, 3]);
    });
});
