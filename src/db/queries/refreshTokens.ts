import {db} from "../index.js";
import { refreshTokens } from "../schema.js";
import {eq} from "drizzle-orm";

export async function getUserFromRefreshtoken(refreshToken: string){
    return await db.select().from(refreshTokens).where(eq(refreshTokens.token, refreshToken));
}

export async function insetRefreshToken(refreshToken: string, userId: string, expiresAt: Date){
    await db.insert(refreshTokens).values({token: refreshToken, userId: userId, expiresAt});
}

export async function revokeToken(refreshToken: string){
    return await db.update(refreshTokens).set({revokedAt: new Date()}).where(eq(refreshTokens.token, refreshToken)).returning();
}