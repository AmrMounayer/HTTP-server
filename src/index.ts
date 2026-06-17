import express, {Request, Response, NextFunction} from "express";
import {config} from "./config.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, deleteAllUsers, getUsers, getUserByEmail, updateUserCredentials, upgradeUserToChirpyRed} from "./db/queries/users.js";
import {getUserFromRefreshtoken, insetRefreshToken, revokeToken} from "./db/queries/refreshTokens.js"
import { hashPassword, checkPasswordHash, makeJWT, validateJWT, getBearerToken, makeRefreshToken, getAPIKey} from "./auth.js";
import { createChirp, getChirps , getChirpById, deleteChirpById, getChirpsForId} from "./db/queries/chirps.js"

const ONE_HOUR = 3600;
const TWO_MONTHS = 5184000000;

const migrationClient = postgres(config.db.url, {max: 1});
await migrate(drizzle(migrationClient), config.db.migrationConfig);
await migrationClient.end();

const app = express();
const PORT = 8080;

class BadRequestError extends Error {
  constructor(message:string){
    super(message);
  }
}

export class UnauthorizedError extends Error {
  constructor(message:string){
    super(message);
  }
}

class ForbiddenError extends Error {
  constructor(message:string){
    super(message);
  }
}

class NotFoundError extends Error {
  constructor(message:string){
    super(message);
  }
}

