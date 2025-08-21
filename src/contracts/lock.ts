import { Context, Data, type Effect } from "effect";

export class LockAcquisitionError extends Data.TaggedError("LockAcquisitionError")<{ key: string }> {}

export interface LockService {
    readonly acquire: (
        key: string,
        options: { expiry: number; limit?: number }
    ) => Effect.Effect<boolean, LockAcquisitionError>;
    readonly release: (key: string) => Effect.Effect<void, never>;
}

export const LockService = Context.GenericTag<LockService>("LockService");