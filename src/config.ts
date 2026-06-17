import {MigrationConfig} from "drizzle-orm/migrator";
import dotenv from "dotenv";
dotenv.config();

type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
}

type APIConfig = {
  fileserverHits: number;
  db: DBConfig;
  platform:string;
  secret: string;
  polkaKey: string;
};

export function envOrThrow(key: string): string{
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const config: APIConfig = {
  fileserverHits: 0,
  db: {
    url: envOrThrow("DB_URL"),
    migrationConfig: {
      migrationsFolder: "./src/db/migrations",
    },
  },
  platform: envOrThrow("PLATFORM"),
  secret: envOrThrow("SECRET"),
  polkaKey: envOrThrow("POLKA_KEY")
};