async function createChirpHandler(req: Request, res: Response, next: NextFunction) {
  try{
  const {body} = req.body ?? {};
  const token = getBearerToken(req);
  const userId = validateJWT(token, config.secret);

  if (!body) throw new BadRequestError("Chirp body is required");
  if (body.length > 140) throw new BadRequestError("Chirp is too long. Max length is 140");

  const badWords: string[] = ["kerfuffle", "sharbert", "fornax"];
  const cleanedBody = body
    .split(" ")
    .map((word: string) => (badWords.includes(word.toLowerCase())) ? "****" : word)
    .join(" ");

  const chirp = await createChirp({body: cleanedBody, userId});

  res.status(201).json(chirp);
}catch(err){
  next(err);
}}
function handlerReadiness(req: Request, res: Response): void { 
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("OK");
}
const middlewareLogResponse = (req: Request, res: Response, next: NextFunction): void => {
    res.on("finish", () => {if (res.statusCode !== 200) console.log(`[NON-OK] <${req.method}> <${req.url}> - Status: ${res.statusCode}`);});
    next();
}
const middlewareMetricsInc = (req: Request, res: Response, next: NextFunction): void => { config.fileserverHits++; next(); }
const middlewareErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof BadRequestError) {
    res.status(400).json({error: err.message});
  } else if (err instanceof UnauthorizedError) {
    res.status(401).json({error: err.message});
  } else if (err instanceof ForbiddenError) {
    res.status(403).json({error: err.message});
  } else if (err instanceof NotFoundError) {
    res.status(404).json({error: err.message});
  } else {
    console.log(err);
    res.status(500).json({error: "Internal Server Error"});
  }
}
const createUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {email, password} = req.body ?? {};
    if (!email) throw new BadRequestError("Email is required");
    if (!password) throw new BadRequestError("Password is required");
    const hashedPassword = await hashPassword(password);
    const user = await createUser({email, hashedPassword});
    if (!user){
      throw new BadRequestError("User with this email already exists");
    }
    res.status(201).json(user);
  }catch(err){
    next(err);
  }
};
  const adminResetHandler = async (req: Request, res: Response, next: NextFunction) => {
  try{
    if (config.platform !== "dev"){
      throw new ForbiddenError("This endpoint is only available in development mode");
    }
    config.fileserverHits = 0;
    await deleteAllUsers();
    res.sendStatus(204);
  }catch(err){
    next(err);
  }
};
async function getUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void>{
  try{
    const allUsers = await getUsers();
    res.status(200).json(allUsers);
  }catch(err){
    next(err);
  }
}
async function getChirpsHandler(req: Request, res: Response, next: NextFunction): Promise<void>{
  try{
    let authorId = "";
    let authorIdQuery = req.query.authorId;
    if (typeof authorIdQuery === "string") {
      authorId = authorIdQuery;
    }
    const sort = req.query.sort as string;
    if (authorId) {
      const result = await getChirpsForId(authorId, sort);
      res.status(200).json(result);
    }else{
      const allChirps = await getChirps(sort);
      res.status(200).json(allChirps);
    }
  }catch(err){
    next(err);
  }
}
async function getChirpByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void>{
  try{
    const id = req.params.id as string;
    const chirp = await getChirpById(id);
    if (!chirp) throw new NotFoundError("Chirp not found");
    res.status(200).json(chirp);
  }catch(err){
    next(err);
  }
}
async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void>{
  try{
    const {email, password} = req.body ?? {};
    if (!email) throw new BadRequestError("Email is required");
    if (!password) throw new BadRequestError("Password is required");
    const user = await getUserByEmail(email);
    if (!user) throw new UnauthorizedError("incorrect email or password");
    const expiration = Math.min(req.body.expiresInSeconds ?? ONE_HOUR, ONE_HOUR);
    if (await checkPasswordHash(password, user.hashedPassword)){
      const {hashedPassword, ...userWithoutPassword} = user;
      const refreshToken = makeRefreshToken();
      await insetRefreshToken(refreshToken, user.id, new Date(Date.now() + TWO_MONTHS));
      const token = makeJWT(userWithoutPassword.id, expiration, config.secret);
      res.status(200).json({...userWithoutPassword, token, refreshToken});
    }else{
      throw new UnauthorizedError("incorrect email or password");
    }
  }catch(err){
    next(err);
  }
}
async function refreshTokenHandler(req: Request, res: Response, next: NextFunction): Promise<void>{
  try {
    const refreshToken = getBearerToken(req);
    const [tokenRow] = await getUserFromRefreshtoken(refreshToken);
    if (!tokenRow) throw new UnauthorizedError("Invalid refresh token");
    if (tokenRow.expiresAt! < new Date()) throw new UnauthorizedError("Refresh token has expired");
    if (tokenRow.revokedAt !== null) throw new UnauthorizedError("Refresh token has been revoked");
    const newAccessToken = makeJWT(tokenRow.userId, ONE_HOUR, config.secret);
    res.status(200).json({token: newAccessToken});
  }catch(err){
    next(err)
  }
}
async function revokeRefreshToken(req: Request, res: Response, next: NextFunction): Promise<void>{
  try{
      const refreshToken = getBearerToken(req);
      const [result] = await revokeToken(refreshToken);
      if (!result) throw new NotFoundError("Refresh token not found");
      res.sendStatus(204);
    }catch(err){
      next(err);
    }
}
async function updateCredentials(req: Request, res: Response, next: NextFunction): Promise<void>{
  try{
    const token = getBearerToken(req);
    const validatedUserId = validateJWT(token, config.secret);
    const {email, password} = req.body ?? {};
    if (!email || !password) throw new BadRequestError("Email and password are required");
    const hashedPassword = await hashPassword(password);
    const userData = await updateUserCredentials(email, hashedPassword, validatedUserId);
    if (!userData) throw new NotFoundError("User not found");
    res.status(200).json(userData);
  }catch(err){
    next(err);
  }
}
async function deleteChirp(req: Request, res: Response, next: NextFunction): Promise<void>{
try{
  const token = getBearerToken(req);
  const validatedUserId = validateJWT(token, config.secret);
  const chirpId = req.params.chirpId as string;

  const [result] = await getChirpById(chirpId);
  if (!result) throw new NotFoundError("Chirp not found");
  if (result.userId !== validatedUserId) throw new ForbiddenError("Unauthorized access");
  await deleteChirpById(chirpId);
  res.sendStatus(204);
}catch(err){
  next(err); 
}
}
async function subscribeHandler(req: Request, res:Response, next: NextFunction): Promise<void>{
  try{
    const APIKey = getAPIKey(req);
    if (APIKey !== config.polkaKey) throw new UnauthorizedError("Invalid API key");
    const {event, data} = req.body ?? {};
    if (event !== "user.upgraded") {
      res.sendStatus(204);
      return;
    }
    if (!data?.userId) throw new BadRequestError("User ID is required");
    const result = await upgradeUserToChirpyRed(data.userId);
    if (!result) throw new NotFoundError("User not found");
    res.sendStatus(204);
  }catch(err){
    next(err);
  }
}

app.use(middlewareLogResponse);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));
app.use(express.json());

app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", (req: Request, res: Response): void => { res.set("Content-Type", "text/html; charset=utf-8");res.send(`<html>  <body>    <h1>Welcome, Chirpy Admin</h1>    <p>Chirpy has been visited ${config.fileserverHits} times!</p>  </body></html>`);});
app.post("/admin/reset", adminResetHandler);

app.get("/api/users", getUsersHandler);
app.post("/api/users", createUserHandler);
app.put("/api/users", updateCredentials);

app.get("/api/chirps", getChirpsHandler)
app.get("/api/chirps/:id", getChirpByIdHandler);
app.post("/api/chirps", createChirpHandler);
app.delete("/api/chirps/:chirpId", deleteChirp);

app.post("/api/login", loginHandler);
app.post("/api/refresh", refreshTokenHandler);
app.post("/api/revoke", revokeRefreshToken);

app.post("/api/polka/webhooks", subscribeHandler);

app.use(middlewareErrorHandler);

app.listen(PORT, () => {console.log(`Server is running at http://localhost:${PORT}`);});