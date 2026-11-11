# Courier backend learning log

This document records concepts, schema decisions, commands, and exercises as we work through the backend. The application and Prisma Client examples use JavaScript (ES modules).

## Stack and current state

- Node.js, Express, PostgreSQL, Prisma ORM, and Docker Compose.
- Prisma 7 is installed. `prisma7.config.ts` is Prisma's configuration file; application code remains JavaScript.
- Docker and Compose are installed, but the Docker daemon is unavailable in the current environment. The schema can be validated, but migrations need a running database.
- The schema currently defines `User`, `CourierAgency`, and `AgencyUser`.

## Database concepts

### Tables and rows

PostgreSQL stores data in tables. A `User` table has one row per login identity; a `CourierAgency` table has one row per courier organization. Each column describes one value.

### Primary key

A primary key identifies one row uniquely. Each model uses a UUID primary key. This lets records be identified without coordinating sequential counters. PostgreSQL stores UUIDs using its native `uuid` type.

### Foreign key

A foreign key points from a column in one table to a primary key in another. PostgreSQL rejects references to rows that do not exist. `AgencyUser.userId` points to `User.id`; `AgencyUser.agencyId` points to `CourierAgency.id`.

### One-to-many

One row can be associated with many rows on the other side. One agency has many membership rows, for example. The foreign key lives on the “many” side, here `AgencyUser.agencyId`.

### Many-to-many and junction table

A user can work with several agencies, and an agency can have several users. That is a many-to-many relationship. A relational database represents it with a junction table, `AgencyUser`, which has one row per user-agency membership. It also stores a role, because the role belongs to that user's relationship with that agency.

## Model 1: User

`User` represents a login identity. A platform administrator can exist without agency membership: the platform-wide role is kept separate from an agency-specific role.

| Field | Purpose |
| --- | --- |
| `id` | UUID primary key. |
| `email` | Login/contact address, unique across accounts. |
| `name` | Optional display name; `?` maps to a nullable column. |
| `passwordHash` | Password hash, never plaintext. Password hashing and verification belong in authentication code. |
| `platformRole` | Platform-wide role, defaults to `CUSTOMER`; `PLATFORM_ADMIN` is not an agency role. |
| `createdAt`, `updatedAt` | Creation and last update timestamps. |
| `agencyMemberships` | Prisma relation field for membership rows; it is not a database column. |

## Model 2: CourierAgency

One row represents an organization such as India Post, DTDC, or Blue Dart.

| Field | Purpose |
| --- | --- |
| `id` | UUID primary key. |
| `name` | Human-readable organization name. |
| `slug` | Unique URL-friendly identifier such as `blue-dart`. |
| `createdAt`, `updatedAt` | Creation and last update timestamps. |
| `userMemberships` | Prisma relation field listing membership rows; not a PostgreSQL column. |

The relationship from `CourierAgency` to `AgencyUser` is one-to-many: the agency can have many membership rows. A list of users is not stored in an array column; relational links are represented through foreign keys.

## Model 3: AgencyUser junction table

Each `AgencyUser` row means “this user belongs to this agency.” It is the bridge that represents many-to-many membership and stores the membership's role.

| Field | Purpose |
| --- | --- |
| `id` | UUID primary key for the membership itself. |
| `userId` | Foreign key to `User.id`. |
| `agencyId` | Foreign key to `CourierAgency.id`. |
| `role` | `AGENCY_ADMIN`, `DISPATCHER`, or `WORKER` within this specific agency. Defaults to `WORKER`. |
| `createdAt`, `updatedAt` | Membership creation and last update timestamps. |
| `user`, `agency` | Prisma relation fields to navigate to the parent records; not extra columns. |

`@@unique([userId, agencyId])` is a composite unique constraint. It prevents duplicate membership rows for the same user and agency while allowing either to appear in other pairs. The UUID `id` remains the primary key. `@@index([agencyId, role])` helps queries listing an agency's users by role.

Both relations use `onDelete: Cascade`: deleting a parent user or agency deletes its membership rows. Deleting an agency does not delete the user.

## Prisma syntax and PostgreSQL mapping

