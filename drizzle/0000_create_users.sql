-- drizzle/0000_create_users.sql
CREATE TABLE IF NOT EXISTS users
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);