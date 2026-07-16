export class Mutex {
    private queue: Array<(value: () => void) => void> = [];
    private locked: boolean = false;

    public async lock(): Promise<() => void> {
        return new Promise((resolve) => {
            const unlock = () => {
                if (this.queue.length > 0) {
                    const nextResolve = this.queue.shift();
                    if (nextResolve) {
                        nextResolve(unlock);
                    }
                } else {
                    this.locked = false;
                }
            };

            if (this.locked) {
                this.queue.push(resolve);
            } else {
                this.locked = true;
                resolve(unlock);
            }
        });
    }

    public isLocked(): boolean {
        return this.locked;
    }
}
