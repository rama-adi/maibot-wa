import { $ } from "bun";
import { readdir } from "fs/promises";
import { join } from "path";

async function generateDrizzleConfigs() {
  try {
    // Read the drizzle directory
    const drizzleDir = join(process.cwd(), "drizzle");
    const files = await readdir(drizzleDir);
    
    // Filter for .kit.ts files
    const kitFiles = files.filter(file => file.includes(".kit.ts"));
    
    if (kitFiles.length === 0) {
      console.log("❌ No .kit.ts files found in drizzle directory");
      process.exit(1);
    }
    
    console.log(`📁 Found ${kitFiles.length} .kit.ts files:`, kitFiles);
    
    // Run drizzle-kit generate for each file
    for (const file of kitFiles) {
      const configPath = join("drizzle", file);
      
      console.log(`\n🔄 Generating for ${file}...`);
      
      try {
        // Use .quiet() to suppress output during execution, then capture result
        const result = await $`drizzle-kit generate --config ${configPath}`.quiet();
        
        // Check if the command was successful
        if (result.exitCode === 0) {
          console.log(`✅ Successfully generated for ${file}`);
          
          // Show the output if there was any
          const output = result.stdout.toString().trim();
          if (output) {
            console.log(`   Output: ${output}`);
          }
        } else {
          console.error(`❌ Failed to generate for ${file}`);
          const errorOutput = result.stderr.toString().trim();
          if (errorOutput) {
            console.error(`   Error: ${errorOutput}`);
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error generating for ${file}:`, errorMessage);
        
        // Continue with other files instead of stopping completely
        continue;
      }
    }
    
    console.log("\n🎉 Drizzle generation process completed!");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Fatal error:", errorMessage);
    process.exit(1);
  }
}

// Set working directory context for all shell commands
$.cwd(process.cwd());

generateDrizzleConfigs();

