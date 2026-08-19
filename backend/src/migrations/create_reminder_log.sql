CREATE TABLE IF NOT EXISTS TASK_REMINDER_LOG (
  id           SERIAL PRIMARY KEY,
  taskid       INT NOT NULL REFERENCES TASK(taskid) ON DELETE CASCADE,
  userid       INT NOT NULL REFERENCES "USER"(userid) ON DELETE CASCADE,
  remindertype VARCHAR(30) NOT NULL, -- 'due_24h', 'due_2h', 'alloc_24h', 'alloc_2h'
  sentat       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(taskid, userid, remindertype)
);
