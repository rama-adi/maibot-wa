import { CommandRouter } from "@/services/command-router";
import { Fonnte } from "@/services/fonnte";
import * as fs from "fs";

const LOG_FILE = "maibot.log";

function writeLog(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    // Create file if it doesn't exist
    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, '');
    }
    
    fs.appendFileSync(LOG_FILE, logEntry);
}

const whatsapp = new Fonnte({
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER!,
    apiKey: process.env.WHATSAPP_API_KEY!,
});

const router = new CommandRouter({
    onSend: async (to, msg) => {
        const logMessage = `✅ Sending message to ${to} with message: ${msg}`;
        console.log(logMessage);
        writeLog(logMessage);
        await whatsapp.sendMessage(to, msg);
    },
    onError: async (to, err) => {
        const logMessage = `❌ Error for ${to}: ${err}`;
        console.error(logMessage);
        writeLog(logMessage);
    },
});

// Load commands on startup
await router.loadCommands();
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS?.split(',') || [];

export default {
    async fetch(request: Request): Promise<Response> {
        if (request.method == 'POST') {
            // only allow 103.52.212.50
            const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
            const ipLogMessage = `IP: ${ip}`;
            console.log(ipLogMessage);
            writeLog(ipLogMessage);
            if (ip !== '103.52.212.50') {
                const unauthorizedMessage = 'Unauthorized access attempt';
                writeLog(unauthorizedMessage);
                return new Response('Unauthorized', { status: 401 });
            }
            try {
                const payload = await request.text();
                const result = await whatsapp.handleWebhook(payload);
    
                if (result?.group && !ALLOWED_GROUPS.includes(result.sender)) {
                    const groupUnauthorizedMessage = `Unauthorized group access: ${result.sender}`;
                    writeLog(groupUnauthorizedMessage);
                    return new Response('Unauthorized', { status: 401 });
                }
    
                if (result) {
                    await router.handle(result);
                }
                writeLog('Webhook processed successfully');
                return new Response('OK', { status: 200 });
            } catch (error) {
                const errorMessage = `Webhook error: ${error}`;
                console.error(errorMessage);
                writeLog(errorMessage);
                return new Response('Internal server error', { status: 500 });
            }
        }
        return new Response('MaiBot is running', { status: 200 });
        
    }
};
