import { maimaiAssistant } from "@/services/assistant";

async function main() {
    const result = await maimaiAssistant("Info kaleidxscope maimai");

    console.log(result);
}

main();