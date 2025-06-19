import {type WhatsAppGatewayPayload, WhatsAppGatewayService} from "@/types/whatsapp-gateway";
import {Data, Effect, Layer} from "effect";
import z from "zod";

const WahaMessageTypeWehbookSchema = z.object({
    id: z.string(),
    me: z.object({
        id: z.string().endsWith("@c.us"),
        pushName: z.string(),
        jid: z.string().endsWith("@s.whatsapp.net")
    }),
    payload: z.object({
        id: z.string(),
        body: z.string(),
        participant: z.string().nullable(),
        from: z.string().endsWith("@c.us"),
        _data: z.object({
            Info: z.object({
                PushName: z.string()
            })
        })
    })
});

// Custom error types for better error handling
export class WahaConfigError extends Data.TaggedError("WahaConfigError")<{
    message: string
}> { }

export class WahaWebhookError extends Data.TaggedError("WahaWebhookError")<{
    message: string
}> { }

export class WahaApiError extends Data.TaggedError("WahaApiError")<{
    message: string
    status?: number
}> { }

const verifyHmac = (
    payload: string,
    signature: string,
    key: string
) => Effect.gen(function* () {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.startsWith('sha256=')
        ? signature.slice(7)
        : signature;

    const hasher = yield* Effect.try({
        try: () => {
            const hasher = new Bun.CryptoHasher("sha256", key);
            hasher.update(payload);
            return hasher.digest("hex");
        },
        catch: (error) => new WahaWebhookError({
            message: `Failed to compute HMAC: ${error}`
        })
    });

    // Constant-time comparison to prevent timing attacks
    return yield* Effect.try({
        try: () => {
            if (hasher.length !== cleanSignature.length) {
                return false;
            }

            let result = 0;
            for (let i = 0; i < hasher.length; i++) {
                result |= hasher.charCodeAt(i) ^ cleanSignature.charCodeAt(i);
            }
            return result === 0;
        },
        catch: (error) => new WahaWebhookError({
            message: `Failed to verify HMAC signature: ${error}`
        })
    });
});

const handleUrl = (...url: string[]) => {
    return url
        .join('/')
        .replace(/\/+/g, '/') // Replace multiple consecutive slashes with single slash
        .replace(/\/+$/, ''); // Remove trailing slashes
};

