import type { ReadableStreamController } from "bun";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export const sseEvents = new EventEmitter();

export function setupLoggerOnce(controller: ReadableStreamDefaultController<any>) {
    // Send initial retry interval
    controller.enqueue(`retry: 3000\n\n`);
    
    // Listen for log events and send them to the stream
    sseEvents.on("LOG", (data) => {
        const queue = [Buffer.from(data)];
        const chunk = queue.shift();
        controller.enqueue(chunk);
    });
}

export function sendToLogger(data: string) {
    sseEvents.emit(
        "LOG",
        `id: ${randomUUID()}\ndata: ${data}\n\n`
    );
}