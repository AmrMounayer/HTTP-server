import {db} from "../index.js";
import {NewUser, users, UserResponse,} from "../schema.js";
import {eq} from "drizzle-orm";

export async function createUser(user: NewUser): Promise<UserResponse | undefined>{
    const [result] = await db.insert(users).values(user).onConflictDoNothing().returning({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        isChirpyRed: users.isChirpyRed
    });
    return result;
}

export async function getUsers(){
    return await db.select().from(users);
}
export async function getUserByEmail(email: string){
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
}

export async function deleteAllUsers(){
    await db.delete(users);
}

export async function updateUserCredentials(email: string, hashedPassword: string, userId: string): Promise<UserResponse | undefined>{
    const [result] =  await db.update(users).set({email, hashedPassword}).where(eq(users.id, userId)).returning({id: users.id, email: users.email, createdAt: users.createdAt, updatedAt: users.updatedAt, isChirpyRed: users.isChirpyRed});
    return result;
}

export async function upgradeUserToChirpyRed(userId: string): Promise<UserResponse | undefined>{
    const [result] = await db.update(users).set({isChirpyRed: true}).where(eq(users.id, userId)).returning({id: users.id, email: users.email, createdAt: users.createdAt, updatedAt: users.updatedAt, isChirpyRed: users.isChirpyRed});
    return result;
}