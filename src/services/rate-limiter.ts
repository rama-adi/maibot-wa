import { configDatabase } from '@/database/drizzle';
import { rateLimits, allowedGroups } from '@/database/schemas/config-schema';
import { eq, lte, gt } from 'drizzle-orm';

export class RateLimiter {
    private readonly GROUP_LIMIT = 1000; // messages per day for groups
    private readonly USER_LIMIT = 100;   // messages per day for users

    constructor() {
        // Clean up expired entries every hour
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    private isGroup(recipient: string): boolean {
        return recipient.includes('@g.us');
    }

    private async getLimit(recipient: string): Promise<number> {
        if (this.isGroup(recipient)) {
            // Check if group has custom rate limit in allowed_groups table
            const groupConfig = await configDatabase
                .select()
                .from(allowedGroups)
                .where(eq(allowedGroups.id, recipient))
                .limit(1);
            
            return groupConfig[0]?.rateLimit ?? this.GROUP_LIMIT;
        }
        return this.USER_LIMIT;
    }

    private getNextDayStart(): number {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }

    async canSend(recipient: string): Promise<boolean> {
        const now = Date.now();
        const limit = await this.getLimit(recipient);

        const entry = await configDatabase
            .select()
            .from(rateLimits)
            .where(eq(rateLimits.id, recipient))
            .limit(1);

        // If no entry exists or it's expired, allow
        if (!entry[0] || (entry[0].resetsAt !== null && entry[0].resetsAt <= now)) {
            return true;
        }

        // Check if we're within the limit
        return (entry[0].rateLimit ?? 0) < limit;
    }

    async recordMessage(recipient: string): Promise<void> {
        const now = Date.now();
        const nextDayStart = this.getNextDayStart();

        const existingEntry = await configDatabase
            .select()
            .from(rateLimits)
            .where(eq(rateLimits.id, recipient))
            .limit(1);

        if (!existingEntry[0] || (existingEntry[0].resetsAt !== null && existingEntry[0].resetsAt <= now)) {
            // Create new entry or reset expired one
            await configDatabase
                .insert(rateLimits)
                .values({
                    id: recipient,
                    rateLimit: 1,
                    resetsAt: nextDayStart
                })
                .onConflictDoUpdate({
                    target: rateLimits.id,
                    set: {
                        rateLimit: 1,
                        resetsAt: nextDayStart
                    }
                });
        } else {
            // Increment existing entry
            await configDatabase
                .update(rateLimits)
                .set({ rateLimit: (existingEntry[0].rateLimit ?? 0) + 1 })
                .where(eq(rateLimits.id, recipient));
        }
    }

    async getRemainingMessages(recipient: string): Promise<number> {
        const limit = await this.getLimit(recipient);
        
        const entry = await configDatabase
            .select()
            .from(rateLimits)
            .where(eq(rateLimits.id, recipient))
            .limit(1);

        if (!entry[0] || (entry[0].resetsAt !== null && entry[0].resetsAt <= Date.now())) {
            return limit;
        }

        return Math.max(0, limit - (entry[0].rateLimit ?? 0));
    }

    private async cleanup(): Promise<void> {
        const now = Date.now();
        await configDatabase
            .delete(rateLimits)
            .where(lte(rateLimits.resetsAt, now));
    }

    // Get stats for debugging
    async getStats(): Promise<{ recipient: string; count: number; remaining: number; resetTime: Date }[]> {
        const now = Date.now();
        
        const entries = await configDatabase
            .select()
            .from(rateLimits)
            .where(gt(rateLimits.resetsAt, now));

        const stats: { recipient: string; count: number; remaining: number; resetTime: Date }[] = [];

        for (const entry of entries) {
            const remaining = await this.getRemainingMessages(entry.id);
            stats.push({
                recipient: entry.id,
                count: entry.rateLimit ?? 0,
                remaining,
                resetTime: new Date(entry.resetsAt ?? now)
            });
        }

        return stats;
    }
} 