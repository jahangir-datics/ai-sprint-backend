# Auth + API Key Management — Feature Specification

## 1. Overview

The Auth + API Key Management feature provides secure authentication and authorization for a Developer Platform API. It allows users to register, authenticate, and manage access through JWT-based authentication and API keys. The system supports dual authentication where requests can be authenticated using either a short-lived JWT access token or an API key. API keys are designed for programmatic access, while JWT tokens support user sessions. The feature also supports refresh tokens for session renewal and allows users to create, manage, and revoke API keys with defined scopes and expiration policies.

---

## 2. User Stories

1. **User Registration**
   As a developer, I want to create an account using email and password so that I can access the platform.

2. **User Login**
   As a user, I want to authenticate using my email and password so that I can receive access and refresh tokens to interact with the API.

3. **Token Refresh**
   As a user, I want to refresh my expired access token using a refresh token so that I can continue using the platform without logging in again.

4. **API Key Creation**
   As a user, I want to generate API keys with specific scopes so that my applications can securely interact with the platform.

5. **API Key Management**
   As a user, I want to list, revoke, and manage my API keys so that I can maintain control over application access.

6. **Dual Authentication Support**
   As a developer using the API, I want to authenticate requests using either JWT tokens or API keys so that I can choose the most suitable authentication method.

---

## 3. API Endpoints

### Endpoint Summary

| Method | Path           | Auth          | Description               |
| ------ | -------------- | ------------- | ------------------------- |
| POST   | /auth/register | None          | Register new user         |
| POST   | /auth/login    | None          | Authenticate user         |
| POST   | /auth/refresh  | Refresh Token | Generate new access token |
| POST   | /auth/logout   | JWT           | Invalidate refresh token  |
| GET    | /auth/me       | JWT           | Get authenticated user    |
| GET    | /api-keys      | JWT           | List user API keys        |
| POST   | /api-keys      | JWT           | Create new API key        |
| DELETE | /api-keys/:id  | JWT           | Revoke API key            |

---

### 3.1 Register User

**POST** `/auth/register`

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "string",
  "name": "optional"
}
```

#### Response

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "message": "User registered successfully",
  "statusCode": 201
}
```

#### Status Codes

* 201 Created
* 400 Validation Error
* 409 Email Already Exists

---

### 3.2 Login

**POST** `/auth/login`

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

#### Response

```json
{
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 900
  },
  "message": "Login successful",
  "statusCode": 200
}
```

#### Status Codes

* 200 OK
* 401 Invalid Credentials
* 403 Account Disabled

---

### 3.3 Refresh Access Token

**POST** `/auth/refresh`

#### Request Body

```json
{
  "refreshToken": "string"
}
```

#### Response

```json
{
  "data": {
    "accessToken": "jwt-token",
    "expiresIn": 900
  },
  "message": "Token refreshed",
  "statusCode": 200
}
```

#### Status Codes

* 200 OK
* 401 Invalid Refresh Token
* 403 Expired Refresh Token

---

### 3.4 Logout

**POST** `/auth/logout`

#### Headers

Authorization: Bearer JWT

#### Request Body

```json
{
  "refreshToken": "string"
}
```

#### Response

```json
{
  "data": null,
  "message": "Logged out successfully",
  "statusCode": 200
}
```

#### Status Codes

* 200 OK
* 401 Unauthorized

---

### 3.5 Get Current User

**GET** `/auth/me`

#### Headers

Authorization: Bearer JWT

#### Response

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "USER"
  },
  "message": "User profile retrieved",
  "statusCode": 200
}
```

#### Status Codes

* 200 OK
* 401 Unauthorized

---

### 3.6 List API Keys

**GET** `/api-keys`

#### Auth

JWT or API Key

#### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Production Key",
      "keyPrefix": "ask_ab12",
      "scopes": ["read", "write"],
      "createdAt": "timestamp",
      "lastUsedAt": "timestamp"
    }
  ],
  "message": "API keys retrieved",
  "statusCode": 200
}
```

#### Status Codes

* 200 OK
* 401 Unauthorized

---

### 3.7 Create API Key

