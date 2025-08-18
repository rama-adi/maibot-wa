import { type WhatsAppGatewayPayload, WhatsAppGatewayService } from "@/contracts/whatsapp-gateway";
import { handleUrl } from "@/utils/url";
import { Config, Data, Effect, Layer, Schema, Redacted } from "effect";

const WahaWSMessageTypeWehbookSchema = Schema.Struct({
    id: Schema.String,
    payload: Schema.Struct({
        id: Schema.String,
        body: Schema.String,
        participant: Schema.Union(Schema.String, Schema.Null),
        from: Schema.String,
        _data: Schema.Struct({
            Info: Schema.Struct({
                PushName: Schema.String,
                SenderAlt: Schema.String,
                Sender: Schema.String,
                IsGroup: Schema.Boolean
            }),

        })
    })
});

// Custom error types for better error handling
export class WahaWSConfigError extends Data.TaggedError("WahaWSConfigError")<{
    message: string
}> { }

export class WahaWSWebhookError extends Data.TaggedError("WahaWSWebhookError")<{
    message: string
}> { }

export class WahaWSApiError extends Data.TaggedError("WahaWSApiError")<{
    message: string
    status?: number
}> { }

export class WahaWSValidationError extends Data.TaggedError("WahaWSValidationError")<{
    message: string
    field: string
}> { }


export const wahaWSConfig = Config.all({
    phoneNumber: Config.string("WAHAWS_PHONE_NUMBER").pipe(
        Config.validate({
            message: "Phone number must be at least 4 characters",
            validation: (value) => value.length >= 4
        })
    ),
    apiKey: Config.redacted(Config.string("WAHAWS_API_KEY").pipe(
        Config.validate({
            message: "API key cannot be empty",
            validation: (value) => value.length >= 1
        })
    )),
    apiPath: Config.string("WAHAWS_API_PATH").pipe(
        Config.validate({
            message: "WAHAWS hosting URL path is required (with /api)",
            validation: (value) => value.length >= 1
        })
    ),
    jid: Config.string("WAHAWS_JID").pipe(
        Config.validate({
            message: "JID cannot be empty",
            validation: (value) => value.length >= 1
        })
    ),
    wssUrl: Config.string("WAHAWS_WEBSOCKET_PATH").pipe(
        Config.validate({
            message: "WAHAWS Websocket path is required",
            validation: (value) => value.length >= 1
        })
    ),
    session: Config.string("WAHAWS_SESSION").pipe(
        Config.validate({
            message: "Session identification name cannot be empty",
            validation: (value) => value.length >= 1
        })
    )
});

export const WahaWSWhatsappService = Layer.effect(WhatsAppGatewayService)(
    Effect.gen(function* () {
        const config = yield* Effect.try({
            try: () => wahaWSConfig,
            catch: (error) => new WahaWSConfigError({
                message: `Failed to load WAHAWS configuration: ${error}`
            })
        }).pipe(Effect.flatten);

        return {
            name: "WAHAWS",
            capabilities: ["sendMessage", "sendContextualReply", "sendAttachment"],
            handleWebhook: (data, _) => Effect.gen(function* () {
                const rawPayload = yield* Effect.try({
                    try: () => JSON.parse(data),
                    catch: (error) => new WahaWSWebhookError({
                        message: "Failed to parse JSON " + error
                    })
                });

                // Not message = don't care
                if (rawPayload?.event !== "message") {
                    return yield* Effect.void;
                }

                const webhookMessage = yield* Effect.try({
                    try: () => Schema.decodeUnknownSync(WahaWSMessageTypeWehbookSchema)(rawPayload),
                    catch: (error) => new WahaWSWebhookError({
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
                    catch: (error) => new WahaWSApiError({
                        message: `Failed to send seen message: ${error}`,
                    })
                });

                const messageParts = webhookMessage.payload.body.split(" ");

                // Group check. if webhookMessage.payload.participant == null => DM
                if (webhookMessage.payload._data.Info.IsGroup) {
                    if (
                        !messageParts[0] ||
                        !messageParts[0].toLowerCase().includes(`@${config.jid}`)
                    ) {
                        return yield* Effect.void;
                    }
                }


                const name = webhookMessage.payload._data.Info.PushName;
                const message = webhookMessage.payload.body.replace(`@${config.jid}`, "").trim();

                // // Add logging back as an Effect
                // yield* Effect.sync(() =>
                //     sendToLogger(`➡️ Sender: ${payload.sender} (${payload.member}), Message: ${payload.message}`)
                // );

                // Extract sender and number based on group status
                const senderInfo = webhookMessage.payload._data.Info.IsGroup
                    ? webhookMessage.payload._data.Info.SenderAlt?.split(':')[0]
                    : webhookMessage.payload._data.Info.Sender?.split(':')[0];

                // Validate that sender and number are not empty
                if (!senderInfo || senderInfo.trim() === '') {
                    return yield* Effect.fail(new WahaWSValidationError({
                        message: webhookMessage.payload._data.Info.IsGroup
                            ? "SenderAlt cannot be empty for group messages"
                            : "Sender cannot be empty for direct messages",
                        field: webhookMessage.payload._data.Info.IsGroup ? "SenderAlt" : "Sender"
                    }));
                }

                const result: WhatsAppGatewayPayload = {
                    id: webhookMessage.id,
                    messageId: webhookMessage.payload.id,
                    sender: webhookMessage.payload._data.Info.Sender,
                    message: message,
                    group: webhookMessage.payload._data.Info.IsGroup,
                    number: senderInfo,
                    name: name
                };

                return result;
            }),

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
                    catch: (error) => new WahaWSApiError({
                        message: `Network request failed: ${error}`,
                    })
                });

                if (!response.ok) {
                    const errorBody = yield* Effect.tryPromise({
                        try: () => response.text(),
                        catch: () => new Error("Could not read response body")
                    });

                    return yield* Effect.fail(new WahaWSApiError({
                        message: `Failed to send message, data returned from server: ${errorBody}`,
                        status: response.status,
                    }));
                }

                return yield* Effect.tryPromise({
                    try: () => response.text(),
                    catch: (error) => new WahaWSApiError({
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
                        catch: (error) => new WahaWSApiError({
                            message: `Network request failed: ${error}`,
                        })
                    });

                    if (!response.ok) {
                        const errorBody = yield* Effect.tryPromise({
                            try: () => response.text(),
                            catch: () => "Could not read response body"
                        });

                        return yield* Effect.fail(new WahaWSApiError({
                            message: `Failed to send message, data returned from server: ${errorBody}`,
                            status: response.status,
                        }));
                    }

                    return yield* Effect.tryPromise({
                        try: () => response.text(),
                        catch: (error) => new WahaWSApiError({
                            message: `Failed to read response body: ${error}`,
                        })
                    });
                }).pipe(
                    Effect.mapError((error) => new Error(`Send message error: ${error}`))
                )
        };
    })
)