import renderDashboard from "@/dashboard/render-dashboard";
import renderCommandPage from "@/dashboard/command-page";
import { setupLoggerOnce } from "@/services/logger";
import { commandRouter } from "@/initialize";
import type { BunRequest } from "bun";



Bun.serve({
    routes: {
        "/dashboard/streams": async (req) => {
            if (req.cookies.get("DASH_COOKIE") !== process.env.DASHBOARD_KEY) {
                return new Response(null, {
                    status: 401
                });
            }

            const stream = new ReadableStream({
                start(controller) {
                    setupLoggerOnce(controller);
                },
                cancel(controller: ReadableStreamDefaultController) {
                    controller.close();
                },
            });
            
            return new Response(stream, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/event-stream;charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
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

                const result = await commandRouter.handleAndGetResult({
                    sender: "0000",
                    message: command,
                    group: false,
                    number: "0000",
                    name: "Dashboard"
                });

                return Response.json({ result: result ?? "" });
            }
        }
    },
    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,
        // Echo console logs from the browser to the server
        console: true,
    },
});