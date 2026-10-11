# Antigravity Master Build Prompt: DeceptiGuard
## Cyber Security & Digital Forensics (CSDF) Mini-Project
**Project Title:** DeceptiGuard: Insider Threat Detection Using Deception  
**Target Environment:** Local Defensive Lab (Isolated Node.js + Express + React + MongoDB)

---

### Instructions for Antigravity IDE
1. Open this workspace in **Antigravity IDE**.
2. Paste the **Master Prompt** below into the chat.
3. Review Antigravity's proposed directory tree and architecture plan.
4. If building all at once is too large or encounters any context limits, proceed phase-by-phase using the **Modular Phase Prompts** in Section 2.

---

## 1. Master Antigravity Prompt (Single-Shot)

```markdown
ROLE
You are a senior full-stack and cyber security engineer. Build a complete, runnable, LOCAL-LAB mini-project called "DeceptiGuard: Insider Threat Detection Using Deception" for a college Cyber Security and Digital Forensics course. This is a DEFENSIVE SIMULATION: no real exploits, no real malware, no scanning of external networks, no real credentials or real personal data anywhere.

GOAL
Create a simulated company intranet ("Acme Corp Secure Portal") that is seeded with deception assets (honeyfiles, honeytokens, decoy accounts, decoy database records, decoy API endpoints). Any interaction with a decoy must be:
1. Logged as a high-confidence insider-threat event,
2. Scored by an explainable detection engine,
3. Pushed live to a SOC dashboard via WebSockets,
4. Stored as tamper-evident forensic evidence (SHA-256 hash chain),
5. Exportable as an incident report (PDF + JSON + CSV with SHA-256 manifests).

TECH STACK
- Backend: Node.js + Express, MongoDB (Mongoose), Socket.IO, JWT auth (httpOnly cookie), bcrypt, helmet, express-rate-limit, winston / morgan logging.
- Frontend: React (Vite) + Tailwind CSS, Recharts, socket.io-client, React Router.
- Report Export: pdfkit (PDF), plus CSV and JSON exporters with SHA-256 integrity manifest.
- Lab & Scripts: .env.example, seed script (`npm run seed`), README.md with setup and demo steps.
- Coding Standards: Clean modular architecture, comments on every security/forensic decision, and strict linting.

FOLDER STRUCTURE
deceptiguard/
  server/
    src/
      config/        # Database & environment configuration
      models/        # Mongoose schemas (User, File, Event, Alert, Decoy, Evidence, Incident, CustodyLog)
      routes/        # REST route definitions
      controllers/   # Request handlers
      middleware/    # Auth, RBAC, Rate-limit, Ingestion hook
      services/      # DeceptionManager, RulesEngine, ForensicsChain, ReportGenerator
      seed/          # Idempotent seed data generator
      simulator/     # Attack scenario runner (S1-S5)
      utils/         # Crypto SHA-256, Canonical JSON serializer
  client/
    src/
      pages/         # Login, Portal, SOCDashboard, Incidents, Forensics, DeceptionManager, Simulator, Metrics
      components/    # UI elements, Charts, Navbar, TamperModal, Timeline
      hooks/         # useSocket, useAuth
      api/           # Axios/Fetch clients
      context/       # Auth and Alert context providers
  docs/
    architecture.md  # Mermaid component diagram
    api.md           # API specification
    rules.md         # Explanatory detection rule table
  README.md

USER ROLES (Seed 8 fake users)
- Roles: admin, hr, finance, engineer, intern, auditor.
- Each role sees only its authorized departmental folders in the portal.
- Demo credentials seeded and documented in README.

NORMAL PORTAL FEATURES
- Login/logout with security consent banner ("Activity is logged for security compliance").
- Role-based departmental virtual file browser (documents stored virtually in MongoDB, not as dangerous disk binaries).
- File view and virtual download simulation.
- Search box and employee directory.
- Every action (login, failed login, view, download, search, unauthorized access attempt) generates an immutable Event document.

DECEPTION LAYER (Core Engine)
Deception Manager service managing the asset registry. Each decoy has: id, type, name, location, tokenValue, severity, enabled, triggerCount, lastTriggeredAt.
1. HONEYFILES (enticing, unreferenced by business workflows):
   - Salary_Revision_2026_CONFIDENTIAL.xlsx (/HR/Compensation/)
   - Passwords_Backup.txt (/IT/Old_Archives/)
   - Layoffs_Plan_Q4.docx (/HR/Planning/)
   - Client_Database_Full_Export.csv (/Finance/Archive/)
   - VPN_Credentials_Admin.txt (/IT/Network/)
2. HONEYTOKENS (synthetic canary credentials):
   - Fake AWS API Key (embedded in honeyfiles)
   - Fake DB Connection URI (embedded in config lures)
   - Canary Client Email Addresses (in decoy CSV)
   - Any submission in any search box, login, or HTTP header triggers CRITICAL alert.
3. DECOY ACCOUNTS:
   - admin.backup, svc_backup, ceo.assistant (dormant accounts).
   - Any login attempt (success or failure) triggers CRITICAL alert.
4. DECOY DB RECORDS:
   - Shadow collection 'payroll_archive' and decoy employee records with isDecoy=true.
   - Any query triggers HIGH alert.
5. DECOY ENDPOINTS:
   - /api/v1/admin/export-all, /internal/db-dump, /backup/old
   - Hidden link hints in HTML comments and robots.txt.
   - Any invocation triggers CRITICAL alert.
*Crucial: Decoys must appear completely authentic to normal users (no "decoy" badge in portal view).*

DETECTION ENGINE (Explainable Rules & Risk Scoring)
Event Pipeline: Raw Event -> Context Enrichment -> Rules Evaluation -> Risk Score Update -> Alert Dispatch -> Evidence Ingestion.
Rules:
- R1: Decoy Asset Touched (+100, CRITICAL) [T1083 / T1005]
- R2: Decoy Account Login Attempt (+90, CRITICAL) [T1078]
- R3: Honeytoken Canary Used Anywhere (+100, CRITICAL) [T1552]
- R4: After-Hours Access (outside 09:00-19:00 IST) (+15, MEDIUM) [T1078]
- R5: Bulk File Download (>10 files in 5 min) (+30, HIGH) [T1005 / T1567]
- R6: Cross-Department Role Violation (+20, MEDIUM) [T1083]
- R7: Failed Login Brute-Force (>=5 in 10 min) (+10, LOW) [T1110]
- R8: Rapid Directory Enumeration (+25, HIGH) [T1083]
Risk Bands: Low (0-29), Medium (30-59), High (60-89), Critical (90+).
Score Decay: Decays 10% per hour to reflect normal behavioral dissipation.
Simulated Auto-Response: CRITICAL score flags the session, prompts re-auth, and auto-generates an Incident case.

DIGITAL FORENSICS MODULE (ISO/IEC 27037 & NIST SP 800-86 Compliant)
- Evidence Vault: Append-only collection. Each record contains: seq, eventId, canonical payload JSON, prevHash, hash = SHA256(prevHash + canonicalJSON + timestamp). No update or delete routes exist.
- Verification Endpoint: `GET /api/forensics/verify` walks the chain, recalculates every hash, and identifies the exact sequence number if tampered.
- Tamper Simulation Button: Lab action `POST /api/forensics/tamper-demo` mutates one historical record in MongoDB so verify visibly fails.
- ISO 27037 Chain of Custody: `custody_log` records every investigator action, timestamp, and SHA-256 digest of exported reports.
- Forensic Incident Report: Export incident case to PDF with executive summary, suspect attribution, event timeline, MITRE ATT&CK mapping, evidence hashes, and root cause analysis. Also provide JSON and CSV formats.

FRONTEND SOC & PORTAL (React + Tailwind CSS)
1. Login Page: Role picker/credentials, monitoring consent notice.
2. Employee Portal: Clean corporate file browser, search, download action.
3. SOC Live Dashboard: Dark theme, live Socket.IO alert feed, risk leaderboard, access-by-hour heatmap, deception coverage cards.
4. Incidents Console: Incident list, interactive timeline, evidence table, status lifecycle (Open, Investigating, Contained, Closed), export buttons.
5. Deception Manager: Decoy registry, toggle enabled/disabled, trigger counters.
6. Forensics Page: 'Verify Hash Chain' button, 'Simulate Tampering' button, chain of custody log table.
7. Attack Simulator: Interactive panel to execute Scenarios S1-S5 with 1-click.
8. Metrics Dashboard: Detection recall, Mean Time To Detect (MTTD), False Positive Rate, Deception Hit Ratio.

ATTACK SIMULATOR (Scenarios S1 - S5)
- S1 Curious Employee: Accesses /HR/Compensation/Salary_Revision_2026.xlsx -> Expect R1 CRITICAL.
- S2 Disgruntled Admin: Attempts login as admin.backup and calls /api/v1/admin/export-all -> Expect R2 + R1 CRITICAL.
- S3 Data Exfiltrator: Off-hours bulk download of 25 files -> Expect R4 + R5 HIGH.
- S4 Credential Thief: Injects fake canary API key into search box -> Expect R3 CRITICAL.
- S5 Benign Normal User: Performs legitimate daytime work in authorized folders -> Expect 0 alerts (0% False Positives).

DELIVERABLES
1. Fully working code runnable via `npm run seed && npm run dev`.
2. Detailed README.md with setup, credentials, and 5-minute live demo script.
3. Comprehensive documentation in `docs/` (architecture, API, and rules).
4. Unit tests for rules engine and cryptographic hash chain verification.
```

