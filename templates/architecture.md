---
title: "{{title}}"
date: "{{date}}"
type: architecture
version: "1.0"
status: draft
tags: [architecture, design, documentation]
---

<div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); padding: 50px 40px; border-radius: 20px; color: white; text-align: center; margin: 20px 0; box-shadow: 0 16px 50px rgba(30, 58, 95, 0.5);">
  <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 10px; letter-spacing: 2px;">SYSTEM ARCHITECTURE</div>
  <h1 style="margin: 0 0 20px 0; font-size: 2.5em; font-weight: 800;">{{title}}</h1>
  <p style="font-size: 1.1em; margin: 0; opacity: 0.9;">Technical Design Document</p>
</div>

---

## Executive Summary

**Purpose:** 

**Scope:** 

**Key Decisions:** 

---

## System Overview

```mermaid
graph TB
    subgraph Client
        A[Web App]
        B[Mobile App]
    end
    
    subgraph Services
        C[API Gateway]
        D[Auth Service]
        E[Core Service]
    end
    
    subgraph Data
        F[(Database)]
        G[(Cache)]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    E --> F
    E --> G
```

---

## Components

| Component | Technology | Description |
|-----------|------------|-------------|
| Frontend | React | Web UI |
| Backend | Node.js | API Server |
| Database | PostgreSQL | Data Store |
| Cache | Redis | Session Cache |

---

## Data Flow

```mermaid
sequenceDiagram
    User->>Frontend: Action
    Frontend->>API: Request
    API->>Database: Query
    Database-->>API: Data
    API-->>Frontend: Response
    Frontend-->>User: Update
```

---

## Security

- [ ] Authentication (JWT)
- [ ] Authorization (RBAC)
- [ ] Encryption (TLS)
- [ ] Input Validation

---

## Deployment

```mermaid
graph LR
    Dev[Developer] --> Git[GitHub]
    Git --> CI[CI/CD]
    CI --> Stage[Staging]
    Stage --> Prod[Production]
```

---

## Trade-offs

### Decision 1
**Context:** 
**Decision:** 
**Rationale:** 

---

<div style="text-align: center; color: #888; font-size: 0.85em; padding: 20px; border-top: 2px solid #1e3a5f; margin-top: 30px;">
  {{title}} | Architecture Document | {{date}}
</div>
