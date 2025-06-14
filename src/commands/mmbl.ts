import { findUserByPhone } from "@/database/queries/user-query";
import type { Command } from "@/types/command";

const help: Command = {
    name: "mmbl",
    adminOnly: false,
    enabled: false,
    description: "Tutorial cara load data MMBL ke bot (DM ONLY)",
    commandAvailableOn: "private",
    usageExample: "`mmbl`",
    execute: async (ctx) => {
        const user = await findUserByPhone(ctx.rawPayload);
        const page = `${process.env.HOST || ""}/mmbl-import/${user.phoneNumberHash}`;


        let messagePart = "Untuk load data MMBL, silakan buka link ini:";
        messagePart += `\n*Ini adalah link privat milikmu, jangan disebarkan karena orang lain bisa mengedit datanya!*`
        messagePart += `\n\n${page}`

        messagePart += `\n\nAkan ada tutorial cara mengambil data main dari MMBL dan juga form untuk memasukkan data tersebut ke dalam bot!`
        messagePart += `\nPastikan kamu sudah mengerti cara memasang MMBL, dan cara menggunakannya`
        messagePart += `\nDengan memasukkan data play dari MMBL, maka ratingmu akan muncul di bio!`
        messagePart += `\n\nMohon maaf caranya agak belibet karena keterbatasan waktu implementasi.`

        await ctx.reply(messagePart);
    }
}

export default help;