---

## 2. Phase-by-Phase Modular Prompts

If you prefer to build the system incrementally, execute these prompts in order:

### Phase 1: Foundation, Auth & Virtual File System
```markdown
Phase 1: Build the backend foundation for DeceptiGuard.
- Initialize server/ with Express, Mongoose, and dotenv.
- Create Mongoose schemas: User (with roles: admin, hr, finance, engineer, intern, auditor, isDecoy), File (virtual directory structure, isDecoy flag), and Event (raw telemetry log).
- Implement JWT authentication with httpOnly cookies, bcrypt hashing, and role-based access control (RBAC).
- Create virtual file system endpoints: GET /api/files, GET /api/files/:id/download, GET /api/search?q=.
- Build an idempotent seed script (npm run seed) that populates 8 sample users and realistic corporate folders.
- Provide instructions to run and test Phase 1.
```

### Phase 2: Deception Layer & Explainable Rules Engine
```markdown
Phase 2: Add Deception Management and the Detection Engine to DeceptiGuard.
- Create Decoy schema (type, name, location, tokenValue, severity, enabled, triggerCount, lastTriggeredAt).
- Seed 5 honeyfiles (Salary_Revision_2026.xlsx, Passwords_Backup.txt, etc.), canary tokens, decoy accounts (admin.backup), and shadow endpoints (/api/v1/admin/export-all, /internal/db-dump).
- Create rules.json defining rules R1 through R8 with points (+100 for decoys, +90 for decoy accounts, +15 for after-hours, etc.).
- Build RulesEngine service that enriches incoming events, calculates cumulative risk scores, applies 10%/hour score decay, and generates Alert objects.
- Integrate Socket.IO to emit real-time alert broadcasts.
```

