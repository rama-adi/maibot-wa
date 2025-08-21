import { QueueService } from "@/contracts/queue";
import { RedisLockLive, RedisTag } from "@/services/lock";
import { QueueServiceLive } from "@/services/queue";
import { MaisongDataLive } from "@/services/maisong-data";
import { Queue } from "bullmq";
import { Layer } from "effect";
import { Redis } from "ioredis";
import { MaiAiLive } from "@/services/mai-ai";

const queueName = process.env.QUEUE_NAME ?? "MAIBOTWA";
const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const redisPassword = process.env.REDIS_PASSWORD;

const connection = redisPassword 
  ? { host: redisHost, port: redisPort, password: redisPassword } as const
  : { host: redisHost, port: redisPort } as const;
const bullQueue = new Queue(queueName, { connection });
const redis = new Redis(connection);


// Use this for main and worker.
export const LiveRuntimeContainer = Layer.mergeAll(
  Layer.succeed(QueueService, QueueServiceLive(bullQueue)),
  Layer.provide(RedisLockLive, Layer.succeed(RedisTag, redis)),
  Layer.provide(MaiAiLive, MaisongDataLive),
  MaisongDataLive,
);