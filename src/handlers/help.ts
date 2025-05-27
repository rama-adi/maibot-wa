import type { Command } from "@/types/command";

const help: Command = {
    name: "help",
    description: "Tampilkan daftar perintah yang tersedia",
    commandAvailableOn: "both",
    execute: async (ctx) => {
        await ctx.reply("Daftar perintah yang tersedia:\n\n" + ctx.availableCommands.map(cmd => `- ${cmd.name}: ${cmd.description}`).join("\n"));
    }
}

export default help;