import { pgTable, text, timestamp, boolean, jsonb, serial, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// ---- Auth tables (Auth.js / Drizzle adapter) ----

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  githubId: text('github_id').unique(),
  githubUsername: text('github_username'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text('session_token').unique().notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => [
  uniqueIndex('verification_tokens_identifier_token_idx').on(table.identifier, table.token),
]);

// ---- Application tables ----

export const plugins = pgTable('plugins', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').default(''),
  category: text('category').default('general'),
  isPublic: boolean('is_public').default(false).notNull(),
  githubRepoUrl: text('github_repo_url'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('plugins_user_slug_idx').on(table.userId, table.slug),
]);

export const pluginVersions = pgTable('plugin_versions', {
  id: serial('id').primaryKey(),
  pluginId: integer('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  version: text('version').notNull().default('1.0.0'),
  graphState: jsonb('graph_state').notNull(), // React Flow toObject() output
  publishedAt: timestamp('published_at', { mode: 'date' }).defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  graphState: jsonb('graph_state').notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
