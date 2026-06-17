import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type {JwtPayload} from "jsonwebtoken";
import {Request, Response} from 'express';
import crypto from "crypto";
import {UnauthorizedError} from "./index.js";

type Payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(userID: string, expiresIn: number, secret: string): string {
    return jwt.sign({sub: userID},
        secret,
        {expiresIn, issuer: "chirpy"}
    );
}

export function validateJWT(tokenString: string, secret: string): string{
    try{
        const decodedPayload = jwt.verify(tokenString, secret) as Payload;
        if (!decodedPayload.sub) throw new Error("Invalid token: missing subject");
        return decodedPayload.sub;
    }catch(err){
        throw new UnauthorizedError(`Invalid token: ${err}`);
    }
}

export async function hashPassword(password: string): Promise<string> {
    try{
        const hash = await argon2.hash(password);
        return hash;
    }catch(err){
        throw new Error(`Failed to hash password: ${err}`);
    }
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
    try{
        return await argon2.verify(hash, password)
    }catch(err){
        throw new Error(`Failed to verify password: ${err}`);
    }
}

export function getBearerToken(req: Request): string {
    const tokenString = req.get("authorization");
    if (!tokenString) throw new UnauthorizedError("Missing authorization header");
    if (!tokenString.startsWith("Bearer ")) throw new UnauthorizedError("Invalid Authorization format");
    return tokenString.slice("Bearer ".length).trim();
}

export function getAPIKey(req: Request): string{
    const authHeader = req.get("authorization");
    if (!authHeader) throw new UnauthorizedError("Missing authorization header");
    if (!authHeader.startsWith("ApiKey ")) throw new UnauthorizedError("Invalid Authorization format");
    return authHeader.slice("ApiKey ".length).trim();
}

export function makeRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
}