- `model Name { ... }` describes a Prisma model, mapped by default to a PostgreSQL table of that name.
- `String`, `DateTime`, and enum types define field types. `String?` means nullable.
- `@id` marks a primary key; `@default(uuid())` generates an ID; `@db.Uuid` selects PostgreSQL's UUID type.
- `@unique` creates a unique constraint; `@@unique([...])` creates a composite one; `@@index([...])` creates an index.
- `@default(now())` sets creation time; `@updatedAt` refreshes the timestamp when Prisma updates a record.
- `@relation(fields: [...], references: [...])` connects relation fields to the actual foreign key columns and referenced primary keys.
- `generator client` selects the generated Prisma Client and output path.
- `datasource db` identifies PostgreSQL. This Prisma 7 project gets its connection URL from `prisma7.config.ts`, not from the schema file.

Prisma Migrate will create three tables, the `PlatformRole` and `AgencyRole` enum types, UUID columns, unique constraints, an index, and the two foreign keys. Relation fields such as `agencyMemberships` help Prisma Client traverse the links; the stored link values are the UUID columns in `AgencyUser`.

## Tenant isolation

These tables establish who belongs to which agency. Future agency-owned rows (for example consignments and delivery slots) should include an `agencyId` foreign key. Application queries and authorization must scope access to the signed-in user's agency membership. The membership tables alone do not enforce every tenant boundary. PostgreSQL row-level security is an advanced option to discuss when there are concrete tenant-owned tables.

## Docker and database connection

`docker-compose.yml` defines PostgreSQL 17, a persistent named volume, local port `5432`, and a health check. The volume keeps database files across container recreation.

1. Start Docker Desktop / the Docker daemon.
2. From `courier-backend/`, run `docker compose up -d`.
3. Check `docker compose ps` and wait for `healthy`.
4. Set local ignored `.env` `DATABASE_URL` to `postgresql://postgres:postgres@localhost:5432/courier_platform?schema=public`, matching the Compose credentials.
5. Once migrations exist, `npx prisma migrate status` checks migration state. `prisma db pull` is only for introspecting an existing database; it does not create the schema.

The local URL's database name is `courier_platform`. Docker was unavailable in the latest check, so the container and connection are not yet verified. Confirm the local URL's password matches Compose before connecting. Do not commit `.env`.

## Migration workflow

With Docker running and `DATABASE_URL` configured, run from `courier-backend/`:

```sh
npx prisma format
npx prisma migrate dev --name add_agencies_and_memberships
npx prisma generate
```

`migrate dev` compares schema and migration history, writes SQL under `prisma/migrations`, applies it to the development database, and updates Prisma's migration tracking table. `generate` creates the JavaScript client under `src/generated/prisma`. Commit migration files so the database change is reproducible.

## Prisma Client relationship example (after migration)

The project uses Prisma's PostgreSQL adapter; its JavaScript connection setup can be added when we exercise the database. This example creates an agency, then creates a user with a membership, and queries the joined rows:

```js
const agency = await prisma.courierAgency.create({
  data: { name: "Blue Dart", slug: "blue-dart" },
});

const createdUser = await prisma.user.create({
  data: {
    email: "worker@example.com",
    name: "Ravi Kumar",
    passwordHash: "replace-with-a-real-password-hash",
    agencyMemberships: {
      create: { agencyId: agency.id, role: "DISPATCHER" },
    },
  },
  include: { agencyMemberships: { include: { agency: true } } },
});

const memberships = await prisma.agencyUser.findMany({
  where: { agencyId: agency.id },
  include: { user: true, agency: true },
});

console.log(createdUser.agencyMemberships[0].agency.name);
console.log(memberships[0].user.email, memberships[0].role);
```

Nested create uses a relation field and Prisma writes the foreign key. `include` fetches linked rows. A platform administrator can be created without any membership.

## Exercises: first three models

1. Which field identifies a row if two people share a name, and why?
2. What should happen if you create two users with the same email?
3. Should `PLATFORM_ADMIN` be an agency role? Explain the difference between platform-wide permissions and a user's role within one agency.
4. Why does `AgencyUser` need both `userId` and `agencyId` foreign keys?
5. If a worker joins two agencies, how many membership rows are needed? Can the role differ between the two?
6. What does `@@unique([userId, agencyId])` prevent, and what does it still allow?
7. What agency scope should a dispatcher query check before returning consignments, and why is a user UUID alone insufficient?

The first three foundational models are in place. We can move to future models after these relationships make sense.
