import { createMigrationRunner } from "./scripts/migrate";
import { existsSync, mkdirSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";

interface DrizzleConfig {
    database: string;
    configFolder: string;
    schema: any;
}

interface ParsedKitConfig {
    database?: string;
    configFolder?: string;
    schemaPath?: string;
}

async function loadKitConfig(kitFile: string): Promise<ParsedKitConfig> {
    try {
        // Import the kit file directly as a module
        const configPath = `./drizzle/${kitFile}`;
        const kitModule = await import(configPath);
        const config = kitModule.default;
        
        // Extract values from the actual config object
        const database = config.dbCredentials?.url?.replace('./', '') || '';
        const configFolder = config.out?.replace('./drizzle/', '') || '';
        const schemaPath = config.schema?.replace('./src/', '@/') || '';
        
        return {
            database,
            configFolder,
            schemaPath
        };
    } catch (error) {
        console.error(`❌ Error loading kit file ${kitFile}:`, error);
        return {};
    }
}

async function loadDrizzleConfigurations(): Promise<DrizzleConfig[]> {
    try {
        // Read the drizzle directory
        const drizzleDir = join(process.cwd(), "drizzle");
        const files = await readdir(drizzleDir);
        
        // Filter for .kit.ts files
        const kitFiles = files.filter(file => file.endsWith(".kit.ts"));
        
        if (kitFiles.length === 0) {
            console.log("❌ No .kit.ts files found in drizzle directory");
            return [];
        }
        
        console.log(`📁 Found ${kitFiles.length} drizzle configurations:`, kitFiles);
        
        // Parse configurations from kit files
        const configs: DrizzleConfig[] = [];
        
        for (const file of kitFiles) {
            const parsedConfig = await loadKitConfig(file);
            
            if (parsedConfig.database && parsedConfig.configFolder && parsedConfig.schemaPath) {
                try {
                    // Dynamically import the schema
                    const schema = await import(parsedConfig.schemaPath);
                    
                    configs.push({
                        database: parsedConfig.database,
                        configFolder: parsedConfig.configFolder,
                        schema: schema
                    });
                    
                    console.log(`✅ Loaded config: ${parsedConfig.database} → ${parsedConfig.configFolder}`);
                } catch (importError) {
                    console.error(`❌ Failed to import schema for ${file}:`, parsedConfig.schemaPath);
                    console.error(`   Error:`, importError);
                }
            } else {
                console.warn(`⚠️  Could not parse complete config from ${file}`);
            }
        }
        
        console.log(`📦 Successfully loaded ${configs.length} drizzle configurations`);
        return configs;
        
    } catch (error) {
        console.error("❌ Error loading drizzle configurations:", error);
        return [];
    }
}

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
            const { $ } = await import("bun");
            
            // Get current user info
            const bunUserId = await $`id -u`.text().then(output => output.trim());
            const bunGroupId = await $`id -g`.text().then(output => output.trim());
            console.log(`👤 Current user ID: ${bunUserId}, Group ID: ${bunGroupId}`);
            
            // First try to fix permissions with sudo
            try {
                await $`sudo chown -R ${bunUserId}:${bunGroupId} ${dataDir}`.quiet();
                await $`sudo chmod -R 755 ${dataDir}`.quiet();
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
        
        // Load drizzle configurations dynamically
        console.log("📦 Loading drizzle configurations...");
        const migrations = await loadDrizzleConfigurations();
        
        if (migrations.length === 0) {
            console.log("⚠️  No valid drizzle configurations found, skipping migrations");
        } else {
            // Run migrations with dynamically loaded configs
            console.log("📦 Running database migrations...");
            const migrationRunner = createMigrationRunner();
            await migrationRunner.run(migrations);
            console.log("✅ Migrations completed successfully!");
        }
        
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