-- ============================================================
-- Migration: Replace task_category ENUM with categories table
-- ============================================================

BEGIN;

-- 1. Create the new categories table (different name to avoid enum conflict)
CREATE TABLE categories (
    categoryid  SERIAL       PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(50)  NOT NULL UNIQUE,
    color       VARCHAR(20)  NOT NULL DEFAULT '#64748b',
    createdat   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 2. Seed the three existing categories
INSERT INTO categories (name, slug, color) VALUES
    ('Work Tracking',      'WorkTracking',    '#2563eb'),
    ('Support Service',    'SupportService',  '#059669'),
    ('Training & Project', 'TrainingProject', '#7c3aed');

-- 3. Add new categoryid column to TASK (nullable first)
ALTER TABLE TASK ADD COLUMN categoryid INT REFERENCES categories(categoryid);

-- 4. Populate from old enum value
UPDATE TASK SET categoryid = (SELECT categoryid FROM categories WHERE slug = TASK.taskcategory::TEXT);

-- 5. Make NOT NULL
ALTER TABLE TASK ALTER COLUMN categoryid SET NOT NULL;

-- 6. Drop the old enum column
ALTER TABLE TASK DROP COLUMN taskcategory;

-- 7. Drop the old enum type
DROP TYPE task_category;

-- 8. Index
CREATE INDEX idx_task_categoryid ON TASK(categoryid);

COMMIT;