### Phase 3: Forensics Subsystem, Hash Chain & Reporting
```markdown
Phase 3: Implement the Digital Forensics and Evidence Integrity Module.
- Create Evidence schema (seq, eventId, payload, prevHash, hash, createdAt).
- Build ForensicsChain service implementing recursive SHA-256 hash chaining: H_n = SHA256(H_{n-1} + CanonicalJSON(P_n)).
- Implement GET /api/forensics/verify to traverse the chain and detect any broken link.
- Implement POST /api/forensics/tamper-demo to simulate database tampering by mutating one historical record.
- Create Incident schema and custody_log collection following ISO/IEC 27037.
- Build forensic report export service supporting PDF (via pdfkit), JSON, and CSV with SHA-256 hash manifests.
```

### Phase 4: Full React SOC Dashboard & Employee Portal
```markdown
Phase 4: Build the complete frontend user interface using React, Vite, and Tailwind CSS.
- Create Login page with user selector and Acceptable Use / Monitoring Consent banner.
- Build Employee Portal for normal users (clean corporate file browser, search, document view).
- Build SOC Dashboard in sleek dark mode: live Socket.IO alert feed, risk leaderboard, access heatmap, and KPI tiles.
- Build Incidents page with chronological timeline, evidence viewer, and PDF report download.
- Build Forensics page with 'Verify Chain' and 'Simulate Tampering' controls.
- Build Deception Manager UI to view and toggle decoys.
```

### Phase 5: Attack Simulator, Evaluation Metrics & Documentation
```markdown
Phase 5: Implement the Attack Simulator, evaluation test harness, and documentation.
- Implement POST /api/sim/run/:scenario executing Scenarios S1 (honeyfile), S2 (decoy account), S3 (bulk exfil), S4 (honeytoken), and S5 (benign user).
- Create automated scenario runner recording Mean Time To Detect (MTTD), Detection Recall, and False Positive Rate.
- Add Jest unit tests for the rules engine and cryptographic hash chain verification.
- Create docs/architecture.md (with Mermaid diagrams), docs/api.md, and docs/rules.md.
- Write a comprehensive README.md with quickstart instructions and a 5-minute live viva presentation script.
```
