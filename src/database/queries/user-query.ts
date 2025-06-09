import { asc } from "drizzle-orm";
import { userDatabase } from "../drizzle";
import { users } from "@/database/schemas/user-schema";
import { eq } from "drizzle-orm";
import type { WhatsAppGatewayPayload } from "@/types/whatsapp-gateway";
import { nanoid } from "nanoid";


function hashPhoneNumber(number: string) {
    const hasher = new Bun.CryptoHasher("blake2b256");
    return hasher.update(number).digest('hex');
}

export async function listAllUsers() {
    return await userDatabase
        .select()
        .from(users)
        .orderBy(asc(users.id));
} 

export async function setUserDetail(
    phoneNumberHash: string,
    data: Partial<Omit<typeof users.$inferInsert, "id" | "phoneNumberHash" | "publicId" | "isBanned">>
) {
    return await userDatabase
        .update(users)
        .set(data)
        .where(eq(users.phoneNumberHash, phoneNumberHash))
        .returning()
        .get();
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

    let user = await userDatabase
        .select()
        .from(users)
        .where(eq(users.phoneNumberHash, hashPhoneNumber(payload.number)))
        .get();

    if (!user) {
        // Create new user if not found
        const newUser = {
            phoneNumberHash: hashPhoneNumber(payload.number),
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