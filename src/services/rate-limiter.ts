import { configDatabase } from '@/database/drizzle';
import { rateLimits, allowedGroups } from '@/database/schemas/config-schema';
import { eq, lte, gt } from 'drizzle-orm';
import { Context, Effect, Layer, pipe, Data } from 'effect';

// Proper Effect error types
export class RateLimiterError extends Data.TaggedError("RateLimiterError")<{
    readonly cause: unknown;
    readonly operation: string;
}> { }

export class RateLimiterService extends Context.Tag("RateLimiter")<
    RateLimiterService,
    {
        readonly canSend: (recipient: string) => Effect.Effect<boolean, RateLimiterError, never>;
        readonly recordMessage: (recipient: string) => Effect.Effect<void, RateLimiterError, never>;
        readonly getRemainingMessages: (recipient: string) => Effect.Effect<number, RateLimiterError, never>;
        readonly getStats: () => Effect.Effect<ReadonlyArray<{
            readonly recipient: string;
            readonly count: number;
            readonly remaining: number;
            readonly resetTime: Date;
        }>, RateLimiterError, never>;
    }
>() {
    static readonly GROUP_LIMIT = 1000; // messages per day for groups
    static readonly USER_LIMIT = 100;   // messages per day for users
}

// Helper Effects - now properly integrated
const isGroup = (recipient: string): boolean => recipient.includes('@g.us');

const getNextDayStart = (): number => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
};

export const NullRateLimiterService = Layer.succeed(
    RateLimiterService,
    RateLimiterService.of({
        canSend: function (_: string): Effect.Effect<boolean, RateLimiterError, never> {
            return Effect.succeed(true);
        },

        recordMessage: function (_: string): Effect.Effect<void, RateLimiterError, never> {
            return Effect.void;
        },

        getRemainingMessages: function (_: string): Effect.Effect<number, RateLimiterError, never> {
            return Effect.succeed(1);
        },

        getStats: function (): Effect.Effect<ReadonlyArray<{
            readonly recipient: string;
            readonly count: number;
            readonly remaining: number;
            readonly resetTime: Date;
        }>, RateLimiterError, never> {
            return Effect.succeed([]);
        }
    })
)

const getLimit = (recipient: string): Effect.Effect<number, RateLimiterError> =>
    Effect.gen(function* () {
        if (!isGroup(recipient)) {
            return RateLimiterService.USER_LIMIT;
        }

        const groupConfig = yield* pipe(
            Effect.tryPromise({
                try: () => configDatabase
                    .select()
                    .from(allowedGroups)
                    .where(eq(allowedGroups.id, recipient))
                    .limit(1),
                catch: (cause) => new RateLimiterError({
                    cause,
                    operation: "getGroupConfig"
                })
            })
        );

        return groupConfig[0]?.rateLimit ?? RateLimiterService.GROUP_LIMIT;
    });

const getRateLimitEntry = (recipient: string) =>
    pipe(
        Effect.tryPromise({
            try: () => configDatabase
                .select()
                .from(rateLimits)
                .where(eq(rateLimits.id, recipient))
                .limit(1),
            catch: (cause) => new RateLimiterError({
                cause,
                operation: "getRateLimitEntry"
            })
        })
    );

const isEntryExpired = (entry: any, now: number): boolean =>
    !entry || (entry.resetsAt !== null && entry.resetsAt <= now);

export const DatabaseRateLimiterService = Layer.succeed(
    RateLimiterService,
    RateLimiterService.of({
        canSend: (recipient: string) => Effect.gen(function* () {
            const now = Date.now();
            const limit = yield* getLimit(recipient);
            const entries = yield* getRateLimitEntry(recipient);

            if (isEntryExpired(entries[0], now)) {
                return true;
            }

            return (entries[0].rateLimit ?? 0) < limit;
        }),

        recordMessage: (recipient: string) => Effect.gen(function* () {
            const now = Date.now();
            const nextDayStart = getNextDayStart();
            const entries = yield* getRateLimitEntry(recipient);

            if (isEntryExpired(entries[0], now)) {
                yield* pipe(
                    Effect.tryPromise({
                        try: () => configDatabase
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
                            }),
                        catch: (cause) => new RateLimiterError({
                            cause,
                            operation: "recordMessage:insert"
                        })
                    })
                );
            } else {
                yield* pipe(
                    Effect.tryPromise({
                        try: () => configDatabase
                            .update(rateLimits)
                            .set({ rateLimit: (entries[0].rateLimit ?? 0) + 1 })
                            .where(eq(rateLimits.id, recipient)),
                        catch: (cause) => new RateLimiterError({
                            cause,
                            operation: "recordMessage:update"
                        })
                    })
                );
            }
        }),

        getRemainingMessages: (recipient: string) =>
            Effect.gen(function* () {
                const limit = yield* getLimit(recipient);
                const entries = yield* getRateLimitEntry(recipient);

                if (isEntryExpired(entries[0], Date.now())) {
                    return limit;
                }

                return Math.max(0, limit - (entries[0].rateLimit ?? 0));
            }),

        getStats: () =>
            Effect.gen(function* () {
                const now = Date.now();

                const entries = yield* pipe(
                    Effect.tryPromise({
                        try: () => configDatabase
                            .select()
                            .from(rateLimits)
                            .where(gt(rateLimits.resetsAt, now)),
                        catch: (cause) => new RateLimiterError({
                            cause,
                            operation: "getStats"
                        })
                    })
                );

                const stats: {
                    recipient: string;
                    count: number;
                    remaining: number;
                    resetTime: Date;
                }[] = [];

                for (const entry of entries) {
                    const limit = yield* getLimit(entry.id);
                    const remaining = Math.max(0, limit - (entry.rateLimit ?? 0));
                    stats.push({
                        recipient: entry.id,
                        count: entry.rateLimit ?? 0,
                        remaining,
                        resetTime: new Date(entry.resetsAt ?? now)
                    });
                }

                return stats;
            })
    })
);

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