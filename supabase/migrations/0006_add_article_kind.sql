-- GameLog — add the 'article' post kind
--
-- RUN THIS ON ITS OWN, BEFORE 0007.
--
-- Why it is a separate file: Postgres refuses to let a new enum value be *used*
-- in the same transaction that adds it —
--
--   ERROR: unsafe use of new value "article" of enum type post_kind
--   HINT:  New enum values must be committed before they can be used.
--
-- 0007 adds CHECK constraints that compare `kind` against 'article', and a
-- CHECK is evaluated the moment it is created. So the value has to be committed
-- first, which means a separate transaction — hence a separate script.
--
-- (Migration 0005 added notification_kind values in the same file as their use
-- and worked, because those values only appear inside plpgsql function bodies,
-- which are stored as text and not evaluated at CREATE FUNCTION time. That
-- exemption does not extend to CHECK constraints.)

alter type public.post_kind add value if not exists 'article';
