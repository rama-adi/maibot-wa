export interface CommandContext {
    rawParams: string;
    availableCommands: Omit<Command, "execute">[];
    reply: (msg: string) => Promise<void>;
    noop: () => Promise<void>;
}


export interface Command {
    name: string;
    description: string;
    commandAvailableOn: "group" | "private" | "both";
    usageExample: string;
    execute: (ctx: CommandContext) => Promise<void>;
}

export interface CommandRouterOptions {
    onSend: (to: string, msg: string) => Promise<void>;
    onError: (to: string, err: unknown) => Promise<void>;
}