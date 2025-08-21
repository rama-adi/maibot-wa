import { Context, Data, Effect } from "effect";


export class MaiAi extends Context.Tag("MaiAi")<
    MaiAi,
    {
        infer: (prompt: string) => Effect.Effect<string, never, never>
    }
>() { }