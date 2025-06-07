import {Database} from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as configSchema from "@/database/schemas/config-schema";

type MigrationConfig = {
    database: string;
    configFolder: string;
    schema?: Record<string, any>;
}

type MigrationRunner = {
    run: (configs: MigrationConfig[]) => Promise<void>;
    runSingle: (config: MigrationConfig) => Promise<void>;
}

// Add your migrations here - easy to extend!
const migrations: MigrationConfig[] = [
    {
        database: "data/bot_config.db",
        configFolder: "config_migrations",
        schema: configSchema
    }
    // Add more migrations here as needed:
    // {
    //     database: new Database("data/another.db"),
    //     configFolder: "another_migrations",
    //     schema: anotherSchema
    // }
];

const createMigrationRunner = (): MigrationRunner => {
    const logMigrationStart = () => {
        console.log("\n🚀 Starting database migrations...\n");
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
            // Check if database file exists
            if (await Bun.file(config.database).exists()) {
                console.log(`⏭️  Database already exists, skipping: ${config.database}`);
                return;
            }

            // Create new database since it doesn't exist
            const db = initializeDatabase(new Database(config.database), config.schema);
            await executeMigration(db, `${__dirname}/../drizzle/${config.configFolder}`);
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

// Main function to run all defined migrations
async function runMigrations() {
    const migrationRunner = createMigrationRunner();
    await migrationRunner.run(migrations);
    process.exit(0);
}

// Only run migrations if this file is executed directly
if (import.meta.main) {
    runMigrations().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}