**POST** `/api-keys`

#### Request Body

```json
{
  "name": "My App Key",
  "scopes": ["read", "write"],
  "expiresAt": "optional datetime"
}
```

#### Response

```json
{
  "data": {
    "id": "uuid",
    "key": "ask_abcdef1234567890...",
    "keyPrefix": "ask_ab12",
    "name": "My App Key"
  },
  "message": "API key created",
  "statusCode": 201
}
```

#### Status Codes

* 201 Created
* 400 Validation Error
* 401 Unauthorized

---

### 3.8 Revoke API Key

**DELETE** `/api-keys/:id`

#### Response

```json
{
  "data": null,
  "message": "API key revoked",
  "statusCode": 200
}
```

#### Status Codes

* 200 OK
* 404 Key Not Found
* 401 Unauthorized

---

## 4. Data Model

The following Prisma schema defines the authentication and API key data structures.

### User

* Unique email
* Stores hashed password
* Role-based access control
* Relationship to refresh tokens and API keys

### RefreshToken

* One-to-many relationship with User
* Stores refresh tokens used for session renewal
* Tokens expire after defined duration

### ApiKey

* Stored as SHA-256 hash
* Associated with a user
* Contains scopes for permission control
* Supports expiration, revocation, and usage tracking

Schema confirmed as provided:

* `User`
* `RefreshToken`
* `ApiKey`
* `Role` enum

No modifications required.

---

## 5. Business Rules

1. User passwords must be hashed using bcrypt with 10 rounds before storage.
2. JWT access tokens must expire after 15 minutes.
3. Refresh tokens must expire after 7 days.
4. API keys must follow the format `ask_<32 random hex characters>`.
5. Only the SHA-256 hash of the API key must be stored in the database.
6. API keys must include a visible prefix (`keyPrefix`) for identification.
7. API keys may optionally include scopes limiting API access.
8. Revoked API keys must not be accepted for authentication.
9. Expired API keys must be rejected.
10. Refresh tokens must be invalidated when the user logs out.
11. All API responses must follow the structure `{ data, message, statusCode }`.
12. API endpoints must support dual authentication using JWT Bearer tokens or `X-API-Key` headers.

---

## 6. Security Requirements

1. Passwords must be stored using bcrypt hashing with a salt.
2. JWT tokens must be signed using a secure secret and verified on every request.
3. Refresh tokens must be stored securely in the database and validated on use.
4. API keys must be hashed using SHA-256 before storage.
5. API keys must only be shown once during creation.
6. Authentication middleware must validate either JWT or API key headers.
7. Rate limiting should be applied to login endpoints to prevent brute force attacks.
8. Revoked or expired keys must immediately fail authentication checks.
9. User roles must be enforced for restricted endpoints.
10. Sensitive endpoints must require authentication.

---

## 7. Edge Cases

1. Attempting login with incorrect password.
2. Login attempt for inactive user account.
3. Refresh token expired but still submitted by client.
4. Multiple API keys created with the same name.
5. Revoked API key used in request.
6. Expired API key used in request.
7. API key prefix collision (rare but must be handled).
8. Concurrent refresh token usage attempts.
9. User deletes account but API keys remain referenced.
10. Refresh token reuse after logout.

---

## 8. Acceptance Criteria

1. Users can successfully register with unique email addresses.
2. Registered users can log in and receive JWT access and refresh tokens.
3. Access tokens expire after 15 minutes.
4. Refresh tokens expire after 7 days and can generate new access tokens.
5. Users can create API keys and receive the full key only once.
6. API keys are stored only as SHA-256 hashes.
7. Users can list and revoke their API keys.
8. Requests authenticated with valid JWT or API key succeed.
9. Requests with invalid, revoked, or expired credentials fail.
10. All responses follow the standard response format.

---

## 9. Out of Scope

1. OAuth or social login integrations (Google, GitHub, etc.).
2. Multi-factor authentication (MFA).
3. API key usage analytics dashboards.
4. Rate limiting configuration beyond basic login protection.
5. Enterprise SSO integrations (SAML, OIDC).
6. User account deletion workflows.
