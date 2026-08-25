CREATE TABLE IF NOT EXISTS achievement (
  achievementid SERIAL PRIMARY KEY,
  userid        INT          NOT NULL REFERENCES "USER"(userid) ON DELETE CASCADE,
  awardedby     INT          NOT NULL REFERENCES "USER"(userid),
  title         VARCHAR(200) NOT NULL,
  description   VARCHAR(500),
  badge         VARCHAR(50)  NOT NULL DEFAULT 'star',
  createdat     TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_achievement_userid ON achievement(userid);
CREATE INDEX IF NOT EXISTS idx_achievement_createdat ON achievement(createdat DESC);
