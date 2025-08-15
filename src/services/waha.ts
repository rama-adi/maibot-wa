import { type WhatsAppGatewayPayload, WhatsAppGatewayService } from "@/types/whatsapp-gateway";
import { Data, Effect, Layer } from "effect";
import z, { ZodError } from "zod/v4";
import { handleUrl } from "./utils";

const WahaMessageTypeWehbookSchema = z.object({
    id: z.string(),
    payload: z.object({
        id: z.string(),
        body: z.string(),
        participant: z.string().nullable(),
        from: z.string(),
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


export const WahaWhatsappService = Layer.effect(WhatsAppGatewayService)(
    Effect.gen(function* () {
        const WahaConfigSchema = z.object({
            WAHA_PHONE_NUMBER: z.string("WAHA phone number is required").min(4, "Phone number must be at least 4 characters"),
            WAHA_API_KEY: z.string("WAHA API key is required").min(1, "API key cannot be empty"),
            WAHA_HMAC_SECRET: z.string("WAHA HMAC secret is required").min(1, "HMAC secret cannot be empty"),
            WAHA_API_PATH: z.url("WAHA API path must be a valid URL").min(1, "WAHA hosting URL path is required (with /api)"),
            WAHA_SESSION: z.string("WAHA session name is required").min(1, "Session identification name cannot be empty")
        });

        const parsedConfig = yield* Effect.try({
            try: () => WahaConfigSchema.parse(process.env),
            catch: (error) => {
                if (error instanceof ZodError) {
                    const errors = error.issues.map(issue => `- ${issue.message} (Env name: ${issue.path})`).join('\n');
                    return new WahaConfigError({
                        message: "WAHA configuration validation failed:\n" + errors
                    });
                }
                return new WahaConfigError({
                    message: "WAHA configuration validation failed:\n" + String(error)
                });
            }
        });

        return {
            name: "WAHA",
            capabilities: ["sendMessage", "sendContextualReply"],
            handleWebhook: (data, headers) =>
                Effect.gen(function* () {
                    const rawPayload = yield* Effect.try({
                        try: () => JSON.parse(data),
                        catch: (error) => new WahaWebhookError({
                            message: "Failed to parse JSON " + error
                        })
                    });

                    // Not message = don't care
                    if (rawPayload?.event !== "message") {
                        return yield* Effect.void;
                    }

                    yield* verifyHmac(
                        data,
                        headers.get("x-webhook-hmac") || "",
                        parsedConfig.WAHA_HMAC_SECRET
                    );

                    const webhookMessage = yield* Effect.try({
                        try: () => WahaMessageTypeWehbookSchema.parse(rawPayload),
                        catch: (error) => new WahaWebhookError({
                            message: `Invalid webhook payload format: ${error}`
                        })
                    });

                    yield* Effect.tryPromise({
                        try: () => fetch(
                            handleUrl(parsedConfig.WAHA_API_PATH, "sendSeen"),
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    "session": parsedConfig.WAHA_SESSION,
                                    "chatId": webhookMessage.payload.from
                                }),
                                headers: {
                                    'Content-type': 'application/json',
                                    'X-Api-Key': parsedConfig.WAHA_API_KEY,
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
                            !messageParts[0].toLowerCase().includes(`@${parsedConfig.WAHA_PHONE_NUMBER}`)
                        ) {
                            return yield* Effect.void;
                        }
                    }

                    const from = webhookMessage.payload.from.replaceAll("@s.whatsapp.net", "@c.us");
                    const name = webhookMessage.payload._data.Info.PushName;
                    const message = webhookMessage.payload.body.replace(`@${parsedConfig.WAHA_PHONE_NUMBER}`, "").trim();

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
                        handleUrl(parsedConfig.WAHA_API_PATH, "sendText"), {
                        method: "POST",
                        body: JSON.stringify({
                            chatId: data.to,
                            session: parsedConfig.WAHA_SESSION,
                            reply_to: data.messageId,
                            text: data.message
                        }),
                        headers: {
                            'Content-type': 'application/json',
                            'X-Api-Key': parsedConfig.WAHA_API_KEY,
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

                return yield* Effect.tryPromise({
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
                            handleUrl(parsedConfig.WAHA_API_PATH, "sendText"), {
                            method: "POST",
                            body: JSON.stringify({
                                chatId: data.to,
                                session: parsedConfig.WAHA_SESSION,
                                text: data.message
                            }),
                            headers: {
                                'Content-type': 'application/json',
                                'X-Api-Key': parsedConfig.WAHA_API_KEY,
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

                    return yield* Effect.tryPromise({
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
