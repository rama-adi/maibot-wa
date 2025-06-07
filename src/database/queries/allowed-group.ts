import { eq } from "drizzle-orm";
import { configDatabase } from "../drizzle";
import { allowedGroups } from "../schemas/config-schema";

export function listAllowedGroup(): string[] {
    const ids = configDatabase
        .select({
            id: allowedGroups.id
        })
        .from(allowedGroups)
        .all();

    return ids.map(group => group.id);
}

export function findAllowedGroup(groupId: string): boolean {
    if (!groupId) {
        return false;
    }

    const allowed = configDatabase
    .select()
    .from(allowedGroups)
    .where(eq(allowedGroups.id, groupId))
    .get();

    // If no record found, return false
    if (!allowed) {
        return false;
    }

    return allowed.id === groupId;
}