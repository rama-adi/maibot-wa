import { configDatabase } from "@/database/drizzle";
import { allowedGroups } from "@/database/schemas/config-schema";
import { CommandExecutor } from "@/services/command-executor";
import type {Command } from "@/types/command";
import { Effect } from "effect";
import z from "zod";

const addGroupSchema = z.object({
    groupId: z.string().endsWith("@g.us"),
    rateLimit: z.number().int().positive().optional().default(1000)
});

const addgroup: Command = {
    name: "addgroup",
    enabled: true,
    adminOnly: true,
    description: "[ADMIN] Tambahkan group ke daftar izin",
    commandAvailableOn: "private",
    usageExample: "`addgroup 123@g.us 200`",

    execute: (ctx) => Effect.gen(function* () {
        const executor = yield* CommandExecutor;
        const [groupIdRaw, rateLimitRaw] = ctx.rawParams.trim().split(/\s+/);
        const parsed = addGroupSchema.parse({
            groupId: groupIdRaw,
            rateLimit: rateLimitRaw ? parseInt(rateLimitRaw) : undefined
        });

        yield* Effect.promise(() => configDatabase
            .insert(allowedGroups)
            .values({
                id: parsed.groupId,
                rateLimit: parsed.rateLimit
            }));

        yield* executor.reply(`Grup ${parsed.groupId} sudah ditambahkan dengan rate limit ${parsed.rateLimit}!`)
    })
}

export default addgroup;