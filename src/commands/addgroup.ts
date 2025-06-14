import { configDatabase } from "@/database/drizzle";
import { allowedGroups } from "@/database/schemas/config-schema";
import type { Command } from "@/types/command";
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
    execute: async (ctx) => {
        const [groupIdRaw, rateLimitRaw] = ctx.rawParams.trim().split(/\s+/);
        
        const parsed = addGroupSchema.parse({
            groupId: groupIdRaw,
            rateLimit: rateLimitRaw ? parseInt(rateLimitRaw) : undefined
        });

        await configDatabase
            .insert(allowedGroups)
            .values({
                id: parsed.groupId,
                rateLimit: parsed.rateLimit
            });

        await ctx.reply(`Grup ${parsed.groupId} sudah ditambahkan dengan rate limit ${parsed.rateLimit}!`);
    }
}

export default addgroup;