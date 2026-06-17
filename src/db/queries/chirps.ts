import { AwsDataApiPgDatabase } from "drizzle-orm/aws-data-api/pg";
import {db} from "../index.js";
import { type NewChirp, chirps} from "../schema.js";
import {asc, desc, eq} from "drizzle-orm";

export async function createChirp(chirp: NewChirp) {
    const [result] = await db.insert(chirps).values(chirp).returning();
    return result;
}

export async function getChirps(sort: string){
    const order = sort === "asc" ? asc(chirps.createdAt) : desc(chirps.createdAt);
    return await db.select().from(chirps).orderBy(order);
}

export async function getChirpById(id: string){
    return await db.select().from(chirps).where(eq(chirps.id, id));
}

export async function deleteChirpById(chirpId: string) {
    await db.delete(chirps).where(eq(chirps.id, chirpId));
}

export async function getChirpsForId(id: string, sort: string) {
    const order = sort === "desc" ? desc(chirps.createdAt) : asc(chirps.createdAt);
    return await db.select().from(chirps).where(eq(chirps.userId, id)).orderBy(order);
}