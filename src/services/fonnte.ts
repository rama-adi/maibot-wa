import {
    WhatsappGatewayCapabilityInvalid,
    type WhatsAppGatewayPayload,
    WhatsAppGatewayService
} from "@/types/whatsapp-gateway";
import {sendToLogger} from "./logger";
import {Data, Effect, Layer} from "effect";
import {z} from "zod";

const FonnteWebhookPayloadSchema = z.object({
    // Required fields - only what we actually use
    message: z.string(),
    isgroup: z.boolean(),
    sender: z.string(),
    member: z.string(),
    name: z.string(),

    // Optional fields - keeping them in case needed for debugging or future use
    quick: z.boolean().optional(),
    device: z.string().optional(),
    pesan: z.string().optional(),
    pengirim: z.string().optional(),
    text: z.string().optional(),
    location: z.string().optional(),
    url: z.string().optional(),
    type: z.string().optional(),
    extension: z.string().optional(),
    filename: z.string().optional(),
    pollname: z.string().optional(),
    choices: z.array(z.any()).optional(),
    inboxid: z.number().optional(),
    isforwarded: z.boolean().optional(),
});

// Custom error types for better error handling
export class FonnteConfigError extends Data.TaggedError("FonnteConfigError")<{
    message: string
}> { }

export class FonnteWebhookError extends Data.TaggedError("FonnteWebhookError")<{
    message: string
}> { }

export class FonnteApiError extends Data.TaggedError("FonnteApiError")<{
    message: string
    status?: number
}> { }

export const FonnteWhatsappService = Layer.effect(WhatsAppGatewayService)(
    Effect.gen(function* () {
        const FonnteConfigSchema = z.object({
            phoneNumber: z.string().min(1, "Missing phone number"),
            apiKey: z.string().min(1, "Missing API key"),
        });

        const parsedConfig = yield* Effect.try({
            try: () => FonnteConfigSchema.parse({
                phoneNumber: process.env.FONNTE_PHONE_NUMBER ?? "",
                apiKey: process.env.FONNTE_API_KEY ?? ""
            }),
            catch: (error) => new FonnteConfigError({
                message: `Configuration validation failed: ${error}`
            })
        });

        return {
            capabilities: ["sendMessage"],
            handleWebhook: (data: string) =>
                Effect.gen(function* () {
                    const rawPayload = yield* Effect.try({
                        try: () => JSON.parse(data),
                        catch: (error) => new FonnteWebhookError({
                            message: `Failed to parse JSON data: ${error}`
                        })
                    });

                    const payload = yield* Effect.try({
                        try: () => FonnteWebhookPayloadSchema.parse(rawPayload),
                        catch: (error) => new FonnteWebhookError({
                            message: `Invalid webhook payload format: ${error}`
                        })
                    });

                    const messageParts = payload.message.split(" ");

                    if (payload.isgroup) {
                        if (
                            !messageParts[0] ||
                            !messageParts[0].toLowerCase().includes(`@${parsedConfig.phoneNumber}`)
                        ) {
                            return yield* Effect.void;
                        }
                    }

                    const message = payload.message.replace(`@${parsedConfig.phoneNumber}`, "").trim();

                    // Add logging back as an Effect
                    yield* Effect.sync(() =>
                        sendToLogger(`➡️ Sender: ${payload.sender} (${payload.member}), Message: ${payload.message}`)
                    );

                    const result: WhatsAppGatewayPayload = payload.isgroup
                        ? {
                            messageId: null,
                            sender: payload.sender,
                            message: message,
                            group: payload.isgroup,
                            number: payload.member,
                            name: payload.name
                        }
                        : {
                            messageId: null,
                            sender: payload.sender,
                            message: message,
                            group: false,
                            number: payload.sender,
                            name: payload.name
                        };

                    return result;
                }).pipe(
                    Effect.mapError((error) => new Error(`Webhook error: ${error}`))
                ),

            sendReply: (_) => Effect.gen(function* () {
                return yield* Effect.fail(new WhatsappGatewayCapabilityInvalid({
                    capability: "sendContextualReply"
                }))
            }),

            sendMessage: (data: { to: string, message: string }) =>
                Effect.gen(function* () {
                    const url = `https://api.fonnte.com/send`;

                    const response = yield* Effect.tryPromise({
                        try: () => fetch(url, {
                            method: "POST",
                            body: JSON.stringify({
                                target: data.to,
                                message: data.message
                            }),
                            headers: {
                                "Authorization": `${parsedConfig.apiKey}`,
                                "Content-Type": "application/json"
                            }
                        }),
                        catch: (error) => new FonnteApiError({
                            message: `Network request failed: ${error}`,
                        })
                    });

                    if (!response.ok) {
                        const errorBody = yield* Effect.tryPromise({
                            try: () => response.text(),
                            catch: () => "Could not read response body"
                        });

                        return yield* Effect.fail(new FonnteApiError({
                            message: `Failed to send message, data returned from server: ${errorBody}`,
                            status: response.status,
                        }));
                    }

                    return yield * Effect.tryPromise({
                        try: () => response.text(),
                        catch: (error) => new FonnteApiError({
                            message: `Failed to read response body: ${error}`,
                        })
                    });
                }).pipe(
                    Effect.mapError((error) => new Error(`Send message error: ${error}`))
                )
        };
    })
);