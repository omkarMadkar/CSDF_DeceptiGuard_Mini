# DeceptiGuard: API Specification

| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticates user; traps decoy accounts (`admin.backup`) | Public |
| `POST` | `/api/auth/logout` | Clears auth session cookie | Authenticated |
| `GET` | `/api/auth/me` | Fetches active profile metadata | Authenticated |
| `GET` | `/api/files` | RBAC-filtered document explorer (honeyfiles disguised) | Authenticated |
| `GET` | `/api/files/:id` | Document content viewer (Honeyfile access triggers R1) | Authenticated |
| `GET` | `/api/files/:id/download` | Document stream download | Authenticated |
| `GET` | `/api/search?q=` | File search query (Canary honeytokens trigger R3) | Authenticated |
| `ALL` | `/api/v1/admin/export-all` | Decoy administrative shadow endpoint (Traps R1) | Public / Intruder |
| `ALL` | `/internal/db-dump` | Decoy database dump endpoint (Traps R1) | Public / Intruder |
| `ALL` | `/backup/old` | Decoy legacy backup endpoint (Traps R1) | Public / Intruder |
| `GET` | `/api/soc/stats` | KPI summary statistics for live dashboard | Public |
| `GET` | `/api/soc/alerts` | Recent correlated alerts | Public |
| `GET` | `/api/soc/leaderboard` | User risk rankings | Public |
| `GET` | `/api/soc/heatmap` | 24-hour access activity distribution | Public |
| `GET` | `/api/soc/decoys` | Deception inventory catalog | Public |
| `PATCH`| `/api/soc/decoys/:id/toggle` | Arm or disarm a deception trap | Public |
| `GET` | `/api/forensics/verify` | Validates SHA-256 recursive hash chain | Public |
| `POST`| `/api/forensics/tamper-demo` | Simulates database tampering by mutating a record | Public |
| `POST`| `/api/forensics/restore-chain` | Re-synchronizes damaged hash chain | Public |
| `GET` | `/api/forensics/incidents` | Incident cases list | Public |
| `GET` | `/api/forensics/incidents/:id` | Incident case detail with timeline | Public |
| `GET` | `/api/forensics/incidents/:id/export` | Export report (`?format=pdf|csv|json`) | Public |
| `GET` | `/api/forensics/custody` | ISO/IEC 27037 chain-of-custody audit log | Public |
| `POST`| `/api/sim/run/:scenarioId` | Automated insider attack runner (`S1` to `S5`) | Public |
