// OpenAPI 3.0 specification for the Chirpy HTTP server.
// Served as interactive Swagger UI at GET /docs (see index.ts).
// Use the green "Authorize" button to paste a JWT (from POST /api/login)
// and test the protected endpoints with "Try it out".

const userProps = {
  id: { type: "string", format: "uuid" },
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
  email: { type: "string", format: "email" },
  isChirpyRed: { type: "boolean" },
} as const;

const chirpProps = {
  id: { type: "string", format: "uuid" },
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
  body: { type: "string", maxLength: 140 },
  userId: { type: "string", format: "uuid" },
} as const;

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Chirpy API",
    version: "1.0.0",
    description:
      "HTTP server API. Click **Authorize** to set a Bearer token (JWT from " +
      "`POST /api/login`) or the Polka API key, then use **Try it out** on any endpoint.",
  },
  servers: [{ url: "http://localhost:8080", description: "Local dev server" }],
  tags: [
    { name: "Health", description: "Readiness and metrics" },
    { name: "Users", description: "User accounts" },
    { name: "Auth", description: "Login, refresh and revoke tokens" },
    { name: "Chirps", description: "Chirp posts" },
    { name: "Admin", description: "Dev-only admin endpoints" },
    { name: "Webhooks", description: "Third-party webhooks" },
  ],
  components: {
    securitySchemes: {
      // Used for endpoints that take a JWT access token.
      // POST /api/refresh and /api/revoke also use this scheme, but expect
      // the refresh token (from POST /api/login) as the bearer value.
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token from POST /api/login.",
      },
      // The webhook endpoint expects: Authorization: ApiKey <key>
      // Swagger sends the raw header value, so type the FULL value including
      // the "ApiKey " prefix, e.g.  ApiKey f271c81ff7084ee5b99a5091b42d486e
      polkaApiKey: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: 'Polka API key. Enter the full value, e.g. "ApiKey <your-key>".',
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: userProps,
        required: ["id", "createdAt", "updatedAt", "email", "isChirpyRed"],
      },
      Chirp: {
        type: "object",
        properties: chirpProps,
        required: ["id", "createdAt", "updatedAt", "body", "userId"],
      },
      LoginResponse: {
        type: "object",
        properties: {
          ...userProps,
          token: { type: "string", description: "JWT access token (~1h)" },
          refreshToken: { type: "string", description: "Refresh token (~60 days)" },
        },
      },
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  paths: {
    "/api/healthz": {
      get: {
        tags: ["Health"],
        summary: "Readiness check",
        responses: {
          200: {
            description: "Server is ready",
            content: { "text/plain": { schema: { type: "string", example: "OK" } } },
          },
        },
      },
    },
    "/admin/metrics": {
      get: {
        tags: ["Admin"],
        summary: "Fileserver hit count (HTML)",
        responses: { 200: { description: "HTML metrics page" } },
      },
    },
    "/admin/reset": {
      post: {
        tags: ["Admin"],
        summary: "Reset metrics and delete all users (dev only)",
        responses: {
          204: { description: "Reset complete" },
          403: {
            description: "Not in dev mode",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "List all users",
        responses: {
          200: {
            description: "Array of users",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/User" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create a user",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Credentials" } },
          },
        },
        responses: {
          201: {
            description: "User created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
          },
          400: {
            description: "Validation error / email already exists",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update the authenticated user's email and password",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Credentials" } },
          },
        },
        responses: {
          200: {
            description: "Updated user",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
          },
          401: { description: "Missing or invalid token" },
          404: { description: "User not found" },
        },
      },
    },
    "/api/chirps": {
      get: {
        tags: ["Chirps"],
        summary: "List chirps",
        parameters: [
          {
            name: "authorId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Filter chirps by author",
          },
          {
            name: "sort",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["asc", "desc"], default: "asc" },
            description: "Sort by created_at",
          },
        ],
        responses: {
          200: {
            description: "Array of chirps",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Chirp" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Chirps"],
        summary: "Create a chirp",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["body"],
                properties: { body: { type: "string", maxLength: 140 } },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Chirp created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Chirp" } } },
          },
          400: { description: "Body missing or too long (max 140)" },
          401: { description: "Missing or invalid token" },
        },
      },
    },
    "/api/chirps/{id}": {
      get: {
        tags: ["Chirps"],
        summary: "Get a chirp by id",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "The chirp",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Chirp" } } },
          },
          404: { description: "Chirp not found" },
        },
      },
    },
    "/api/chirps/{chirpId}": {
      delete: {
        tags: ["Chirps"],
        summary: "Delete a chirp (must be the author)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "chirpId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "Not the author" },
          404: { description: "Chirp not found" },
        },
      },
    },
    "/api/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and receive access + refresh tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/Credentials" },
                  {
                    type: "object",
                    properties: {
                      expiresInSeconds: {
                        type: "integer",
                        description: "Optional access-token lifetime, capped at 3600s",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authenticated user with tokens",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } },
            },
          },
          401: { description: "Incorrect email or password" },
        },
      },
    },
    "/api/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new access token",
        description: "Send the **refresh token** as the Bearer value.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "New access token",
            content: {
              "application/json": {
                schema: { type: "object", properties: { token: { type: "string" } } },
              },
            },
          },
          401: { description: "Invalid, expired or revoked refresh token" },
        },
      },
    },
    "/api/revoke": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        description: "Send the **refresh token** as the Bearer value.",
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: "Revoked" },
          404: { description: "Refresh token not found" },
        },
      },
    },
    "/api/polka/webhooks": {
      post: {
        tags: ["Webhooks"],
        summary: "Polka payment webhook (upgrades a user to Chirpy Red)",
        security: [{ polkaApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event: { type: "string", example: "user.upgraded" },
                  data: {
                    type: "object",
                    properties: { userId: { type: "string", format: "uuid" } },
                  },
                },
              },
            },
          },
        },
        responses: {
          204: { description: "Acknowledged (also for ignored events)" },
          400: { description: "Missing user id" },
          401: { description: "Invalid API key" },
          404: { description: "User not found" },
        },
      },
    },
  },
} as const;
