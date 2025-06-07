export interface CommandContext {
    rawParams: string;
    availableCommands: Omit<Command, "execute">[];
    isAdmin: boolean;
    reply: (msg: string) => Promise<void>;
}


export interface Command {
    name: string;
    description: string;
    commandAvailableOn: "group" | "private" | "both";
    usageExample: string;
    enabled: boolean;
    adminOnly: boolean;
    execute: (ctx: CommandContext) => Promise<void>;
}

export interface CommandRouterOptions {
    onSend: (to: string, msg: string) => Promise<void>;
    onError: (to: string, err: unknown) => Promise<void>;
}