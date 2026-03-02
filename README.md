# QA Copilot - Agentic Test Generation Platform

> Transform Jira/Azure DevOps tickets into comprehensive test cases in 4-5 minutes using AI agents.

---

## 🎯 Overview

**QA Copilot** is a production-ready web application that automates test case creation using five specialized AI agents orchestrated by LangGraph. Built with React, Flask, and PostgreSQL, it delivers enterprise-grade test generation with team collaboration features.

### Key Features

✅ **Intelligent Test Generation** - 5 AI agents analyze tickets and generate comprehensive test suites  
✅ **Live Integrations** - Direct Jira & Azure DevOps connectivity with sync capabilities  
✅ **Test Management Export** - One-click export to Xray, Zephyr Scale, or TestRail  
✅ **Refine Results** - 6 refinement options to optimize test cases (minimize, focus, edge cases, coverage, simplify, regenerate)  
✅ **Team Collaboration** - Multi-user authentication, teams, and workspace management  
✅ **Excel Export** - Professional 4-sheet Excel output (Summary, Test Cases, QA Roadmap, Coverage)  
✅ **Version History** - PostgreSQL storage with audit trails and regeneration  
✅ **Real-time Progress** - SSE-based live updates during generation  
✅ **Password Reset** - Secure email-based password recovery  
✅ **Sync to Tickets** - Attach Excel files and post comments directly to Jira/DevOps

### What You Get

1. **QA Execution Roadmap** - Categorized scenarios (Happy Path, Negative, Edge Cases, Regression)  
2. **Detailed Test Cases** - Step-by-step instructions with expected results and test data  
3. **Coverage Analysis** - Gap identification with clarifying questions  
4. **Refinement Options** - Minimize redundancy, focus on areas, add edge cases, increase coverage, or simplify  
5. **Professional Excel Export** - Ready for Jira, Xray, Zephyr, or any test management tool  
6. **Direct Export to Test Tools** - Export test cases directly to Xray, Zephyr Scale, or TestRail with one click

---

## 📺 For Viewers to QuickStart

**All necessary  materials are available in the [`DOCUMENTATION`](./DOCUMENTATION/) folder:**

- 🛠️ **Installation Instructions** - [Setup Guide](./DOCUMENTATION/INSTALLATION_GUIDE.md)

---

## 🤖 Agentic Architecture

Five specialized agents working autonomously in sequence:

```
┌─────────────────────┐
│  Ticket Reader      │ ← Extracts requirements & identifies gaps
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Context Builder    │ ← Maps impacted modules & dependencies
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Test Strategist    │ ← Creates QA roadmap by category
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Test Generator     │ ← Generates detailed test cases
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Coverage Auditor   │ ← Validates coverage & finds gaps
└──────────┬──────────┘
           ↓
      ┌────────┐
      │  END   │
      └────────┘
```

*(Sync Agent for auto-posting to Jira/ADO available - planned for integration)*

**Why This Is Truly Agentic:**
- ✅ **Autonomous Decisions** - Each agent makes context-based decisions
- ✅ **Goal-Driven** - Optimizes for complete test coverage
- ✅ **Self-Correcting** - Coverage Auditor validates and improves
- ✅ **Stateful Memory** - Agents build on previous outputs
- ✅ **Adaptive** - Handles any ticket type (bug, feature, API change)

---

## 🏗️ Tech Stack

**Frontend:**
- React 18 + Vite
- Tailwind CSS
- Zustand (state management)
- React Router
- React Hot Toast

**Backend:**
- Flask API
- JWT Authentication (bcrypt + Flask-JWT-Extended)
- Server-Sent Events (SSE)
- Fernet AES-256 encryption

**AI/Agents:**
- LangGraph (state-based workflow)
- Google Gemini 2.0 Flash
- 5 specialized agents (Reader, Context Builder, Strategist, Generator, Auditor)

**Database:**
- PostgreSQL (SQLAlchemy ORM)
- JSONB for metadata storage

**Integrations:**
- Jira REST API (ticket fetching)
- Azure DevOps API (ticket fetching)
- Xray for Jira (test case export)
- Zephyr Scale (test case export)
- TestRail (test case export)
- SMTP Email Service (password reset)

**Export:**
- openpyxl (in-memory Excel generation with 4 sheets)

---

## 📁 Project Structure

```
QA_Copilot/
├── README.md
├── requirements.txt
├── agents/                  # AI agent system
│   ├── __init__.py
│   ├── context_builder.py
│   ├── coverage_auditor.py
│   ├── orchestrator.py
│   ├── refine_agent.py
│   ├── state.py
│   ├── sync_agent.py
│   ├── test_generator.py
│   ├── test_strategy.py
│   ├── ticket_reader.py
│   └── __pycache__/
├── api/                     # Flask REST API
│   ├── __init__.py
│   ├── decorators.py
│   ├── server.py
│   └── __pycache__/
├── auth/                    # Authentication & Services
│   ├── __init__.py
│   ├── auth_service.py
│   ├── encryption.py
│   ├── integration_service.py
│   ├── team_service.py
│   ├── test_management_service.py
│   ├── workspace_service.py
│   └── __pycache__/
├── database/                # PostgreSQL models
│   ├── __init__.py
│   ├── auth_models.py
│   ├── clear_database.sql
│   ├── connection.py
│   ├── db_manager.py
│   ├── migration_schema.sql
│   ├── models.py
│   ├── README.md
│   └── __pycache__/
├── DOCUMENTATION/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── INSTALLATION_GUIDE.md
│   └── TEST_MANAGEMENT_INTEGRATION.md
├── frontend/                # React UI (Vite)
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── components/
│       │   ├── auth/
│       │   ├── common/
│       │   ├── layout/
│       │   ├── settings/
│       │   ├── teams/
│       │   └── test-generation/
│       ├── pages/
│       ├── services/
│       └── store/
├── integrations/            # Ticket & Test Management
│   ├── __init__.py
│   ├── azure_devops_integration.py
│   ├── base.py
│   ├── jira_integration.py
│   ├── manager.py
│   ├── test_management_base.py
│   ├── testrail_integration.py
│   ├── xray_integration.py
│   ├── zephyr_integration.py
│   └── __pycache__/
├── scripts/                 # Utility scripts
│   ├── README.md
│   ├── clear_database.ps1
│   ├── run_migration.py
│   ├── start_backend.ps1
│   ├── start_frontend.ps1
│   └── __pycache__/
├── utils/
│   ├── __init__.py
│   ├── api_cache.py
│   ├── api_helper.py
│   ├── email_service.py
│   ├── excel_exporter.py
│   ├── rate_limiter.py
│   └── __pycache__/
```

---

## 📊 Business Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time per ticket | 2-3 hours | 4-5 minutes | **90% reduction** |
| Test coverage | ~60% | ~90% | **+30%** |
| Consistency | Variable | Standardized | **High** |
| Junior QA ramp-up | Weeks | Days | **10x faster** |

---

## 🗺️ Roadmap

- [ ] Webhook monitoring for auto-regeneration on ticket updates

---

**Built with ❤️ for QA teams everywhere**
