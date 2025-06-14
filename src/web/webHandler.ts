import { cleanupController, setupLoggerOnce } from "@/services/logger";
import type { BunRequest } from "bun";
import renderDashboard from "@/web/dashboard/render-dashboard";
import { CommandRouter } from "@/services/command-router";
import { handleBookmarkletRequest, handleIngestRequest } from "./bookmarklet/bookmarklet";
import renderCommandPage from "./dashboard/command-page";
import renderUsersPage from "./dashboard/list-users";

export const webHandler = {
    "/": async (req: BunRequest) => {
        return new Response("Bot running!");
    },
    "/dashboard/streams": async (req: BunRequest) => {
        if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
            return new Response(null, {
                status: 401
            });
        }

        let controller: ReadableStreamDefaultController<any>;
        let isClosed = false;
        let heartbeatInterval: Timer;

        const stream = new ReadableStream({
            start(ctrl) {
                controller = ctrl;
                try {
                    setupLoggerOnce(controller);

                    // Set up heartbeat to keep connection alive
                    heartbeatInterval = setInterval(() => {
                        try {
                            if (!isClosed && controller) {
                                controller.enqueue(`: heartbeat ${Date.now()}\n\n`);
                            } else {
                                clearInterval(heartbeatInterval);
                            }
                        } catch (error) {
                            console.error('Heartbeat failed:', error);
                            clearInterval(heartbeatInterval);
                            isClosed = true;
                        }
                    }, 8000); // Every 8 seconds (under Bun's 10s timeout)

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
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                }
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
                sender: "INTERNAL_ADMIN",
                message: command,
                group: false,
                number: "INTERNAL_ADMIN",
                name: "Tester Admin Account"
            });

            return Response.json({ result });
        }
    },
    "/bookmarklet": {
        async GET(req: BunRequest) {
            return await handleBookmarkletRequest(req);
        }
    },
    "/bookmarklet/ingest": {
        async POST(req: BunRequest) {
            return await handleIngestRequest(req);
        }
    },
    "/dashboard/users": {
        async GET(req: BunRequest) {
            return await renderUsersPage(req);
        }
    }
};