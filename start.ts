import { createMigrationRunner } from "./scripts/migrate";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

async function startApplication() {
    try {
        console.log("🚀 Starting application...");
        console.log("📁 Current working directory:", process.cwd());
        console.log("🌐 Deployment platform:", process.env.COOLIFY_APP_ID ? "Coolify" : "Other");
        
        // Ensure data directory exists with proper permissions
        const dataDir = join(process.cwd(), "data");
        console.log("📂 Data directory path:", dataDir);
        
        if (!existsSync(dataDir)) {
            console.log("📁 Creating data directory...");
            mkdirSync(dataDir, { recursive: true, mode: 0o755 });
        } else {
            console.log("✅ Data directory already exists");
        }
        
        // Fix permissions for volume mount (Coolify-compatible)
        try {
            console.log("🔧 Checking and fixing permissions for Coolify deployment...");
            const { execSync } = await import("child_process");
            
            // Get current user info
            const bunUserId = execSync("id -u", { encoding: 'utf-8' }).trim();
            const bunGroupId = execSync("id -g", { encoding: 'utf-8' }).trim();
            console.log(`👤 Current user ID: ${bunUserId}, Group ID: ${bunGroupId}`);
            
            // First try to fix permissions with sudo
            try {
                execSync(`sudo chown -R ${bunUserId}:${bunGroupId} ${dataDir}`, { stdio: 'pipe' });
                execSync(`sudo chmod -R 755 ${dataDir}`, { stdio: 'pipe' });
                console.log("✅ Permissions fixed with sudo");
            } catch (sudoError) {
                console.log("⚠️  Sudo approach failed, trying direct permission test...");
                
                // Test if we can write directly
                const testFile = join(dataDir, ".permission_test");
                const fs = await import("fs/promises");
                await fs.writeFile(testFile, "test");
                await fs.unlink(testFile);
                console.log("✅ Direct write permissions confirmed");
            }
        } catch (error) {
            console.error("❌ Permission issues detected. Trying to continue anyway...");
            console.error("🔍 Error details:", error instanceof Error ? error.message : String(error));
            
            // Don't throw here, let the migration attempt and potentially fail with a better error
            console.log("🚀 Proceeding with migration attempt...");
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