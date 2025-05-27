interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private readonly GROUP_LIMIT = 1000; // messages per day for groups
    private readonly USER_LIMIT = 100;   // messages per day for users

    constructor() {
        // Clean up expired entries every hour
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    private isGroup(recipient: string): boolean {
        return recipient.includes('@g.us');
    }

    private getLimit(recipient: string): number {
        return this.isGroup(recipient) ? this.GROUP_LIMIT : this.USER_LIMIT;
    }

    private getDayStart(): number {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now.getTime();
    }

    private getNextDayStart(): number {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }

    canSend(recipient: string): boolean {
        const now = Date.now();
        const dayStart = this.getDayStart();
        const limit = this.getLimit(recipient);

        const entry = this.limits.get(recipient);

        // If no entry exists or it's from a previous day, allow
        if (!entry || entry.resetTime <= now) {
            return true;
        }

        // Check if we're within the limit
        return entry.count < limit;
    }

    recordMessage(recipient: string): void {
        const now = Date.now();
        const nextDayStart = this.getNextDayStart();

        const entry = this.limits.get(recipient);

        if (!entry || entry.resetTime <= now) {
            // Create new entry or reset expired one
            this.limits.set(recipient, {
                count: 1,
                resetTime: nextDayStart
            });
        } else {
            // Increment existing entry
            entry.count++;
        }
    }

    getRemainingMessages(recipient: string): number {
        const limit = this.getLimit(recipient);
        const entry = this.limits.get(recipient);

        if (!entry || entry.resetTime <= Date.now()) {
            return limit;
        }

        return Math.max(0, limit - entry.count);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (entry.resetTime <= now) {
                this.limits.delete(key);
            }
        }
    }

    // Get stats for debugging
    getStats(): { recipient: string; count: number; remaining: number; resetTime: Date }[] {
        const now = Date.now();
        const stats: { recipient: string; count: number; remaining: number; resetTime: Date }[] = [];

        for (const [recipient, entry] of this.limits.entries()) {
            if (entry.resetTime > now) {
                stats.push({
                    recipient,
                    count: entry.count,
                    remaining: this.getRemainingMessages(recipient),
                    resetTime: new Date(entry.resetTime)
                });
            }
        }

        return stats;
    }
} 