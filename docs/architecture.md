# DeceptiGuard: Architecture Specification
## Component Architecture & Data Flow

```mermaid
graph TD
    subgraph ClientLayer ["Client / Presentation Tier"]
        UI["SOC Dashboard & Employee Portal<br/>(React / Vanilla Web Client)"]
        WSClient["Socket.IO Client<br/>(Live Telemetry Subscriber)"]
    end

    subgraph ServerLayer ["Application & Detection Tier"]
        API["Express.js REST Engine<br/>(:5001/api)"]
        AuthMiddleware["JWT & RBAC Middleware"]
        DeceptionMgr["Deception Manager<br/>(Canary & Trap Registry)"]
        RulesEngine["Explainable Rules Engine<br/>(R1 to R8 Evaluation)"]
        WSServer["Socket.IO Broadcast Server"]
    end

    subgraph ForensicLayer ["Digital Forensics Evidentiary Vault"]
        HashChain["SHA-256 Recursive Hash Chain<br/>(H_n = SHA256(H_{n-1} + CanonicalJSON))"]
        CustodyLogger["ISO/IEC 27037 Custody Log"]
        ReportExporter["Forensic Dossier Exporter<br/>(PDF, JSON, CSV with SHA-256 Manifest)"]
    end

    subgraph DataLayer ["Data Tier (MongoDB)"]
        UsersCol[("Users (Includes Decoy Lures)")]
        FilesCol[("Virtual File System")]
        DecoysCol[("Deception Registry")]
        EventsCol[("Raw Telemetry Events")]
        AlertsCol[("Correlated Threat Alerts")]
        EvidenceCol[("Append-Only Evidence Ledger")]
        IncidentsCol[("Forensic Incidents")]
        CustodyCol[("Custody Log Ledger")]
    end

    UI -->|HTTP Requests| API
    API --> AuthMiddleware
    AuthMiddleware --> DeceptionMgr
    API --> RulesEngine
    RulesEngine -->|Trigger Alert| WSServer
    WSServer -->|Live Push| WSClient
    RulesEngine -->|Cryptographic Append| HashChain
    HashChain --> EvidenceCol
    RulesEngine --> AlertsCol
    RulesEngine --> IncidentsCol
    API --> UsersCol
    API --> FilesCol
    API --> DecoysCol
    API --> EventsCol
    CustodyLogger --> CustodyCol
    ReportExporter --> CustodyLogger
```

### Forensic Evidentiary Ingestion Pipeline
1. **User Action:** Employee views or downloads a document or makes an API request.
2. **Context Enrichment:** Action tagged with timestamp (UTC), IP, user-agent, session ID, and role.
3. **Deception Check:** Evaluated against `Decoy` collection.
4. **Scoring Engine:** Fired rules add weighted risk points; decay is applied dynamically.
5. **Cryptographic Chaining:** Each record incorporates the SHA-256 digest of the predecessor record.
6. **Real-time SOC Broadcast:** Socket.IO emits the threat event to active analysts.
