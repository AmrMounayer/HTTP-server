import {describe, it, expect, beforeAll} from "vitest";
import {hashPassword, checkPasswordHash, makeJWT, validateJWT, getBearerToken} from "./auth.js"
import { mock } from "node:test";
import { UniqueConstraintBuilder } from "drizzle-orm/gel-core";

describe("Password Hashing", () => {
    const password1 = "correctPassword123!";
    const password2 = "anotherPassword456!";
    let hash1: string;
    let hash2: string;

    beforeAll(async () => {
        hash1 = await hashPassword(password1);
        hash2 = await hashPassword(password2);
    });

    it("should return true for the correct password", async () => {
        const result = await checkPasswordHash(password1, hash1);
        expect(result).toBe(true);
    });
});

describe("JWT Creation and Validation", () => {
    const userID = "user123";
    const expiresIn = 60;
    const secret = "supersecret";
    let token: string;
    let token2: string;

    beforeAll(() => {
        token = makeJWT(userID, expiresIn, secret);
        token2 = makeJWT(userID, -1, secret);
    });

    it("should validate a valid token and return the user ID", () => {
        const result = validateJWT(token, secret);
        expect(result).toBe(userID);
    });

    it("should reject an expired token", () => {
        expect(() => validateJWT(token2, secret)).toThrow();
    });

    it("should reject a token with an invalid secret", () => {
        expect(() => validateJWT(token, "wrongsecret")).toThrow();
    });
});

describe("Bearer Token Extraction", () => {
    let mockReq = {};
    let mockReq2 = {};

    beforeAll(() => {
        mockReq = {get: (header: string) => "Bearer mytoken123"};
        mockReq2 = {get: (header: string) => undefined};
    });

    it("returns the token when Authorization header is present", () => {
        const token = getBearerToken(mockReq as any);
        expect(token).toBe("mytoken123");
    });

    it("Throws an error when the token is undefined", () => {
        expect(() => getBearerToken(mockReq2 as any)).toThrow("Missing Authorization Header");
    });
});