<div align="center">

# 🤖 QA Copilot
### Agentic Test Generation Platform

**Transform Jira/Azure DevOps tickets into comprehensive test cases in 4-5 minutes using AI agents.**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_App-2ea44f?style=for-the-badge)](https://qa-copilot.onrender.com/login)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](#)
[![Flask](https://img.shields.io/badge/Flask-Backend-000000?style=flat-square&logo=flask&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=white)](#)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-orange?style=flat-square)](#)

</div>

---

## 📚 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [What You Get](#-what-you-get)
- [Quick Start](#-for-viewers-to-quickstart)
- [Agentic Architecture](#-agentic-architecture)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Business Impact](#-business-impact)
- [Roadmap](#️-roadmap)

---

## 🎯 Overview

**QA Copilot** is a production-ready web application that automates test case creation using **five specialized AI agents** orchestrated by LangGraph. Built with React, Flask, and PostgreSQL, it delivers enterprise-grade test generation with full team collaboration support — turning a 2–3 hour manual process into a 4–5 minute automated workflow.

---

## ✨ Key Features

<table>
<tr>
<td width="50%" valign="top">

**🧠 Intelligence & Generation**
- Intelligent test generation via 5 coordinated AI agents
- File attachment analysis (up to 3 × 500 KB) — derive tests from actual code/config
- 6 refinement options: minimize, focus, edge cases, coverage, simplify, regenerate

**🔗 Integrations**
- Live Jira & Azure DevOps connectivity with sync
- One-click export to Xray, Zephyr Scale, or TestRail
- Sync results back to tickets via file attachments and comments

</td>
<td width="50%" valign="top">

**👥 Collaboration & Management**
- Multi-user auth with role-based teams (Admin / QA Lead / QA Member)
- Member search, filtering, and pending invitation management
- Profile management with photo upload and real-time username validation

**⚙️ Platform & Reliability**
- Professional 4-sheet Excel export (Summary, Test Cases, Roadmap, Coverage)
- Version history with PostgreSQL audit trails
- Real-time SSE progress updates
- Secure email-based password reset
- Webhook monitoring with auto-regeneration on ticket updates

</td>
</tr>
</table>

---

## 🎁 What You Get

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | 🗺️ **QA Execution Roadmap** | Categorized scenarios — Happy Path, Negative, Edge Cases, Regression |
| 2 | 📋 **Detailed Test Cases** | Step-by-step instructions with expected results and test data |
| 3 | 💻 **Code-Aware Testing** | Tests derived from actual implementation paths, validations, and error handling |
| 4 | 🔍 **Coverage Analysis** | Gap identification with clarifying questions |
| 5 | 🛠️ **Refinement Options** | Minimize, focus, add edge cases, boost coverage, or simplify |
| 6 | 📊 **Excel Export** | Polished, ready-to-share output for any test management tool |
| 7 | 📤 **Direct Tool Export** | One-click export to Xray, Zephyr Scale, or TestRail |

---

## 📺 For Viewers to QuickStart

All necessary materials live in the [`DOCUMENTATION`](./DOCUMENTATION/) folder:

| Resource | Link |
|----------|------|
| 🛠️ Installation Instructions | [Setup Guide](./DOCUMENTATION/INSTALLATION_GUIDE.md) |

---

## 🤖 Agentic Architecture

Five specialized agents work autonomously in sequence, each building on the last:

```
 ┌───────────────────────┐
 │   1. Ticket Reader     │  Extracts requirements & identifies gaps
 └───────────┬───────────┘
             │
 ┌───────────▼───────────┐
 │  2. Context Builder    │  Maps impacted modules & dependencies
 └───────────┬───────────┘
             │
 ┌───────────▼───────────┐
 │  3. Test Strategist    │  Creates QA roadmap by category
 └───────────┬───────────┘
             │
 ┌───────────▼───────────┐
 │  4. Test Generator     │  Generates detailed test cases
 └───────────┬───────────┘
             │
 ┌───────────▼───────────┐
 │  5. Coverage Auditor   │  Validates coverage & finds gaps
 └───────────┬───────────┘
             │
          ┌──▼──┐
          │ END │
          └─────┘
```

> 🔮 *A Sync Agent for auto-posting to Jira/ADO is planned for future integration.*

**Why This Is Truly Agentic:**

| Trait | How It Shows Up |
|-------|------------------|
| ✅ **Autonomous Decisions** | Each agent makes context-based decisions independently |
| 🎯 **Goal-Driven** | Optimizes continuously for complete test coverage |
| 🔄 **Self-Correcting** | Coverage Auditor validates and improves prior output |
| 🧠 **Stateful Memory** | Agents build on the outputs of those before them |
| 🧩 **Adaptive** | Handles any ticket type — bug, feature, or API change |

---

## 🏗️ Tech Stack

<table>
<tr><td valign="top" width="25%">

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Zustand
- React Router
- React Hot Toast

</td><td valign="top" width="25%">

**Backend**
- Flask API
- JWT Auth (bcrypt + Flask-JWT-Extended)
- Server-Sent Events (SSE)
- Fernet AES-256 encryption

</td><td valign="top" width="25%">

**AI / Agents**
- LangGraph orchestration
- Google Gemini 2.0 Flash
- 5 specialized agents

</td><td valign="top" width="25%">

**Data & Integrations**
- PostgreSQL + SQLAlchemy ORM
- JSONB metadata storage
- Jira / Azure DevOps APIs
- Xray, Zephyr, TestRail export
- SMTP email service
- openpyxl Excel generation

</td></tr>
</table>

---

## 📁 Project Structure

```
QA_Copilot/
├── README.md
├── requirements.txt
├── backend/                     # All backend Python code
│   ├── .env                     # Environment variables (not committed)
│   ├── .env.example             # Environment variable template
│   ├── agents/                  # AI agent system
│   │   ├── context_builder.py
│   │   ├── coverage_auditor.py
│   │   ├── orchestrator.py
│   │   ├── refine_agent.py
│   │   ├── state.py
│   │   ├── sync_agent.py
│   │   ├── test_generator.py
│   │   ├── test_strategy.py
│   │   └── ticket_reader.py
│   ├── api/                     # Flask REST API
│   │   ├── server.py            # Minimal app entry-point
│   │   ├── shared.py            # Shared services & state
│   │   ├── decorators.py
│   │   └── routes/
│   │       ├── auth.py              # /api/auth/*
│   │       ├── generation.py        # /api/test-generation/*
│   │       ├── integrations.py      # /api/integrations/*
│   │       ├── teams.py             # /api/teams/*
│   │       ├── test_management.py   # /api/test-management/*
│   │       └── workspaces.py        # /api/workspaces/*
│   ├── services/                # Business logic services
│   │   ├── auth_service.py
│   │   ├── encryption.py
│   │   ├── integration_service.py
│   │   ├── team_service.py
│   │   ├── test_management_service.py
│   │   └── workspace_service.py
│   ├── database/                # PostgreSQL models & migrations
│   │   ├── auth_models.py
│   │   ├── clear_database.sql
│   │   ├── connection.py
│   │   ├── db_manager.py
│   │   ├── migration_schema.sql
│   │   └── models.py
│   ├── integrations/            # Ticket & Test Management connectors
│   │   ├── azure_devops_integration.py
│   │   ├── base.py
│   │   ├── jira_integration.py
│   │   ├── manager.py
│   │   ├── test_management_base.py
│   │   ├── testrail_integration.py
│   │   ├── xray_integration.py
│   │   └── zephyr_integration.py
│   └── utils/
│       ├── api_cache.py
│       ├── api_helper.py
│       ├── email_service.py
│       ├── excel_exporter.py
│       └── rate_limiter.py
├── frontend/                     # React UI (Vite)
│   ├── .env                     # Environment variables (not committed)
│   ├── .env.example             # Environment variable template
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
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
├── DOCUMENTATION/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── INSTALLATION_GUIDE.md
│   └── TEST_MANAGEMENT_INTEGRATION.md
└── scripts/                      # Utility scripts
    ├── clear_database.ps1
    ├── run_migration.py
    ├── start_backend.ps1
    └── start_frontend.ps1
```

---

## 📊 Business Impact

| Metric | Before | After | Improvement |
|:--|:--:|:--:|:--:|
| ⏱️ Time per ticket | 2–3 hours | 4–5 minutes | 🚀 **90% reduction** |
| ✅ Test coverage | ~60% | ~90% | 📈 **+30%** |
| 🎯 Consistency | Variable | Standardized | ⭐ **High** |
| 🧑‍💻 Junior QA ramp-up | Weeks | Days | ⚡ **10x faster** |

---

## 🗺️ Roadmap

- [ ] 🌐 Web crawling feature to analyze websites and automatically generate test cases

---

<div align="center">

**Built with ❤️ for QA teams everywhere**

</div>