import type { ReadableStreamController } from "bun";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export const sseEvents = new EventEmitter();

// Keep track of active controllers for cleanup
const activeControllers = new Set<ReadableStreamDefaultController<any>>();

export function setupLoggerOnce(controller: ReadableStreamDefaultController<any>) {
    // Add controller to active set
    activeControllers.add(controller);
    
    // Send initial retry interval - use string directly
    try {
        controller.enqueue(`retry: 3000\n\n`);
        
        // Send initial connection message
        const connectionId = randomUUID();
        controller.enqueue(`id: ${connectionId}\ndata: 🟢 Connected to activity stream\n\n`);
    } catch (error) {
        console.error('Failed to send initial SSE messages:', error);
        cleanup(controller);
        return;
    }
    
    // Set up heartbeat to keep connection alive (every 5 seconds)
    const heartbeatInterval = setInterval(() => {
        try {
            if (activeControllers.has(controller)) {
                // Send a ping message to keep connection alive
                controller.enqueue(`: heartbeat ${Date.now()}\n\n`);
            } else {
                // Controller no longer active, clear interval
                clearInterval(heartbeatInterval);
            }
        } catch (error) {
            console.error('Failed to send heartbeat:', error);
            clearInterval(heartbeatInterval);
            cleanup(controller);
        }
    }, 5000); // Send ping every 5 seconds
    
    // Store interval reference for cleanup
    (controller as any)._heartbeatInterval = heartbeatInterval;
    
    // Create event listener function that we can remove later
    const logHandler = (data: string) => {
        try {
            // Only send if controller is still active and not closed
            if (activeControllers.has(controller)) {
                controller.enqueue(data);
            }
        } catch (error) {
            // If enqueue fails, remove this controller
            console.error('Failed to enqueue SSE data:', error);
            cleanup(controller);
        }
    };
    
    // Store reference to handler on controller for cleanup
    (controller as any)._logHandler = logHandler;
    
    // Listen for log events and send them to the stream
    sseEvents.on("LOG", logHandler);
}

export function sendToLogger(data: string) {
    // Only emit if there are active controllers
    if (activeControllers.size > 0) {
        const formattedMessage = `id: ${randomUUID()}\ndata: ${data}\n\n`;
        sseEvents.emit("LOG", formattedMessage);
    }
}

function cleanup(controller: ReadableStreamDefaultController<any>) {
    // Remove from active set
    activeControllers.delete(controller);
    
    // Clear heartbeat interval if it exists
    const heartbeatInterval = (controller as any)._heartbeatInterval;
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        delete (controller as any)._heartbeatInterval;
    }
    
    // Remove event listener if it exists
    const logHandler = (controller as any)._logHandler;
    if (logHandler) {
        sseEvents.removeListener("LOG", logHandler);
        delete (controller as any)._logHandler;
    }
}

// Export cleanup function for use in stream cancel
export function cleanupController(controller: ReadableStreamDefaultController<any>) {
    cleanup(controller);
}