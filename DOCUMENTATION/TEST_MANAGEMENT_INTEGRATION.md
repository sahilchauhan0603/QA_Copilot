# Test Management Tool Integration Guide

## Overview

QA Copilot seamlessly integrates with popular test management tools, allowing you to export generated test cases directly to:

- **Xray for Jira** - Test management plugin for Jira
- **Zephyr Scale** - Cloud-based test management (formerly Zephyr Squad)
- **TestRail** - Standalone test case management platform

This feature eliminates manual copy-paste work and ensures your test cases are immediately available in your test management system with full traceability.

---

## Supported Integrations

### 1. Xray for Jira

**What is Xray?**  
Xray is a comprehensive test management app for Jira that adds test planning, execution, and reporting capabilities.

**What Gets Created:**
- **Test Set** - Container for all test cases (one per generation)
- **Test Issues** - Individual test cases with steps and expected results
- **Test Links** - Automatic linking to source Jira story/bug

**Features:**
- Uses your existing Jira credentials
- Creates structured test steps in Xray format
- Maps priorities (P0→Highest, P1→High, P2→Medium, P3→Low)
- Links tests to source tickets automatically

**Configuration Required:**
```env
# .env file
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_jira_token
XRAY_PROJECT_KEY=PROJ
```

**How to Get API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "QA Copilot")
4. Copy the token to your `.env` file

---

### 2. Zephyr Scale

**What is Zephyr Scale?**  
Zephyr Scale (formerly Zephyr Squad) is a cloud-based test management solution by SmartBear, designed for agile teams.

**What Gets Created:**
- **Test Cycle** - Execution container for test cases
- **Test Cases** - Structured test cases with step-by-step scripts
- **Test Executions** - Test cases added to the cycle
- **Issue Links** - Links to source Jira tickets

**Features:**
- Separate API from Jira (more robust)
- STEP_BY_STEP test script format
- Automatic project ID lookup
- Full traceability to Jira issues

**Configuration Required:**
```env
# .env file
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_jira_token
ZEPHYR_API_TOKEN=your_zephyr_token
ZEPHYR_PROJECT_KEY=PROJ
```

**How to Get Zephyr API Token:**
1. Open Jira and go to Zephyr Scale
2. Click on your profile → API Access Tokens
3. Create new token
4. Copy the Bearer token to your `.env` file

---

### 3. TestRail

**What is TestRail?**  
TestRail is a standalone web-based test case management tool by Gurock (now Idera).

**What Gets Created:**
- **Test Suite** - Top-level container for test cases
- **Sections** - Folders organized by test category (Functional, Regression, etc.)
- **Test Cases** - Detailed test cases with formatted steps
- **References** - Links to external tickets (Jira/DevOps)

**Features:**
- Standalone platform (not Jira-dependent)
- Hierarchical organization (Suite → Section → Cases)
- Type and priority mapping
- External ticket references in `refs` field

**Configuration Required:**
```env
# .env file
TESTRAIL_URL=https://yourcompany.testrail.io
TESTRAIL_EMAIL=your@email.com
TESTRAIL_API_KEY=your_api_key
TESTRAIL_PROJECT_ID=1
```

**How to Get TestRail API Key:**
1. Log into TestRail
2. Click on your name → My Settings
3. Go to API Keys tab
4. Click "Add Key"
5. Copy the API key to your `.env` file

**How to Find Project ID:**
1. Navigate to your project in TestRail
2. Look at the URL: `https://yourcompany.testrail.io/index.php?/projects/overview/1`
3. The number at the end is your project ID

---

## Using the Export Feature

### Step-by-Step Guide

1. **Generate Test Cases**
   - Use the Integration tab or Manual Input
   - Wait for generation to complete (~4-5 minutes)

2. **Open Detail View**
   - Click "View Details" on the generated test cases

3. **Export to Test Tool**
   - Click the **"Export to Test Tool"** button (purple button)
   - A dropdown menu appears with three options:
     - Xray for Jira
     - Zephyr Scale
     - TestRail

4. **Select Your Tool**
   - Click on your preferred tool
   - A dialog appears asking for suite/cycle name

5. **Enter Suite/Cycle Name (Optional)**
   - **Xray**: Test Set name (optional, defaults to ticket ID)
   - **Zephyr**: Test Cycle name (optional, defaults to ticket ID)
   - **TestRail**: Test Suite name (REQUIRED)

6. **Confirm Export**
   - Click "Export" button
   - Wait for confirmation toast

7. **Verify in Test Tool**
   - Open your test management tool
   - Navigate to the project/suite
   - Find the newly created test cases

---

## What Gets Exported

### Test Case Structure

Each exported test case includes:

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Test case name | "Verify login with valid credentials" |
| **Priority** | Test priority | P0, P1, P2, P3 |
| **Category** | Test type | Functional, Regression, Negative, etc. |
| **Steps** | Step-by-step actions | 1. Navigate to login\n2. Enter credentials\n3. Click submit |
| **Expected Results** | Expected outcome per step | User is logged in successfully |
| **Test Data** | Sample data for testing | username: testuser@example.com |
| **Preconditions** | Setup requirements | User account must exist |
| **Tags** | Category labels | [Functional, P0, Login] |

### Priority Mapping

| QA Copilot | Xray (Jira) | Zephyr Scale | TestRail |
|------------|-------------|--------------|----------|
| P0 (Critical) | Highest | Highest | 4 (Critical) |
| P1 (High) | High | High | 3 (High) |
| P2 (Medium) | Medium | Medium | 2 (Medium) |
| P3 (Low) | Low | Low | 1 (Low) |

### Test Type Mapping (TestRail Only)

