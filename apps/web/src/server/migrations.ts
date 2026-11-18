/** Database migrations, applied in order. Never edit a migration once released; add a new one. */
export const MIGRATIONS: readonly { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        kdf_salt text NOT NULL,
        kdf_iterations integer NOT NULL CHECK (kdf_iterations >= 100000),
        auth_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE sessions (
        token_hash text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX sessions_user_idx ON sessions (user_id);
      CREATE INDEX sessions_expires_idx ON sessions (expires_at);
      CREATE TABLE vaults (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        iv text NOT NULL,
        ciphertext text NOT NULL,
        revision integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE shares (
        id text PRIMARY KEY,
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        iv text NOT NULL,
        ciphertext text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];
