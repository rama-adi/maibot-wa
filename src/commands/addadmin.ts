import { configDatabase } from "@/database/drizzle";
import { admins, allowedGroups } from "@/database/schemas/config-schema";
import type { Command } from "@/types/command";
import z from "zod";

const addadmin: Command = {
    name: "addadmin",
    enabled: true,
    adminOnly: true,
    description: "[ADMIN] Tambahkan nomor telpon admin ke daftar izin",
    commandAvailableOn: "private",
    usageExample: "`addadmin 628200000000`",
    execute: async (ctx) => {
        const numberSchema = z.string();
        const number = numberSchema.parse(ctx.rawParams.trim().toLowerCase());

        await configDatabase
            .insert(admins)
            .values({
                id: number
            })

        await ctx.reply(`Admin dengan ID ${number} sudah ditambahkan!`);
    }
}

export default addadmin;