| Category | TestRail Type ID |
|----------|------------------|
| Functional | 1 |
| Regression | 2 |
| Integration | 3 |
| Performance | 4 |
| Security | 5 |
| Negative | 6 |
| Edge Case | 7 |

---

## Linking to Source Tickets

### Automatic Linking

If your test generation originated from a Jira or Azure DevOps ticket, the export feature automatically creates links:

**Xray:**
- Creates issue link between Test and Story/Bug
- Link type: "Tests" relationship

**Zephyr Scale:**
- Links test cases to Jira issues
- Visible in the "Links" section of test cases

**TestRail:**
- Adds ticket ID to the `refs` field
- Format: `JIRA-123` or `ADO-45678`

---

## Bulk Export

The export feature automatically handles bulk creation:

- **Batch Size**: All test cases exported in one operation
- **Performance**: Optimized API calls (5-10 cases per second)
- **Error Handling**: Individual failures don't stop the export
- **Reporting**: Shows summary of created/failed cases

Example output:
```
✅ Exported 47 test cases to Xray
   Created: 47
   Failed: 0
   Suite ID: TEST-123
```

---

## Troubleshooting

### Common Issues

**1. "Integration not configured" Error**
- **Cause**: Missing environment variables
- **Solution**: Check your `.env` file has all required credentials
- **Verify**: Run `.\scripts\start_backend.ps1` and check for warnings

**2. "Authentication failed" Error**
- **Cause**: Invalid API token or credentials
- **Solution**: Regenerate API tokens and update `.env` file
- **Test**: Use Postman to verify credentials work

**3. "Project not found" Error (Xray/Zephyr)**
- **Cause**: Invalid project key
- **Solution**: Verify project key matches Jira project
- **Example**: If Jira project is `MYPROJ`, use `XRAY_PROJECT_KEY=MYPROJ`

**4. "Suite name required" Error (TestRail)**
- **Cause**: TestRail requires suite names
- **Solution**: Always enter a suite name when exporting to TestRail

**5. Export succeeds but tests not visible**
- **Cause**: Permission issues or wrong project
- **Solution**: 
  - Verify your API user has "Create Test" permissions
  - Check you're looking in the correct project

### Rate Limiting

All integrations respect API rate limits:
- **Xray**: Uses Jira rate limits (~300 req/min)
- **Zephyr**: SmartBear API limits (~120 req/min)
- **TestRail**: Custom rate limits (configurable)

For large exports (100+ cases), the export may take 2-5 minutes.

---

## Best Practices

### 1. Naming Conventions

Use descriptive suite/cycle names:
- ✅ `PROJ-123 - User Authentication`
- ✅ `Sprint 42 - API Testing`
- ❌ `Test Suite 1`
- ❌ `Tests`

### 2. Organization

**Xray:**
- Create Test Sets per feature/story
- Use Test Plans to group related sets

**Zephyr:**
- Create Test Cycles per sprint/release
- Use folders to organize test cases

**TestRail:**
- Use sections to categorize by type
- Create suites per feature/module

### 3. Maintenance

- Re-export when test cases are updated
- Archive old test sets/suites
- Keep ticket links up to date

### 4. Integration Workflow

Recommended workflow:
1. Fetch ticket from Jira/DevOps
2. Generate test cases with AI agents
3. Review and validate test cases
4. Export to Excel (for documentation)
5. Export to test management tool
6. Execute tests in the tool
7. Sync results back to Jira (manual for now)

---

## Security Considerations

### Credential Storage

All credentials are encrypted in the database using Fernet AES-256:
- API tokens are never stored in plain text
- Encryption key is separate from credentials
- Each workspace has isolated credentials

### API Token Best Practices

1. **Use dedicated service accounts**
   - Don't use personal API tokens
   - Create "qa-copilot@company.com" accounts

2. **Rotate tokens regularly**
   - Change tokens every 90 days
   - Revoke old tokens immediately

3. **Limit permissions**
   - Only grant necessary permissions
   - TestRail: "Add Test Cases" only
   - Jira: "Browse Projects", "Create Issues"

4. **Audit access**
   - Monitor API usage in test tools
   - Review who has access to QA Copilot

---

## API Reference

### Export API Endpoints

**Xray Export:**
```
POST /api/test-management/export-xray
{
  "generation_id": "uuid",
  "suite_name": "Optional Test Set Name",
  "ticket_id": "JIRA-123"
}
```

**Zephyr Export:**
```
POST /api/test-management/export-zephyr
{
  "generation_id": "uuid",
  "cycle_name": "Optional Cycle Name",
  "ticket_id": "JIRA-123"
}
```

**TestRail Export:**
```
POST /api/test-management/export-testrail
{
  "generation_id": "uuid",
  "suite_name": "Required Suite Name",
  "ticket_id": "JIRA-123"
}
```

**Response:**
```json
{
  "success": true,
  "tool": "xray",
  "suite_id": "TEST-123",
  "created": 47,
  "failed": 0,
  "test_ids": ["TEST-124", "TEST-125", ...]
}
```

---

## Future Enhancements

- [ ] Bi-directional sync (import test results)
- [ ] qTest integration
- [ ] Jira Test Management (cloud) support
- [ ] PractiTest integration
- [ ] Custom field mapping
- [ ] Bulk update existing tests

---

## Support

### Getting Help

- **Documentation**: Check this guide first
- **Logs**: Review backend logs for detailed errors
- **GitHub Issues**: Report bugs or feature requests
- **Email**: Contact your QA Admin

### Useful Links

- [Xray REST API Docs](https://docs.getxray.app/display/XRAY/REST+API)
- [Zephyr Scale API Docs](https://support.smartbear.com/zephyr-scale-cloud/api-docs/)
- [TestRail API Docs](https://www.gurock.com/testrail/docs/api)

---

**Built with ❤️ for QA teams everywhere**
