import { createMigrationRunner } from "./scripts/migrate";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

async function startApplication() {
    try {
        console.log("🚀 Starting application...");
        console.log("📁 Current working directory:", process.cwd());
        
        // Ensure data directory exists with proper permissions
        const dataDir = join(process.cwd(), "data");
        console.log("📂 Data directory path:", dataDir);
        
        if (!existsSync(dataDir)) {
            console.log("📁 Creating data directory...");
            mkdirSync(dataDir, { recursive: true, mode: 0o755 });
        } else {
            console.log("✅ Data directory already exists");
        }
        
        // Run migrations first
        console.log("📦 Running database migrations...");
        const migrationRunner = createMigrationRunner();
        
        // Run migrations with the same config as migrate.ts
        const configSchema = await import("@/database/schemas/config-schema");
        const migrations = [
            {
                database: "bot_config.db",
                configFolder: "config_migrations",
                schema: configSchema
            }
        ];
        
        await migrationRunner.run(migrations);
        console.log("✅ Migrations completed successfully!");
        
        // Start the main application
        console.log("🎯 Starting main application...");
        await import("./index");
        
    } catch (error) {
        console.error("❌ Failed to start application:", error);
        console.error("Stack trace:", error);
        process.exit(1);
    }
}

startApplication(); 