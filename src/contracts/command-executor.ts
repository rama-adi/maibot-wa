import { Context, Effect } from "effect";

export class CommandExecutor extends Context.Tag("CommandExecutor")<
    CommandExecutor,
    {
        reply: (message: string) => Effect.Effect<void, Error>;
        replyImage: (imageURL: string, options?: { 
            caption?: string; 
            mime?: string; 
            filename?: string; 
        }) => Effect.Effect<void, Error>;
    }
>() { }