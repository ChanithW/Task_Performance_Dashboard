-- Personal To-do list for employees
CREATE TABLE IF NOT EXISTS personal_todo (
  todoid    SERIAL      PRIMARY KEY,
  userid    INT         NOT NULL REFERENCES "USER"(userid) ON DELETE CASCADE,
  title     VARCHAR(300) NOT NULL,
  done      BOOLEAN     NOT NULL DEFAULT FALSE,
  createdat TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_todo_userid ON personal_todo(userid);
