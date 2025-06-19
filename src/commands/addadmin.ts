import { configDatabase } from "@/database/drizzle";
import { admins, allowedGroups } from "@/database/schemas/config-schema";
import { CommandExecutor } from "@/services/command-executor";
import type { Command, EffectCommand } from "@/types/command";
import { Effect } from "effect";
import z from "zod";

const addadmin: EffectCommand = {
    name: "addadmin",
    enabled: true,
    adminOnly: true,
    description: "[ADMIN] Tambahkan nomor telpon admin ke daftar izin",
    commandAvailableOn: "private",
    usageExample: "`addadmin 628200000000`",
    execute: (ctx) => Effect.gen(function* () {
        const executor = yield* CommandExecutor;
        const numberSchema = z.string();
        const number = numberSchema.parse(ctx.rawParams.trim().toLowerCase());

        yield* Effect.promise(() => configDatabase
            .insert(admins)
            .values({
                id: number
            }));

        yield* executor.reply(`Admin dengan ID ${number} sudah ditambahkan!`);
    })
}

export default addadmin;