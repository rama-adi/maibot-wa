import { CommandRouter } from "@/services/command-router";
import * as readline from "readline";

async function main() {
    const router = new CommandRouter({
        onSend: async (to, msg) => {
            console.log("--------------------------------");
            console.log(`Sending to ${to} message result:`);
            console.log(msg);
            console.log("--------------------------------");
        },
        onError: async (to, err) => {
            console.log("--------------------------------");
            console.error("Command error:", err);
            console.log("--------------------------------");
        },
    });

    await router.loadCommands();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Command Router REPL - Type commands to test them (type 'exit' to quit)");
    console.log("Format: <command> [args]");
    console.log("Examples: help, minfo yellow, gateinfo");
    console.log("--------------------------------");

    const askQuestion = (): Promise<string> => {
        return new Promise((resolve) => {
            rl.question('> ', (answer) => {
                resolve(answer);
            });
        });
    };

    while (true) {
        try {
            const input = await askQuestion();
            
            if (input.trim().toLowerCase() === 'exit') {
                console.log("Goodbye!");
                break;
            }

            if (input.trim() === '') {
                continue;
            }

            // Simulate a WhatsApp message
            await router.handle({
                sender: "6282147077374",
                message: input,
                group: false,
                number: "6282147077374",
                name: "Test User",
            });
        } catch (error) {
            console.error("REPL error:", error);
        }
    }

    rl.close();
}

main();