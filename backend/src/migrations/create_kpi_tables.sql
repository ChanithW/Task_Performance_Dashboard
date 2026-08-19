CREATE TABLE IF NOT EXISTS KPI (
  kpiid        SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  metric       VARCHAR(100),
  unit         VARCHAR(50)  DEFAULT 'count',
  period       VARCHAR(50)  DEFAULT 'monthly',
  createdby    INT NOT NULL REFERENCES "USER"(userid),
  createdat    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS KPI_ASSIGNMENT (
  assignmentid  SERIAL PRIMARY KEY,
  kpiid         INT NOT NULL REFERENCES KPI(kpiid) ON DELETE CASCADE,
  employeeid    INT NOT NULL REFERENCES "USER"(userid),
  supervisorid  INT NOT NULL REFERENCES "USER"(userid),
  targetvalue   NUMERIC(10,2) NOT NULL,
  startdate     DATE,
  enddate       DATE,
  createdat     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS KPI_PROGRESS (
  progressid    SERIAL PRIMARY KEY,
  assignmentid  INT NOT NULL REFERENCES KPI_ASSIGNMENT(assignmentid) ON DELETE CASCADE,
  value         NUMERIC(10,2) NOT NULL,
  notes         TEXT,
  recordedby    INT NOT NULL REFERENCES "USER"(userid),
  recordedat    TIMESTAMPTZ DEFAULT NOW()
);
