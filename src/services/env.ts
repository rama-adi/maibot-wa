import { Context, Layer, Effect, Data } from "effect";
import { z, ZodError } from "zod/v4";

export const EnvSchema = z.object({
   HOST: z.url("Missing host (for displaying the app URL)"),
   TYPESENSE_HOST: z.string("Missing typesense (for querying data)").min(1),
   DASHBOARD_KEY: z.string("Missing dashboard key").min(8, "Minimum 8 chars"),
   ENV: z.enum(['development', 'production'], 'Please specify either development or production environment!')
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export class EnvConfigError extends Data.TaggedError("EnvConfigError")<{
    message: string;
}> { }

export class Env extends Context.Tag("Env")<Env, EnvConfig>() { }

export const EnvLive = Layer.effect(
    Env,
    Effect.gen(function* () {
        try {
            // Let Zod handle everything - much cleaner!
            const config = EnvSchema.parse(process.env);
            return config;
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map(issue => `- ${issue.message} (Env name: ${issue.path})`).join('\n');
                return yield* Effect.fail(new EnvConfigError({
                    message: `Base environment variables validation failed:\n${errors}`
                }));
            }
            return yield* Effect.fail(new EnvConfigError({
                message: `Base environment variables validation failed:\n${String(error)}`
            }));
        }
    })
);
