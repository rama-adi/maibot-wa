import renderDashboard from "@/dashboard/render-dashboard";
import renderCommandPage from "@/dashboard/command-page";
import { setupLoggerOnce, cleanupController, sendToLogger } from "@/services/logger";
import { ALLOWED_GROUPS, commandRouter, whatsapp } from "@/initialize";
import type { BunRequest } from "bun";
import { serve } from "bun";
import { CommandRouter } from "@/services/command-router";


const httpServer = serve({
    routes: {
        "/": async (req) => {
            return new Response("Bot running!");
        },
        "/dashboard/streams": async (req) => {
            if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
                return new Response(null, {
                    status: 401
                });
            }

            let controller: ReadableStreamDefaultController<any>;
            let isClosed = false;

            const stream = new ReadableStream({
                start(ctrl) {
                    controller = ctrl;
                    try {
                        setupLoggerOnce(controller);
                    } catch (error) {
                        console.error('Error setting up logger:', error);
                        if (!isClosed) {
                            controller.error(error);
                        }
                    }
                },
                cancel() {
                    // Mark as closed and clean up
                    isClosed = true;
                    if (controller) {
                        cleanupController(controller);
                    }
                },
            });

            return new Response(stream, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/event-stream;charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            });
        },
        "/dashboard": {
            async GET(req: BunRequest) {
                return await renderDashboard(req)
            },

            async POST(req: BunRequest) {
                const formData = await req.formData();
                const key = formData.get("key")?.toString() ?? "";

                if (key === process.env.DASHBOARD_KEY) {
                    return new Response(null, {
                        status: 302,
                        headers: {
                            "Location": "/dashboard",
                            "Set-Cookie": `DASH_COOKIE=${key}; Path=/; HttpOnly; SameSite=Strict`
                        }
                    });
                }

                return new Response(null, {
                    status: 302,
                    headers: {
                        "Location": "/dashboard"
                    }
                });
            }
        },
        "/dashboard/command": {
            async GET(req: BunRequest) {
                return await renderCommandPage(req);
            },
            async POST(req: BunRequest) {
                if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
                    return new Response(null, {
                        status: 401
                    });
                }

                const formData = await req.formData();
                const command = formData.get("command")?.toString() ?? "";

                let result = "";
                const commandRouter = new CommandRouter({
                    onSend: async (_to, msg) => {
                        result = msg;
                    },
                    onError: async (_to, err) => {
                        result = `❌ Command failed: ${err}`;
                    },
                });

                // Load commands on startup
                await commandRouter.loadCommands();
                await commandRouter.handle({
                    sender: "0000",
                    message: command,
                    group: false,
                    number: "0000",
                    name: "Dashboard"
                });

                return Response.json({ result });
            }
        }
    },
    async fetch(request: Request): Promise<Response> {
        if (request.method == 'POST') {
            // Check if the request path matches the secret webhook path
            const url = new URL(request.url);
            const expectedPath = process.env.SECRET_PATH;
            sendToLogger(`Request path: ${url.pathname}, Expected: ${expectedPath}`);

            if (url.pathname !== expectedPath) {
                return new Response('Unauthorized', { status: 401 });
            }
            try {
                const payload = await request.text();
                const result = await whatsapp.handleWebhook(payload);
    
                if (result?.group && !ALLOWED_GROUPS.includes(result.sender)) {
                    sendToLogger(`Unauthorized group access: ${result.sender}`);
                    return new Response('Unauthorized', { status: 401 });
                }
    
                if (result) {
                    await commandRouter.handle(result);
                }
                
                return new Response('OK', { status: 200 });

            } catch (error) {
                sendToLogger(`Webhook error: ${error}`);
                return new Response('Internal server error', { status: 500 });
            }
        }
        return new Response('MaiBot is running', { status: 200 });
        
    }
});

console.log(`Bun Server listening on ${httpServer.hostname}:${httpServer.port}`)