export const WahaWhatsappService = Layer.effect(WhatsAppGatewayService)(
    Effect.gen(function* () {
        const WahaConfigSchema = z.object({
            phoneNumber: z.string().min(1, "Missing phone number"),
            apiKey: z.string().min(1, "Missing API key"),
            hmacSecret: z.string().min(1, "Missing HMAC secret"),
            apiPath: z.string().url().min(1, "missing WAHA hosting URL path (with /api)"),
            session: z.string().min(1, "Missing session identification name")
        });

        const parsedConfig = yield* Effect.try({
            try: () => WahaConfigSchema.parse({
                phoneNumber: process.env.WAHA_PHONE_NUMBER ?? "",
                apiKey: process.env.WAHA_API_KEY ?? "",
                hmacSecret: process.env.WAHA_HMAC_SECRET ?? "",
                apiPath: process.env.WAHA_API_PATH ?? "",
                session: process.env.WAHA_SESSION ?? "",
            }),
            catch: (error) => new WahaConfigError({
                message: `Configuration validation failed: ${error}`
            })
        });

        return {
            capabilities: ["sendMessage", "sendContextualReply"],
            handleWebhook: (data, headers) =>
                Effect.gen(function* () {
                    const rawPayload = yield* Effect.try({
                        try: () => JSON.parse(data),
                        catch: (error) => new WahaWebhookError({
                            message: `Failed to parse JSON data: ${error}`
                        })
                    });

                    // Not message = don't care
                    if (rawPayload?.event !== "message" && !headers.get("x-webhook-hmac")) {
                        return yield* Effect.void;
                    }

                    yield* verifyHmac(
                        data,
                        headers.get("x-webhook-hmac") || "",
                        parsedConfig.hmacSecret
                    );

                    const webhookMessage = yield* Effect.try({
                        try: () => WahaMessageTypeWehbookSchema.parse(rawPayload),
                        catch: (error) => new WahaWebhookError({
                            message: `Invalid webhook payload format: ${error}`
                        })
                    });

                    yield* Effect.tryPromise({
                        try: () => fetch(
                            handleUrl(parsedConfig.apiPath, "sendSeen"),
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    "session": parsedConfig.session,
                                    "chatId": webhookMessage.payload.from
                                }),
                                headers: {
                                    "Authorization": `${parsedConfig.apiKey}`,
                                    "Content-Type": "application/json"
                                }
                            }),
                        catch: (error) => new WahaApiError({
                            message: `Failed to send seen message: ${error}`,
                        })
                    });

                    const messageParts = webhookMessage.payload.body.split(" ");

                    // Group check. if webhookMessage.payload.participant == null => DM
                    if (webhookMessage.payload.participant) {
                        if (
                            !messageParts[0] ||
                            !messageParts[0].toLowerCase().includes(`@${parsedConfig.phoneNumber}`)
                        ) {
                            return yield* Effect.void;
                        }
                    }

                    const from = webhookMessage.payload.from.replaceAll("@s.whatsapp.net", "@c.us");
                    const name = webhookMessage.payload._data.Info.PushName;
                    const message = webhookMessage.payload.body.replace(`@${parsedConfig.phoneNumber}`, "").trim();

                    // // Add logging back as an Effect
                    // yield* Effect.sync(() =>
                    //     sendToLogger(`➡️ Sender: ${payload.sender} (${payload.member}), Message: ${payload.message}`)
                    // );

                    const result: WhatsAppGatewayPayload = webhookMessage.payload.participant
                        ? {
                            messageId: webhookMessage.payload.id,
                            sender: from,
                            message: message,
                            group: true,
                            number: webhookMessage.payload.participant.replace("@c.us", ""),
                            name: name
                        }
                        : {
                            messageId: webhookMessage.payload.id,
                            sender: from,
                            message: message,
                            group: false,
                            number: webhookMessage.payload.from.replace("@c.us", ""),
                            name: name
                        };

                    return result;
                }).pipe(
                    Effect.mapError((error) => new Error(`Webhook error: ${error}`))
                ),

            sendReply: (data) => Effect.gen(function* () {

                const response = yield* Effect.tryPromise({
                    try: () => fetch(
                        handleUrl(parsedConfig.apiPath, "sendText"), {
                        method: "POST",
                        body: JSON.stringify({
                            chatId: data.to,
                            session: parsedConfig.session,
                            reply_to: data.messageId,
                            text: data.message
                        }),
                        headers: {
                            'Content-type': 'application/json',
                            'X-Api-Key': parsedConfig.apiKey,
                        }
                    }),
                    catch: (error) => new WahaApiError({
                        message: `Network request failed: ${error}`,
                    })
                });

                if (!response.ok) {
                    const errorBody = yield* Effect.tryPromise({
                        try: () => response.text(),
                        catch: () => new Error("Could not read response body")
                    });

                    return yield* Effect.fail(new WahaApiError({
                        message: `Failed to send message, data returned from server: ${errorBody}`,
                        status: response.status,
                    }));
                }

                return yield * Effect.tryPromise({
                    try: () => response.text(),
                    catch: (error) => new WahaApiError({
                        message: `Failed to read response body: ${error}`,
                    })
                });
            }).pipe(
                Effect.mapError((error) => new Error(`Send reply error: ${error}`))
            ),

            sendMessage: (data: { to: string, message: string }) =>
                Effect.gen(function* () {
                    const response = yield* Effect.tryPromise({
                        try: () => fetch(
                            handleUrl(parsedConfig.apiPath, "sendText"), {
                            method: "POST",
                            body: JSON.stringify({
                                chatId: data.to,
                                session: parsedConfig.session,
                                text: data.message
                            }),
                            headers: {
                                'Content-type': 'application/json',
                                'X-Api-Key': parsedConfig.apiKey,
                            }
                        }),
                        catch: (error) => new WahaApiError({
                            message: `Network request failed: ${error}`,
                        })
                    });

                    if (!response.ok) {
                        const errorBody = yield* Effect.tryPromise({
                            try: () => response.text(),
                            catch: () => "Could not read response body"
                        });

                        return yield* Effect.fail(new WahaApiError({
                            message: `Failed to send message, data returned from server: ${errorBody}`,
                            status: response.status,
                        }));
                    }

                    return yield * Effect.tryPromise({
                        try: () => response.text(),
                        catch: (error) => new WahaApiError({
                            message: `Failed to read response body: ${error}`,
                        })
                    });
                }).pipe(
                    Effect.mapError((error) => new Error(`Send message error: ${error}`))
                )
        };
    })
)
