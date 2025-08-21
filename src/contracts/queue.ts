import type { BaseQueue } from "@/contracts/base-queue";
import { Context, Effect, Schema } from "effect";

export const QueueJobData = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    progress: Schema.String,
    queue: Schema.String,
    label: Schema.optional(Schema.String),
    tags: Schema.optional(Schema.Array(Schema.String)),
    middleware: Schema.optional(Schema.Array(Schema.String)),
    data: Schema.Unknown,
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

export const QueueJobResult = Schema.Array(QueueJobData)

export interface QueueService {
    enqueue: (job: InstanceType<typeof BaseQueue<any>>) => Effect.Effect<void, Error>;
    getJobs: (options: {
        start: number,
        end: number,
        ascending: boolean,
    }) => Effect.Effect<Schema.Schema.Type<typeof QueueJobResult>, Error>;
    viewLog: (id: string) => Effect.Effect<string[], Error>;
}

export const QueueService = Context.GenericTag<QueueService>("QueueService");