import {Database} from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as configSchema from "@/database/schemas/config-schema";
import { join } from "path";
const projectRoot = process.cwd();

type MigrationConfig = {
    database: string;
    configFolder: string;
    schema?: Record<string, any>;
}

type MigrationRunner = {
    run: (configs: MigrationConfig[]) => Promise<void>;
    runSingle: (config: MigrationConfig) => Promise<void>;
}


const createMigrationRunner = (): MigrationRunner => {
    const logMigrationStart = () => {
        console.log("\n🚀 Starting database migrations...\n");
        console.log("Path: ", projectRoot);
        return Date.now();
    };

    const logMigrationEnd = (startTime: number) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log("\n✨ Migrations completed successfully!");
        console.log(`⏱️  Duration: ${duration}ms\n`);
    };

    const logMigrationError = (error: Error) => {
        console.error("\n❌ Migration failed!");
        console.error("📝 Error details:");
        console.error(`   ${error.message}\n`);
        throw error;
    };

    const initializeDatabase = (database: Database, schema?: Record<string, any>) => {
        return schema ? drizzle(database, { schema }) : drizzle(database);
    };

    const executeMigration = async (db: any, migrationsFolder: string) => {
        migrate(db, { migrationsFolder });
    };

    const runSingle = async (config: MigrationConfig) => {
        try {
            const dataDir = join(projectRoot, "data");
            const fullPath = join(dataDir, config.database)
            
            // Ensure data directory exists
            try {
                await Bun.write(join(dataDir, ".gitkeep"), "");
            } catch (error) {
                // Directory might not exist, try to create it
                console.log(`📁 Creating data directory: ${dataDir}`);
            }
            
            // Check if database file exists
            if (await Bun.file(fullPath).exists()) {
                console.log(`⏭️  Database already exists, skipping: ${config.database}`);
                return;
            }

            const configPath = join(projectRoot, "drizzle", config.configFolder);
            if (!(await Bun.file(join(configPath, "meta", "_journal.json")).exists())) {
                throw new Error(`💥 Config path doesn't exist: ${configPath}`)
                return;
            }

            console.log(`🔧 Creating database: ${fullPath}`);
            await Bun.write(fullPath, "");
            // Create new database since it doesn't exist
            const db = initializeDatabase(new Database(fullPath), config.schema);
            await executeMigration(db, configPath);
            console.log(`✅ Migration completed for: ${config.configFolder}`);
        } catch (error) {
            console.error(`❌ Migration failed for: ${config.configFolder}`);
            throw error;
        }
    };

    const run = async (configs: MigrationConfig[]) => {
        const startTime = logMigrationStart();

        try {
            for (const config of configs) {
                await runSingle(config);
            }
            logMigrationEnd(startTime);
        } catch (error) {
            logMigrationError(error as Error);
        }
    };

    return { run, runSingle };
};

// Export the migration runner for use in other files
export { createMigrationRunner, type MigrationConfig };