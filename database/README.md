# Database Documentation

## Quick Overview

**File:** `ticket_test.db` (auto-created on first run)

⚠️ **Important:** The database is **LOCAL** to each environment:
- Your laptop has its own database
- The deployed Streamlit app has its own database
- Your friend's laptop has its own database
- **They DON'T sync** - each is independent

TicketToTest AI uses SQLite to store:
- 📊 **Generations** - Each test generation session (ticket info, timestamp, Excel path)
- ✅ **Test Cases** - All generated test cases (title, priority, category, steps)
- ⚠️ **Coverage Gaps** - Identified missing scenarios

## Schema

```sql
generations (id, ticket_id, ticket_title, ticket_type, timestamp, total_test_cases, excel_file_path)
  └── test_cases (id, generation_id, title, priority, category, test_steps, expected_result)
  └── coverage_gaps (id, generation_id, gap_description)
```

## Access Methods

### 1. Python API (Recommended)
```python
from database import DatabaseManager

db = DatabaseManager()
history = db.get_generation_history(limit=10)
results = db.search_by_ticket_id("KAN-2")
test_cases = db.get_test_cases(generation_id)
```

### 2. SQLite Browser
Open `ticket_test.db` in [DB Browser for SQLite](https://sqlitebrowser.org/)

### 3. Command Line
```powershell
sqlite3 ticket_test.db "SELECT * FROM generations ORDER BY timestamp DESC LIMIT 5;"
```

## Quick Queries

```sql
-- Recent generations
SELECT ticket_id, ticket_title, total_test_cases, timestamp 
FROM generations ORDER BY timestamp DESC LIMIT 10;

-- Test cases by priority
SELECT priority, COUNT(*) FROM test_cases GROUP BY priority;

-- Generations with gaps
SELECT DISTINCT g.ticket_id FROM generations g 
JOIN coverage_gaps cg ON g.id = cg.generation_id;
```

## Maintenance

```powershell
# Backup
copy ticket_test.db backup.db

# Reset (delete and it recreates)
del ticket_test.db
```

**Note:** Database is in `.gitignore` - don't commit sensitive ticket data!
