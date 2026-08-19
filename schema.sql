-- ============================================================
-- Task Performance Dashboard — PostgreSQL Schema
-- ============================================================


-- ── Enumerations ─────────────────────────────────────────

CREATE TYPE user_role            AS ENUM ('HOD', 'Supervisor', 'Employee', 'Admin');
CREATE TYPE task_priority        AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE task_category        AS ENUM ('WorkTracking', 'SupportService', 'TrainingProject');
CREATE TYPE publish_mode         AS ENUM ('Direct', 'Floating');
CREATE TYPE task_status          AS ENUM ('Pending', 'InProgress', 'Completed', 'UnableToComplete', 'Overdue');
CREATE TYPE report_status        AS ENUM ('Draft', 'Submitted', 'Approved');
CREATE TYPE activity_category    AS ENUM ('Training', 'Project');
CREATE TYPE activity_mode        AS ENUM ('Physical', 'Online');
CREATE TYPE activity_scope       AS ENUM ('Internal', 'External');
CREATE TYPE acceptance_status    AS ENUM ('Pending', 'Accepted', 'Rejected');
CREATE TYPE notification_channel AS ENUM ('InApp', 'Email', 'SMS');
CREATE TYPE notification_status  AS ENUM ('Scheduled', 'Sent', 'Failed');
CREATE TYPE submission_status    AS ENUM ('Completed', 'InProgress', 'UnableToComplete');
CREATE TYPE unable_reason        AS ENUM ('LackOfAccess', 'WaitingForInfo', 'TechnicalIssue', 'Other');
CREATE TYPE approval_decision    AS ENUM ('Approved', 'Rejected');
CREATE TYPE reminder_type        AS ENUM ('24hr', '2hr', 'Custom');
CREATE TYPE inspection_status    AS ENUM ('Pass', 'Fail', 'Pending');


-- ── USER ─────────────────────────────────────────────────
-- Note: USER is a reserved word in PostgreSQL — quoted throughout

CREATE TABLE "USER" (
    UserID        SERIAL          PRIMARY KEY,
    Name          VARCHAR(150)    NOT NULL,
    Email         VARCHAR(150)    NOT NULL UNIQUE,
    PasswordHash  VARCHAR(255)    NOT NULL,
    Phone         VARCHAR(20),
    Designation   VARCHAR(100),
    Role          user_role       NOT NULL,
    ReportsTo     INT             REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    Division      VARCHAR(100)
);


-- ── TASK ─────────────────────────────────────────────────
-- Single-table design: all category-specific fields included.
-- Fields are nullable; application enforces which are required
-- based on TaskCategory.

CREATE TABLE TASK (
    TaskID      SERIAL          PRIMARY KEY,
    Title       VARCHAR(255)    NOT NULL,
    Description TEXT,
    Priority    task_priority   NOT NULL DEFAULT 'Medium',
    DueDate     DATE,
    DueTime     TIME,
    EstimatedTime   INT,
    TaskCategory    task_category   NOT NULL,
    PublishMode     publish_mode    NOT NULL DEFAULT 'Direct',
    Status          task_status     NOT NULL DEFAULT 'Pending',
    CreatedBy       INT             NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    CreatedAt       TIMESTAMP       NOT NULL DEFAULT NOW(),
    ScheduledAt     TIMESTAMP,

    -- Work Tracking
    SiteName                    VARCHAR(150),
    Division                    VARCHAR(100),
    MonitoringType              VARCHAR(100),
    InspectedBy                 VARCHAR(150),
    SiteIncharge                VARCHAR(150),
    ContactNo                   VARCHAR(20),
    ActualDate                  DATE,
    InspectionHrs               NUMERIC(6,2),
    ReportingHrs                NUMERIC(6,2),
    TravellingHrs               NUMERIC(6,2),
    TotalHrsExpended            NUMERIC(6,2),
    NCRaised                    INT,
    NCClosed                    INT,
    MeetingDateWithSupervisor   DATE,
    ReportStatus                report_status,

    -- Support Service
    Date                        DATE,
    EmployeeName                VARCHAR(150),
    NatureOfService             VARCHAR(255),
    ServiceRequestDivision      VARCHAR(100),
    ServiceRequesterName        VARCHAR(150),
    TotalTimeByEmployee         NUMERIC(6,2),
    ReviewedBy                  VARCHAR(150),
    TotalTimeForReview          NUMERIC(6,2),

    -- Training & Project
    ActivityName                VARCHAR(255),
    ActivityCategory            activity_category,
    Mode                        activity_mode,
    Scope                       activity_scope,
    ConductedBy                 VARCHAR(150),
    DurationHours               NUMERIC(6,2),
    StartDate                   DATE,
    EndDate                     DATE,
    ActualParticipants          INT,
    PlannedParticipants         INT,
    Remarks                     TEXT
);


-- ── TASK_ASSIGNMENT ───────────────────────────────────────

CREATE TABLE TASK_ASSIGNMENT (
    AssignmentID        SERIAL              PRIMARY KEY,
    TaskID              INT                 NOT NULL REFERENCES TASK(TaskID) ON DELETE CASCADE,
    AssignedBy          INT                 NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    AssignedTo          INT                 NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    AssignedAt          TIMESTAMP           NOT NULL DEFAULT NOW(),
    NotifyAt            TIMESTAMP,
    PlannedStartDate    DATE,
    AcceptanceStatus    acceptance_status   NOT NULL DEFAULT 'Pending',
    RejectionReason     TEXT,
    ReplacementRequest  TEXT
);


-- ── TASK_CHAT_PARTICIPANT ─────────────────────────────────

