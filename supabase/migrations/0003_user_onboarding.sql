-- 0003_user_onboarding.sql — adds onboarding fields to users.
-- Both columns are nullable: existing rows are treated as "not onboarded".
-- The username unique index is partial so multiple nulls don't collide.

alter table users
  add column if not exists username     text,
  add column if not exists onboarded_at timestamptz;

create unique index if not exists users_username_unique_idx
  on users (lower(username))
  where username is not null;
