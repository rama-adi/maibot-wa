import { type WhatsAppGatewayPayload, WhatsAppGatewayService } from "@/contracts/whatsapp-gateway";
import { handleUrl } from "@/utils/url";
import { Config, Data, Effect, Layer, Schema, Redacted } from "effect";

const WahaMessageTypeWehbookSchema = Schema.Struct({
    id: Schema.String,
    payload: Schema.Struct({
        id: Schema.String,
        body: Schema.String,
        participant: Schema.Union(Schema.String, Schema.Null),
        from: Schema.String,
        _data: Schema.Struct({
            Info: Schema.Struct({
                PushName: Schema.String
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


const wahaConfig = Config.all({
    phoneNumber: Config.string("WAHA_PHONE_NUMBER").pipe(
        Config.validate({
            message: "Phone number must be at least 4 characters",
            validation: (value) => value.length >= 4
        })
    ),
    apiKey: Config.redacted(Config.string("WAHA_API_KEY").pipe(
        Config.validate({
            message: "API key cannot be empty",
            validation: (value) => value.length >= 1
        })
    )),
    hmacSecret: Config.redacted(Config.string("WAHA_HMAC_SECRET").pipe(
        Config.validate({
            message: "HMAC secret cannot be empty",
            validation: (value) => value.length >= 1
        })
    )),
    apiPath: Config.string("WAHA_API_PATH").pipe(
        Config.validate({
            message: "WAHA hosting URL path is required (with /api)",
            validation: (value) => value.length >= 1
        })
    ),
    session: Config.string("WAHA_SESSION").pipe(
        Config.validate({
            message: "Session identification name cannot be empty",
            validation: (value) => value.length >= 1
        })
    )
});

export const WahaWhatsappService = Layer.effect(WhatsAppGatewayService)(
    Effect.gen(function* () {
        const config = yield* Effect.try({
            try: () => wahaConfig,
            catch: (error) => new WahaConfigError({
                message: `Failed to load WAHA configuration: ${error}`
            })
        }).pipe(Effect.flatten);

        return {
            name: "WAHA",
            capabilities: ["sendMessage", "sendContextualReply", "sendAttachment"],
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
                        Redacted.value(config.hmacSecret)
                    );

                    const webhookMessage = yield* Effect.try({
                        try: () => Schema.decodeUnknownSync(WahaMessageTypeWehbookSchema)(rawPayload),
                        catch: (error) => new WahaWebhookError({
                            message: `Invalid webhook payload format: ${error}`
                        })
                    });

                    yield* Effect.tryPromise({
                        try: () => fetch(
                            handleUrl(config.apiPath, "sendSeen"),
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    "session": config.session,
                                    "chatId": webhookMessage.payload.from
                                }),
                                headers: {
                                    'Content-type': 'application/json',
                                    'X-Api-Key': Redacted.value(config.apiKey),
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
                            !messageParts[0].toLowerCase().includes(`@${config.phoneNumber}`)
                        ) {
                            return yield* Effect.void;
                        }
                    }

                    const from = webhookMessage.payload.from.replaceAll("@s.whatsapp.net", "@c.us");
                    const name = webhookMessage.payload._data.Info.PushName;
                    const message = webhookMessage.payload.body.replace(`@${config.phoneNumber}`, "").trim();

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
                        handleUrl(config.apiPath, "sendText"), {
                        method: "POST",
                        body: JSON.stringify({
                            chatId: data.to,
                            session: config.session,
                            reply_to: data.messageId,
                            text: data.message
                        }),
                        headers: {
                            'Content-type': 'application/json',
                            'X-Api-Key': Redacted.value(config.apiKey),
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
                            handleUrl(config.apiPath, "sendText"), {
                            method: "POST",
                            body: JSON.stringify({
                                chatId: data.to,
                                session: config.session,
                                text: data.message
                            }),
                            headers: {
                                'Content-type': 'application/json',
                                'X-Api-Key': Redacted.value(config.apiKey),
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