CREATE TABLE TASK_CHAT_PARTICIPANT (
    ParticipantID   SERIAL      PRIMARY KEY,
    TaskID          INT         NOT NULL REFERENCES TASK(TaskID) ON DELETE CASCADE,
    UserID          INT         NOT NULL REFERENCES "USER"(UserID) ON DELETE CASCADE,
    AddedBy         INT         NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    AddedAt         TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (TaskID, UserID)
);


-- ── MESSAGE ───────────────────────────────────────────────

CREATE TABLE MESSAGE (
    MessageID   SERIAL      PRIMARY KEY,
    TaskID      INT         NOT NULL REFERENCES TASK(TaskID) ON DELETE CASCADE,
    SenderID    INT         NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    Content     TEXT        NOT NULL,
    SentAt      TIMESTAMP   NOT NULL DEFAULT NOW()
);


-- ── TASK_SUBMISSION ───────────────────────────────────────

CREATE TABLE TASK_SUBMISSION (
    SubmissionID            SERIAL              PRIMARY KEY,
    TaskID                  INT                 NOT NULL REFERENCES TASK(TaskID) ON DELETE CASCADE,
    SubmittedBy             INT                 NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    Status                  submission_status   NOT NULL,
    UnableReason            unable_reason,
    Remarks                 TEXT,
    ActualCompletionTime    INT,
    SubmittedAt             TIMESTAMP           NOT NULL DEFAULT NOW()
);


-- ── TASK_APPROVAL ─────────────────────────────────────────

CREATE TABLE TASK_APPROVAL (
    ApprovalID      SERIAL              PRIMARY KEY,
    SubmissionID    INT                 NOT NULL REFERENCES TASK_SUBMISSION(SubmissionID) ON DELETE CASCADE,
    SupervisorID    INT                 NOT NULL REFERENCES "USER"(UserID) ON DELETE RESTRICT,
    Decision        approval_decision   NOT NULL,
    Reason          TEXT,
    DecidedAt       TIMESTAMP           NOT NULL DEFAULT NOW()
);


-- ── ATTACHMENT ────────────────────────────────────────────
-- Exactly one of TaskID, SubmissionID, MessageID must be non-null.

CREATE TABLE ATTACHMENT (
    AttachmentID    SERIAL      PRIMARY KEY,
    TaskID          INT         REFERENCES TASK(TaskID)                         ON DELETE CASCADE,
    SubmissionID    INT         REFERENCES TASK_SUBMISSION(SubmissionID)        ON DELETE CASCADE,
    MessageID       INT         REFERENCES MESSAGE(MessageID)                   ON DELETE CASCADE,
    FileName        VARCHAR(255) NOT NULL,
    FileURL         TEXT        NOT NULL,
    UploadedAt      TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_attachment_single_parent CHECK (
        (TaskID IS NOT NULL)::INT +
        (SubmissionID IS NOT NULL)::INT +
        (MessageID IS NOT NULL)::INT = 1
    )
);


-- ── NOTIFICATION ──────────────────────────────────────────

CREATE TABLE NOTIFICATION (
    NotificationID  SERIAL                  PRIMARY KEY,
    UserID          INT                     NOT NULL REFERENCES "USER"(UserID) ON DELETE CASCADE,
    TaskID          INT                     REFERENCES TASK(TaskID) ON DELETE CASCADE,
    Channel         notification_channel    NOT NULL DEFAULT 'InApp',
    Message         TEXT                    NOT NULL,
    ScheduledAt     TIMESTAMP,
    SentAt          TIMESTAMP,
    Status          notification_status     NOT NULL DEFAULT 'Scheduled',
    IsRead          BOOLEAN                 NOT NULL DEFAULT FALSE
);


-- ── REMINDER ──────────────────────────────────────────────

CREATE TABLE REMINDER (
    ReminderID      SERIAL          PRIMARY KEY,
    TaskID          INT             NOT NULL REFERENCES TASK(TaskID) ON DELETE CASCADE,
    CreatedBy       INT             NOT NULL REFERENCES "USER"(UserID) ON DELETE CASCADE,
    ReminderTime    TIMESTAMP       NOT NULL,
    ReminderType    reminder_type   NOT NULL DEFAULT 'Custom'
);


-- ── INSPECTION ────────────────────────────────────────────
-- Optional: not every task has an inspection.
-- UNIQUE on TaskID enforces the one-to-zero-or-one relationship.

CREATE TABLE INSPECTION (
    InspectionID    SERIAL              PRIMARY KEY,
    TaskID          INT                 NOT NULL UNIQUE REFERENCES TASK(TaskID) ON DELETE CASCADE,
    InspectedBy     VARCHAR(150),
    InspectionDate  DATE,
    InspectionHrs   NUMERIC(6,2),
    Status          inspection_status   NOT NULL DEFAULT 'Pending',
    Findings        TEXT,
    Notes           TEXT,
    SiteName        VARCHAR(150),
    SiteLocation    VARCHAR(255),
    ContactNo       VARCHAR(20),
    CreatedAt       TIMESTAMP           NOT NULL DEFAULT NOW()
);


-- ── Indexes ───────────────────────────────────────────────

CREATE INDEX idx_task_status        ON TASK(Status);
CREATE INDEX idx_task_category      ON TASK(TaskCategory);
CREATE INDEX idx_task_createdby     ON TASK(CreatedBy);
CREATE INDEX idx_assignment_task    ON TASK_ASSIGNMENT(TaskID);
CREATE INDEX idx_assignment_to      ON TASK_ASSIGNMENT(AssignedTo);
CREATE INDEX idx_submission_task    ON TASK_SUBMISSION(TaskID);
CREATE INDEX idx_notification_user  ON NOTIFICATION(UserID);
CREATE INDEX idx_message_task       ON MESSAGE(TaskID);
CREATE INDEX idx_reminder_task      ON REMINDER(TaskID);
