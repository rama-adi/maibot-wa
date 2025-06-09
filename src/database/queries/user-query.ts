import { asc } from "drizzle-orm";
import { userDatabase } from "../drizzle";
import { users } from "@/database/schemas/user-schema";
import { eq } from "drizzle-orm";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { nanoid } from "nanoid";

export async function listAllUsers() {
    return await userDatabase
        .select()
        .from(users)
        .orderBy(asc(users.id));
} 

export async function findUserByPhone(payload: WhatsAppGatewayPayload) {
    if (payload.number === "INTERNAL_ADMIN") {
        // Return placeholder admin user
        return {
            id: -1,
            phoneNumberHash: "INTERNAL_ADMIN", 
            publicId: "admin",
            name: "System Admin",
            isBanned: false,
            bio: "System Administrator"
        };
    }

    const hasher = new Bun.CryptoHasher("blake2b256");
    const numberHash = hasher.update(payload.number).digest('hex');

    let user = await userDatabase
        .select()
        .from(users)
        .where(eq(users.phoneNumberHash, numberHash))
        .get();

    if (!user) {
        // Create new user if not found
        const newUser = {
            phoneNumberHash: numberHash,
            publicId: `user_${nanoid(10)}`,
            name: payload.name || "New User",
            isBanned: false,
            bio: ""
        };

        user = await userDatabase
            .insert(users)
            .values(newUser)
            .returning()
            .get();
    }

    return user;
}