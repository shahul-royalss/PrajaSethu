# Praja Setu — Next-Generation Public Grievance Redressal System for Andhra Pradesh

> **Working codename:** *Praja Setu* ("People's Bridge"). Neutral, brandable, and ties to the interoperability ("bridge") theme. Rename freely.
>
> **What this document is:** A complete, buildable blueprint for a modern Public Grievance Redressal System (PGRS) for Andhra Pradesh — grounded in how AP's existing system (**Spandana / CMGRS**) actually works, designed to be **piloted in a single small town/mandal**, and architected to scale to the whole state. It folds in **X-Road (data exchange), permissioned blockchain (tamper-evident audit), NLP/AI/ML, and LLMs** — but only where each genuinely earns its place.
>
> **Audience:** product + engineering team building the pilot, and the district/state officials who would sponsor it.
>
> **Honesty note:** This is a design, not a deployed product. Sections that depend on government approvals (Aadhaar AUA/KUA status, X-Road governance, departmental MoUs) are flagged so you don't mistake "designed" for "available tomorrow."

---

## 0. Executive summary

AP already runs one of India's most mature grievance systems (Spandana). It is not broken — so a "rebuild" only makes sense if it **closes real gaps**: weak inter-department data exchange, limited tamper-evidence (citizens can't *prove* their record wasn't quietly closed or backdated), heavy dependence on literacy/typing, and analytics that are reactive rather than predictive.

**Praja Setu keeps everything that works** (YSR#-style tracking, geo-based dynamic assignment, SLA + reopen + escalation, the Sachivalayam last-mile channel) and adds five capabilities, each mapped to a concrete problem:

| Technology | Real problem it solves | Honest scope |
|---|---|---|
| **X-Road data exchange layer** | Grievances bounce between departments with no secure, standard way to verify/resolve across systems (land, ration, pension, power, police) | The secure inter-department "nervous system." Pilot connects 4–5 departments. |
| **Permissioned blockchain (Hyperledger Fabric)** | Citizens and oversight bodies cannot *cryptographically prove* a record wasn't altered, backdated, or silently closed | Tamper-evident **audit/notary layer only** — not the primary database, no PII on-chain. |
| **NLP (via Bhashini)** | Most rural complainants don't type English; complaints are mis-categorised; duplicates flood the queue | Telugu **voice + text** intake, auto-classification, dedup, distress detection. |
| **AI/ML** | Routing is rule-based; SLA breaches are noticed *after* they happen; systemic issues stay invisible | Smart routing, SLA-breach *prediction*, hotspot/anomaly detection. |
| **LLM** | Filing a structured grievance is hard; officers spend time drafting; status updates are jargon | Conversational filing assistant, draft-assist for officers (human-approved), plain-language status. |

**Pilot-first**: one mandal/town, Telugu-first, voice-first, runs **through the Grama/Ward Sachivalayam** so it works for people without smartphones. Everything degrades gracefully to SMS/IVR/paper. Security and privacy are designed in from line one, not bolted on.

---

# PART A — How public grievance redressal actually works in AP today

*(You asked me to understand the real system first. This section is the factual basis everything else is built on.)*

## A.1 The landscape

AP does not have one grievance system — it has a **layered ecosystem**:

1. **Spandana / CMGRS** (`spandana.ap.gov.in`, `pgrs.ap.gov.in`) — the flagship, general-purpose, all-department grievance platform. This is the core of what we're modernising.
2. **Police PGRS** — a police-specific grievance programme run **every Monday** at police stations, sub-divisional/circle offices, linked to **CCTNS** (Crime & Criminal Tracking Network System). Has its own flavour but the same DNA.
3. **GSWS — Grama/Ward Sachivalayam** — the **last-mile delivery + intake machinery**: ~11,162 Village Secretariats + ~3,842 Ward Secretariats (~15,000 total), ~1.5 lakh staff, **Digital Assistants** and **Volunteers** who deliver services and file things on citizens' behalf at the doorstep. **This is the single most important fact for a small-town pilot.**
4. **Legal backing** — the **AP Public Services Delivery Guarantee Act, 2017**: time-bound delivery of **336 services across 33 departments**, with penalties for officials who default. This is *why* SLAs and escalation exist — they're statutory, not optional.

> **Key boundary (important):** Spandana is for **grievances**, not **service requests**. "I applied for a ration card and it's stuck" → grievance (Spandana). "I want to apply for a ration card" → service request (Sachivalayam / AP Seva). And **RTI is not a grievance.** Our system must enforce this routing or it will drown in mis-filed requests.

## A.2 How a grievance flows today

```
Citizen has a problem
        │
        ▼
Registers via ONE of: ── Grama/Ward Sachivalayam (assisted, most common rurally)
                       ── 1902 Call Center (24×7)
                       ── Spandana mobile app
                       ── Spandana web portal
                       ── "Spandana Monday" — Collectorate grievance day (meet Collector/SP in person)
                       ── Praja Darbar (CMO), scheme camps, special call centers
                            (sand/excise, anti-corruption/bribe [confidential], agriculture/Rythu, etc.)
        │
        ▼
Unique  YSR#  generated  ──►  SMS acknowledgement to citizen
        │
        ▼
Categorised:  Department → Subject → Sub-subject   (33 depts · ~5,062 subjects · ~50,502 sub-subjects)
              Tagged as  FINANCE  or  NON-FINANCE
        │
        ▼
Auto-assigned DYNAMICALLY to the lowest competent officer for that subject + geographic location
        │
        ▼
Officer enquires → takes action → records remarks → marks redressed   (against an SLA clock)
        │
        ├── Auto SMS/email updates + auto-escalation if SLA at risk
        │
        ▼
Citizen reviews resolution
        │
        ├── Satisfied  → closed (feedback / 100% quality audit by call center)
        └── Not satisfied → REOPEN → re-assigned to a HIGHER authority
```

**Finance vs Non-finance is a real, load-bearing distinction:**
- **Finance** (ration, pension, housing, scholarships…): can be filed **once per family**, **tracked until the benefit is actually received**, reopenable.
- **Non-finance**: resolved by the last-mile functionary, **can be raised any number of times**, regular review.

**Escalation ladder (statutory spirit, ~90-day outer limit; ~24h for emergencies):**
- **L1** Local office / department — *Nodal Officer*
- **L2** District / department grievance cell — *Public Grievance Officer*
- **L3** State grievance authority — *Head of Department / Secretary*
- **L4** Chief Minister's grievance cell (CMO)

**Identity:** today the system leans on **Aadhaar-linked phone OTP (UIDAI eKYC)** for citizen login and to deduplicate petitioners.

## A.3 What works — and what we must *not* break

**Strengths to preserve:**
- One YSR#-style tracking ID across every channel.
- A genuinely good **subject taxonomy** (don't reinvent — reuse/refine it).
- **Geo + subject dynamic assignment** to the lowest competent officer.
- SLA + auto-escalation + reopen-to-higher-authority.
- **Assisted, last-mile intake** via Sachivalayam — this is what makes it work for poor, elderly, low-literacy, no-smartphone citizens.
- Confidential handling of **corruption/bribe** complaints.

## A.4 Gaps this redesign targets (the actual reason to build)

| # | Gap in today's system | Consequence | Praja Setu's answer |
|---|---|---|---|
| G1 | Inter-department resolution is manual ("forward the file") | Slow, lossy, no verified data hand-off | **X-Road** secure data exchange |
| G2 | Citizens can't *prove* their record wasn't altered/backdated/silently closed | Low trust, room for quiet manipulation | **Blockchain** tamper-evident audit trail |
| G3 | Intake assumes literacy + typing + correct categorisation | Exclusion; mis-routing; duplicate floods | **Bhashini voice/Telugu NLP + auto-classify + dedup** |
| G4 | Routing is rule-based; breaches noticed *after* the fact | Missed SLAs, no foresight | **ML routing + SLA-breach prediction** |
| G5 | Systemic problems (a failing scheme in a mandal) are invisible until they explode | Reactive governance | **Hotspot/anomaly detection + command dashboards** |
| G6 | "Closed" can mean "closed without resolving" | Gaming the metrics | **Citizen-confirmed closure + fraudulent-closure detection** |
| G7 | Status language is bureaucratic | Citizens don't understand state | **LLM plain-language status + conversational help** |

---

# PART B — Design philosophy (the rules everything obeys)

1. **Small-town-first, not metro-first.** The pilot must work in a place with patchy 3G, low-end Android phones, and many citizens who will *never* open an app. So: the **Sachivalayam assisted channel is the primary channel**, the app/web is secondary, and **IVR/SMS/WhatsApp** are first-class fallbacks.
2. **Telugu-first and voice-first.** Default language Telugu; English on toggle. A citizen must be able to **speak** a complaint and have it transcribed and structured.
3. **Make technology earn its place.** Blockchain, X-Road, LLMs are means, not trophies. Each is justified against a specific gap (Part A.4). Where a boring solution is better, we say so.
4. **Assisted + self-serve as equals.** Every capability works whether a Digital Assistant files it for a citizen or the citizen files it themselves — with consent and audit on the assisted path.
5. **Secure & private by design.** Aadhaar is tokenised/vaulted (never stored raw), PII is minimised and encrypted, corruption complaints are anonymised, and the whole thing is built to DPDP Act 2023.
6. **Graceful degradation.** Offline-capable intake, queued sync, SMS fallback. The system never fully "goes down" for a citizen standing at a secretariat counter.
7. **Don't break the law of the land.** Reuse the statutory escalation ladder, the 33-department taxonomy, the finance/non-finance rule, and the grievance-vs-service-request-vs-RTI boundary.
8. **Close the loop, every time.** Acknowledge → update → resolve → **citizen confirms** → feedback. No silent closures.

---

# PART C — System architecture

## C.1 The big picture (layered)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CHANNEL / PRESENTATION LAYER  (citizen never sees the complexity below)        │
│                                                                                │
│  Citizen PWA/Web   Citizen mobile   Sachivalayam     IVR / Missed-call  WhatsApp│
│  (Next.js)         (Flutter)        Operator console  1902 + voicebot   /SMS    │
│        │               │            (Digital Asst /        │              │     │
│        │               │             Volunteer app)        │              │     │
└────────┼───────────────┼──────────────────┼───────────────┼──────────────┼─────┘
         └───────────────┴──────────┬───────┴───────────────┴──────────────┘
                                     ▼
              ┌────────────────────────────────────────────────┐
              │  API GATEWAY  +  BFF  (auth, rate-limit, WAF)    │
              └───────────────────────┬────────────────────────┘
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CORE GRIEVANCE SERVICES  (NestJS microservices)                                │
│  Intake │ Classification │ Routing/Assignment │ Case Mgmt │ SLA Engine │        │
│  Escalation │ Notification │ Reopen │ Feedback/QA │ Consent & Identity broker    │
└───────┬───────────────┬───────────────┬───────────────┬───────────────┬───────┘
        ▼               ▼               ▼               ▼               ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐
│ AI/ML & LLM   │ │ DATA        │ │ TRUST /      │ │ IDENTITY   │ │ DATA LAYER  │
│ SERVICES      │ │ EXCHANGE    │ │ LEDGER       │ │ LAYER      │ │             │
│               │ │ (X-ROAD)    │ │ (Blockchain) │ │            │ │ PostgreSQL  │
│ • Bhashini    │ │             │ │              │ │ • Aadhaar  │ │ (ops DB)    │
│   ASR/NMT/TTS │ │ Security    │ │ Hyperledger  │ │   eKYC     │ │ Object store│
│ • Classifier  │ │ Server ↔    │ │ Fabric:      │ │   (UIDAI)  │ │ (MinIO/S3)  │
│ • Router model│ │ dept systems│ │ hash-anchor  │ │ • DigiLocker│ │ OpenSearch  │
│ • Dedup/embed │ │             │ │ each lifecycle│ │ • Officer  │ │ pgvector    │
│ • SLA predict │ │ Revenue·    │ │ event;       │ │   IAM      │ │ Warehouse   │
│ • LLM (RAG)   │ │ Civil Supp· │ │ off-chain    │ │  (Keycloak │ │ (analytics) │
│   draft-assist│ │ Pension·    │ │ data, on-    │ │   +MFA)    │ │             │
│               │ │ APSPDCL·    │ │ chain proof  │ │            │ │             │
│               │ │ CCTNS·Munic.│ │              │ │            │ │             │
└───────────────┘ └─────────────┘ └──────────────┘ └────────────┘ └─────────────┘
        ▲                                                                  ▲
        └──────────────────  OBSERVABILITY & SECURITY  ────────────────────┘
        Logging · Metrics (Prometheus/Grafana) · SIEM (Wazuh) · Immutable audit log · KMS/HSM
```

## C.2 Layer responsibilities

- **Channel layer** — every entry point produces the *same* internal grievance object. The Sachivalayam operator console is the **primary** UI for the pilot; the citizen app/web are secondary; IVR/WhatsApp/SMS are fallbacks that still create real grievances.
- **API gateway / BFF** — single front door: authentication, authorisation, rate limiting, request validation, WAF, and a Backend-For-Frontend that shapes data per channel (a 2G phone gets a lean payload).
- **Core grievance services** — the heart. Stateless microservices around a **case-management state machine** (Part E). Each does one job and is independently scalable (intake spikes on Spandana Monday; classification spikes with voice complaints).
- **AI/ML & LLM services** — *advisory* services the core calls. They **never** make final decisions; they suggest, draft, classify, and flag. Humans (officers/DAs) confirm.
- **Data exchange (X-Road)** — secure, signed, logged data exchange with other departments' systems.
- **Trust/ledger (blockchain)** — notarises lifecycle events so tampering is detectable.
- **Identity layer** — Aadhaar eKYC (citizens), Keycloak + MFA (officers/staff), DigiLocker (document pull), and a **consent broker** for the assisted path.
- **Data layer** — PostgreSQL is the source of truth; object store for documents; OpenSearch for full-text grievance search; pgvector for embeddings (dedup/RAG); a warehouse for analytics/dashboards.
- **Observability & security** — logs, metrics, SIEM, tamper-evident audit, secrets/key management. Cross-cutting.

## C.3 Why microservices (and why not over-do it for a pilot)

Use a **modular monolith or a small set of services** for the pilot (intake+case-mgmt+SLA can live together), and split out the spiky/independent concerns (AI/ML, notifications). Don't ship 30 microservices to one mandal. The architecture *allows* full decomposition at state scale; the pilot *doesn't require* it. (This honesty saves you months.)

---

# PART D — Where each advanced technology fits (and why it makes sense)

*(You explicitly asked that everything "make sense." For each, I give: **what it does**, **why it's the right tool**, **guardrails**, and **pilot scope** so you don't over-build.)*

## D.1 X-Road — the inter-department data exchange layer

**What it is.** X-Road (Estonia's open-source data-exchange layer, `x-tee`, maintained by NIIS) is a **centrally-governed but decentralised** integration backbone. Each participating organisation runs a **Security Server**; a central server manages trust (membership, certificates); every message between members is **mutually authenticated (mTLS), digitally signed, timestamped, and logged**. It replaces fragile point-to-point integrations with one standard, auditable bus.

**Why it's right for PGRS.** A grievance is rarely resolvable inside one department. "My pension stopped" needs the **Pension** system + **Civil Supplies** (for linkage) + **Revenue** (residence). Today that's "forward the file." With X-Road, the grievance service can **securely request the exact data point** it needs (e.g., "is pension X active for citizen-token Y?") from the owning department, with a signed, timestamped, logged exchange — no shared database, no department giving up control, and a permanent record of who accessed what.

**How it maps to AP.** Each department's existing system sits behind its own Security Server:

```
            ┌─────────────── X-Road Central Trust Services ───────────────┐
            │   (membership · certs · timestamping · monitoring)          │
            └───────────────────────────┬────────────────────────────────┘
   Praja Setu                            │
  Security Server  ───────  signed/logged messages  ───────  Dept Security Servers
        │                                                          │
        │                          ┌───────────────┬───────────────┼───────────────┐
        ▼                          ▼               ▼               ▼               ▼
  Grievance core            Revenue / Land   Civil Supplies   Pensions       APSPDCL (power)
                            records          (ration)                         CCTNS (police)
                                                                              Municipal / Water
```

**Guardrails.** X-Road carries *queries and verified facts*, not bulk PII dumps. Access is purpose-bound (a grievance must reference the data pull), consent-checked, and every exchange is logged on both ends. Citizen consent (DPDP) governs cross-department lookups.

**Pilot scope.** Stand up **two Security Servers** (Praja Setu + one department, e.g., Civil Supplies) and **one or two real data services** (e.g., "ration card status by token"). Add Pension + Power next. Don't try to onboard 33 departments in the pilot — prove the pattern with 1–2.

> **Real-world caveat:** In India, the analogous national plumbing is **API Setu / India Stack**. You can run X-Road *as* the state interoperability layer (several countries do), but it needs governance buy-in (who runs the central server, certificate policy, departmental MoUs). Architect for X-Road; be ready to bridge to API Setu where a department already exposes APIs there.

## D.2 Permissioned blockchain — tamper-evident audit, nothing more

**What it is.** A **permissioned** ledger (recommend **Hyperledger Fabric** — private, no cryptocurrency, known validators). Validating nodes are run by **separate authorities** (e.g., GAD/Planning, the IT department, and an oversight/Lokayukta-style body) so no single actor can rewrite history.

**Why it's right (and the *only* honest reason to use it here).** The trust problem in grievance systems is: *"Did the officer actually act, or was my complaint quietly closed/backdated and the database edited to hide it?"* A normal database admin can change a row and a timestamp. With a ledger, **every lifecycle event** (registered, classified, assigned, reassigned, action-taken, resolved, citizen-confirmed, reopened, escalated, SLA-breached) is written as an **append-only, cryptographically chained transaction**. Anyone can later verify the official database matches the ledger. **Mismatch = tampering, and it's provable.**

**Critical design rule — no PII on-chain.** The ledger stores a **hash + minimal metadata** (grievance ID, event type, actor role, timestamp, and a hash of the event payload). The actual data stays in PostgreSQL (so you can correct errors, comply with erasure/DPDP, and keep PII off an immutable store). The chain proves the off-chain record is unaltered; it does **not** become the record.

```
PostgreSQL event:  {grievance: G-1029, event: RESOLVED, by: officer-role-RDO,
                    at: 2026-06-28T10:14Z, note: "...", evidence: file#7}
        │  SHA-256 hash of canonical event
        ▼
Ledger tx:         {gid: G-1029, evt: RESOLVED, actorRole: RDO, ts: ..., hash: 9f3a...}
        │
        ▼
Citizen / auditor:  re-hash the DB event → compare to ledger → MATCH ✔  or  TAMPER ✘
```

**What it buys the citizen.** A "verify integrity" button on the tracking page: *"This grievance's history is verified and unaltered (last checked 2 min ago)."* That single feature is worth more for trust than any other flourish.

**Guardrails / honesty.** Blockchain does **not** make data *true* (garbage in, notarised garbage out), doesn't speed anything up, and adds ops cost. It is justified **only** as the integrity/notary layer. If the sponsor won't run independent nodes, a cheaper substitute is **append-only, hash-chained audit logs with periodic public anchoring** — say so openly rather than pretending a 1-node "blockchain" adds trust.

**Pilot scope.** 3 nodes (3 distinct authorities), notarise lifecycle events for the pilot's departments, expose the citizen "verify" feature and an auditor verification job.

## D.3 NLP — Telugu, voice, classification, dedup (powered by Bhashini)

Use **Bhashini** (Govt of India's National Language Translation Mission: ASR, NMT, TTS, OCR, language ID for 22 languages incl. **Telugu**, via ULCA/Open Bhashini APIs) as the language engine, plus your own light models for classification/dedup.

| NLP capability | What it does | Why it matters for a small town |
|---|---|---|
| **Telugu ASR (speech→text)** | Citizen *speaks* the complaint (at counter, on IVR, in app) → transcript | Removes literacy & typing barriers — the single biggest inclusion win |
| **NMT (Telugu↔English)** | Citizen writes/speaks Telugu; officers & analytics work in either language | Officers in different departments, statewide analytics |
| **TTS (text→speech)** | Reads status/next steps aloud in Telugu (IVR, app) | Works for non-readers |
| **OCR (IndicOCR)** | Extract text from uploaded documents/petition photos | Sachivalayam scans paper petitions |
| **Auto-classification** | Map free text → Department → Subject → Sub-subject (reuse the 5,062-subject taxonomy) | Stops mis-routing; suggests category, human confirms |
| **Duplicate / similarity detection** | Embed grievance text (pgvector) → flag near-duplicates & cluster | Cuts the Spandana-Monday duplicate flood; feeds hotspot detection |
| **Distress / urgency / safety detection** | Detect emergencies, women-safety, self-harm, threats | Auto-prioritise + emergency routing (the ~24h lane) |
| **PII redaction** | Strip names/IDs for public/transparency & analytics views | Privacy by default |

**Guardrails.** Auto-classification is a **suggestion** with a confidence score; the DA/officer can override (and overrides become training data). ASR transcripts are shown back to the citizen ("Did I get this right?") before submission. Distress detection routes to a human fast — it never auto-resolves.

**Pilot scope.** Telugu ASR + NMT + TTS via Bhashini; classification model trained on historical Spandana subjects; dedup via embeddings. OCR optional in pilot.

## D.4 AI/ML — routing, prediction, anomaly detection

| ML capability | What it does | Decision boundary |
|---|---|---|
| **Smart routing** | Predicts the right officer/desk by subject + geo + current load + past resolution patterns (improves today's rule-based dynamic assignment) | Suggests; supervisor can reassign |
| **Priority scoring** | Ranks by severity, complainant vulnerability, finance/non-finance, distress | Ordering only; never hides a grievance |
| **SLA-breach prediction** | Flags grievances *likely* to miss SLA *before* they do → proactive nudge/escalation | Triggers reminders/escalation, not closure |
| **Hotspot & anomaly detection** | Clusters by location/subject/time → "23 borewell complaints in Mandal X this week" or "Officer Y closes 90% in <5 min" | Surfaces to dashboards; humans investigate |
| **Officer/desk analytics** | Genuine resolution rate, reopen rate, time-to-act | Performance insight + gaming detection |

**Guardrails.** Models are **decision-support**, auditable, and monitored for bias (e.g., not deprioritising certain areas/groups). Routing/priority logic is explainable ("assigned to RDO because: subject=land, mandal=…, lowest competent officer"). Anomaly flags are **leads for humans**, not verdicts.

**Pilot scope.** Start with **rules + simple models** (routing rules you already need, a basic SLA-risk score from time-elapsed-vs-historical). Add learned routing and clustering once you have pilot data. Don't train fancy models on zero data.

## D.5 LLM — conversational filing, draft-assist, plain-language status

| LLM use | What it does | Hard guardrail |
|---|---|---|
| **Conversational filing assistant** (Telugu voice/text) | Citizen describes the problem naturally; the bot asks clarifying Qs, fills department/subject/location/finance-flag, and produces a clean structured grievance | Citizen reviews & confirms the final grievance; bot can't submit silently |
| **Officer draft-assist** | Drafts acknowledgements, enquiry notes, and resolution summaries for officers | **Human-in-the-loop**: officer edits & approves; LLM never auto-closes or decides |
| **Thread/attachment summarisation** | Summarises long histories & documents for officers and supervisors | Summary links to source; flagged as AI-generated |
| **Plain-language status explainer** | Turns "Endorsed to RDO, pending field enquiry" into "An officer is verifying your land record; expected by 5 July" | Read-only; derived from real state |
| **Eligibility / process Q&A (RAG)** | Answers "am I eligible / what's the process" grounded in scheme docs | **RAG only** over official docs; cites source; says "I'm not sure, here's the helpline" when unsure |

**Guardrails (non-negotiable).** The LLM is **assistive, never authoritative**. It (a) never makes or finalises a redressal decision, (b) never closes a grievance, (c) is **RAG-grounded** with citations to avoid hallucinated entitlements, (d) clearly labels AI-generated text, and (e) always offers a human/helpline fallback. For data residency, prefer an LLM that can run in a sovereign/government-cloud setting; if using a hosted API in the pilot, **never** send raw Aadhaar/PII to it (send tokenised/redacted context).

**Pilot scope.** Start with the **status explainer** and **officer draft-assist** (lowest risk, highest daily value). Add the conversational filing assistant once ASR + classification are stable.

---

# PART E — Data model & grievance lifecycle

## E.1 Core entities (PostgreSQL, simplified)

```
Citizen/Petitioner   id, aadhaar_token (vaulted ref — NEVER raw), name, mobile, address,
                     mandal, secretariat_code, language_pref, vulnerability_flags[], created_at
Grievance            id (public = YSR-style code), petitioner_id, channel, language,
                     dept_id, subject_id, sub_subject_id, category(FINANCE|NON_FINANCE),
                     description, ai_suggested_category, ai_confidence,
                     priority_score, distress_flag, geo(lat,lng), mandal, secretariat_code,
                     status (see state machine), current_assignee_id, current_level(L1..L4),
                     sla_due_at, sla_breach_predicted(bool), is_duplicate_of,
                     created_at, resolved_at, closed_at
Department           id, name_en, name_te, parent, sla_matrix
Subject/SubSubject   id, dept_id, name_en, name_te, default_sla, category_hint
Officer/Desk         id, name, role, dept_id, jurisdiction(geo scope), iam_subject, active
Assignment           id, grievance_id, assignee_id, level, assigned_by(SYSTEM|officer),
                     reason(explainable routing), assigned_at, accepted_at
WorkLog/Action       id, grievance_id, actor_id, action_type, note_te, note_en,
                     ai_drafted(bool), evidence_ids[], created_at
Attachment/Evidence  id, grievance_id, type, object_store_key, ocr_text, uploaded_by, hash
SLA / Escalation     id, grievance_id, level, due_at, breached_at, escalated_to, trigger
Reopen               id, grievance_id, reason_te, reopened_at, escalated_level
Feedback/QA          id, grievance_id, rating, comment, qa_audited_by, channel
ConsentRecord        id, petitioner_id, purpose, scope(dept data pulls), granted_by(self|DA),
                     da_id, granted_at, expires_at, revoked_at         ← powers assisted path + X-Road
AuditEvent           id, grievance_id, event_type, actor_role, payload_hash, ledger_tx_id, ts
                                                                       ← mirrored to blockchain
```

**Design notes that close gaps:**
- **`aadhaar_token`, never raw Aadhaar.** Store a vault reference (UIDAI Aadhaar Data Vault pattern); raw number never lands in your DB.
- **`ConsentRecord`** is what makes the **assisted path lawful** (a Digital Assistant filing for a citizen) *and* gates **X-Road** cross-department lookups. No consent → no cross-department pull.
- **`AuditEvent.payload_hash` + `ledger_tx_id`** is the bridge to the blockchain notary.
- **`ai_suggested_category` + `ai_confidence`** keep AI as a suggestion with a confirmed human decision recorded separately.
- **`is_duplicate_of`** + embeddings table (pgvector) power dedup and hotspot clustering.

## E.2 Lifecycle state machine

```
                 ┌─────────┐
                 │  DRAFT  │  (in-progress intake; voice/chat being structured)
                 └────┬────┘
                      │ submit (+ validation: grievance? not RTI/service-req?)
                      ▼
                ┌───────────┐  YSR# issued + SMS ack + AuditEvent→ledger
                │ REGISTERED│
                └────┬──────┘
                     │ NLP auto-classify (human-confirmed)
                     ▼
                ┌────────────┐   wrong type? ──► REROUTED  (to Sachivalayam service-req / RTI desk)
                │ CLASSIFIED │   duplicate?  ──► MERGED     (linked to parent)
                └────┬───────┘
                     │ ML routing → lowest competent officer + geo
                     ▼
                ┌──────────┐  SLA clock starts
                │ ASSIGNED │ ◄───────────────┐ reassign (supervisor / state officer)
                └────┬─────┘                 │
                     │ officer accepts       │
                     ▼                       │
              ┌───────────────┐              │
              │ UNDER_ENQUIRY │──────────────┘
              │ /IN_PROGRESS  │
              └────┬──────────┘
                   │ action taken (+ evidence)            ── SLA at risk? → ML predicts → NUDGE
                   ▼                                      ── SLA missed?  → AUTO-ESCALATE (L→L+1)
            ┌──────────────┐                                 (event → ledger each time)
            │ ACTION_TAKEN │
            └────┬─────────┘
                 │ mark redressed
                 ▼
            ┌──────────┐  citizen notified (plain-language, Telugu)
            │ RESOLVED │  ⏳ awaiting citizen confirmation
            └────┬─────┘
        satisfied│        not satisfied / no benefit (FINANCE)
                 ▼                          │
            ┌────────┐                      ▼
            │ CLOSED │              ┌──────────────┐ → re-assign to HIGHER authority
            └────────┘              │   REOPENED   │   (auto-bump level), back to ASSIGNED
              feedback +            └──────────────┘
              QA audit

  Cross-cutting states:  ON_HOLD (awaiting citizen info / external dept via X-Road),
                         INVALID/REJECTED (with reason, appealable),
                         EMERGENCY lane (distress_flag → ~24h SLA, senior officer)
```

**Anti-gaming rules baked into transitions:**
- **No silent closure.** `RESOLVED → CLOSED` requires **citizen confirmation**, OR (if citizen unreachable) a defined waiting period **plus** mandatory evidence **plus** a supervisor sign-off — and the whole thing is notarised.
- **Finance grievances** can't be `CLOSED` until benefit delivery is confirmed (matches the real "tracked till benefitted" rule).
- **Reopen always escalates** to a higher level (matches real behaviour) and is unlimited for non-finance.
- Every state change writes an **AuditEvent → ledger**, so "closed in 2 minutes with no enquiry" is visible *and* provable.

---

# PART F — Dashboards & UX design

> Goal: **user-friendly for everyone from a non-literate citizen to the Collector.** One design system, six role-tuned surfaces. Telugu-first, high-contrast, large touch targets, works on cheap phones and on a desk browser.

## F.1 Design system (the shared visual language)

- **Language:** Telugu default, English toggle (persists). All labels bilingual where space allows.
- **Type:** a high-legibility Telugu+Latin pairing (e.g., *Noto Sans Telugu* + *Inter*); large base size (16–18px), generous line height.
- **Colour & status semantics (consistent everywhere):**
  - `Registered/New` — slate/blue · `In progress` — amber · `Resolved` — green · `Closed` — neutral grey · `Reopened/Escalated` — purple · `SLA breached / Emergency` — red · `Verified by ledger` — a distinct teal "shield" accent.
  - Never rely on colour alone — pair with icon + text (accessibility).
- **Touch & accessibility:** ≥44px targets, WCAG AA contrast, screen-reader labels, full keyboard nav, "read aloud" (TTS) on citizen screens, offline indicator.
- **Tone:** plain language, no bureaucratese on citizen-facing surfaces (LLM-assisted).
- **Components:** status timeline, SLA countdown ring, evidence gallery, map/heatmap, "verify integrity" shield, voice-input button, bilingual form fields with inline validation.

> *Design intent (not a template):* the citizen surface should feel calm and reassuring (a worried person is using it), the officer surface dense and efficient (a busy person is using it), the command surface analytical and glanceable (a decision-maker is scanning it). Same tokens, different density.

## F.2 The six surfaces

### 1) Citizen tracking view (PWA / app / sent as a link in SMS)
The most important screen for trust.

```
┌──────────────────────────────────────────────┐
│  మీ ఫిర్యాదు  ·  YSR-AP-2026-001029        🔊 │   ← read aloud (Telugu TTS)
│  Ration card stopped — Civil Supplies          │
├──────────────────────────────────────────────┤
│  Status:  ● IN PROGRESS                         │
│  "An officer is verifying your ration record.   │   ← plain-language (LLM), not jargon
│   Expected update by 5 July."                    │
│                                                  │
│  Timeline                                        │
│  ✔ 28 Jun  Registered (SMS sent)                │
│  ✔ 28 Jun  Assigned to Tahsildar, <Mandal>      │
│  ● 30 Jun  Field enquiry in progress            │
│  ○ —       Resolution                           │
│  ○ —       Your confirmation                    │
│                                                  │
│  ⏳ SLA: 4 days left            [ Add info ]    │
│  🛡 Integrity: VERIFIED & unaltered (2 min ago) │   ← blockchain verify, one tap
│                                                  │
│  [ Call 1902 ]   [ Talk to assistant 🎙 ]       │
└──────────────────────────────────────────────┘
```
Key behaviours: track by YSR# or mobile OTP; plain-language status; **integrity shield** (the blockchain payoff); add evidence; reopen if resolved-but-unsatisfied; rate + feedback; everything works in Telugu with read-aloud; degrades to an SMS status reply.

### 2) Sachivalayam operator console (Digital Assistant / Volunteer) — *the primary pilot UI*
Optimised for **filing on behalf of a citizen** at a counter or doorstep (Volunteer tablet).

```
┌─ New grievance (assisted) ───────────────────────────────────────┐
│ 1 Citizen   [Aadhaar eKYC OTP ▸]  or  [No Aadhaar — manual ▸]      │
│   Consent: ☑ Citizen consents to filing + dept verification (logged)│
│ 2 Describe  🎙 [ Speak in Telugu ]  ──►  transcript shown back      │
│   "మా ఊరి బోరు పని చేయట్లేదు..."   [ Looks right? ✔ / edit ]        │
│ 3 AI suggests: Dept=Rural Water  Subject=Borewell repair (92%)     │
│              Category: NON-FINANCE     [ Confirm / change ]         │
│ 4 Location auto from secretariat; attach photo 📷 (OCR if paper)   │
│ 5 [ Submit ]  → YSR# + printed slip with QR + SMS to citizen       │
└───────────────────────────────────────────────────────────────────┘
Side panel: today's queue · pending citizen confirmations · offline items to sync
```
Key behaviours: voice-first; AI pre-fills, human confirms; **consent captured & logged**; **offline-first** (queue + sync); prints a QR acknowledgement slip; one operator can serve walk-ins fast.

### 3) Redressal officer workbench
For the officer who actually resolves.

```
┌─ My grievances ──────────────────────────────────────────────────┐
│ Filters: SLA-risk ▾  Dept ▾  Priority ▾        🔎 search           │
│──────────────────────────────────────────────────────────────────│
│ ⏳2d  G-1029  Borewell repair    <Village>   ● enquiry   [open]   │
│ 🔴OVERDUE G-0988 Pension stopped  <Ward 4>   ● assigned  [open]   │  ← red = breached
│ ⚠pred  G-1102  Land mutation     <Village>   ● assigned  [open]   │  ← ML: likely to breach
│──────────────────────────────────────────────────────────────────│
│ OPEN G-1029                                                        │
│  Summary (AI): "Borewell in <hamlet> non-functional 6 days;        │
│   ~40 households affected." [source ▾]                             │
│  X-Road lookup: water-scheme status = ACTIVE ✔ (signed, logged)    │
│  Actions: [ Draft update ✍AI ] [ Record action ] [ Attach proof ] │
│           [ Resolve ] [ Reassign ▸ ] [ Put on hold ]              │
└───────────────────────────────────────────────────────────────────┘
```
Key behaviours: SLA ring + **predicted breach** flag; AI summary with source; **X-Road verified facts inline**; AI-drafted updates the officer edits & approves; resolving triggers citizen confirmation; every action notarised.

### 4) Supervisor / Mandal-District grievance cell
SLA compliance + escalations + reassignment + officer load.

```
┌─ Mandal: <name> ─────────────────────────────────────────────────┐
│ Open 412 │ Overdue 23 🔴 │ Reopened 14 │ Avg resolve 6.2d │ Sat 78%│
│ SLA compliance ███████░░ 81%        Escalations pending: 9 ▸       │
│ By dept:  Civil Supplies ██ 31 │ Revenue ██ 28 │ Water █ 19 ...    │
│ Officer load/health:  RDO 47(2 overdue) · Tahsildar 39 · ...       │
│ ⚠ Anomaly: Officer #214 closes 88% in <5 min — review ▸           │
└───────────────────────────────────────────────────────────────────┘
```

### 5) Collector / State command centre ("Real-Time Governance")
Glanceable, map-first, predictive — the strategic view.

```
┌─ District live ──────────────────────────────────────────────────┐
│ [HEATMAP of grievances by mandal — colour = density/severity]     │
│ 🔥 Hotspot: 23 borewell complaints, <Mandal X>, this week ▸       │
│ Trend ▲ Pensions +18% w/w   ▼ Ration −9%                          │
│ SLA at-risk (next 48h, predicted): 64 grievances ▸               │
│ Top systemic issues (clustered): water(41) · land mutation(33)    │
│ Spandana-Monday readiness: 388 due for review ▸                   │
└───────────────────────────────────────────────────────────────────┘
```
This is where **hotspot/anomaly detection** turns thousands of individual complaints into *one* actionable insight ("fix the scheme in Mandal X"), shifting governance from reactive to proactive.

### 6) Audit & anti-corruption console (restricted)
- **Ledger verification:** run integrity checks across grievances; list any DB-vs-ledger mismatches (tamper alerts).
- **Confidential corruption queue:** bribe/corruption complaints with **complainant identity masked** (matches real Spandana confidentiality), separate access role, extra logging.
- **Fraudulent-closure review:** ML-flagged suspicious closures (instant closes, no evidence, high reopen rates).
- **Access transparency:** who pulled which citizen's cross-department data over X-Road, and why.

## F.3 UX rules that keep it usable for everyone
- **3-tap rule** for citizens to check status; **voice as a peer to typing**, not an afterthought.
- **Assisted = first-class.** Nothing requires the citizen to own a smartphone.
- **Progressive disclosure:** citizens see simple; officers see dense; nobody sees the plumbing.
- **Always a human exit:** "Call 1902 / talk to assistant" on every citizen screen.
- **Offline honesty:** clear "saved, will sync" states at the secretariat.

---

# PART G — Security, privacy & anti-corruption ("no loopholes")

> No system is "unhackable" — claiming that would be dishonest. The realistic goal is **defence-in-depth**: every layer hardened, least privilege everywhere, everything logged and tamper-evident, and a clear threat model with a mitigation for each risk. Below is that model.

## G.1 Identity & access

- **Citizens:** Aadhaar eKYC OTP (UIDAI) **or** mobile-OTP fallback so non-Aadhaar citizens aren't excluded. **Raw Aadhaar is never stored** — only a vault reference (Aadhaar Data Vault pattern); requires being a registered **AUA/KUA** (a deployment prerequisite, flagged honestly).
- **Officers/staff:** centralised IAM (**Keycloak**, OIDC) with **mandatory MFA**, SSO, session timeouts, device/location anomaly checks.
- **Authorization:** **RBAC + ABAC** — role *and* attributes (jurisdiction/geo, department). An officer sees only grievances in their scope. **Least privilege** by default.
- **Maker-checker** for sensitive actions (force-close, bulk reassign, data exports, role grants).
- **Assisted path:** a Digital Assistant acting for a citizen requires a **logged ConsentRecord**; the action is attributed to *both* the citizen and the DA. No "anonymous filing on behalf of."

## G.2 Data protection (DPDP Act 2023-aligned)

- **In transit:** TLS 1.3 everywhere; mTLS between services and over X-Road.
- **At rest:** disk encryption + **field-level encryption** for PII (Aadhaar token, mobile, name, address). Keys in **KMS/HSM**, rotated.
- **Data minimisation:** collect only what a grievance needs; **purpose-bound** cross-department lookups (consent-gated, logged).
- **Aadhaar handling:** mask in UI (XXXX-XXXX-1234), vault the rest, never log it, never send it to the LLM.
- **Retention & erasure:** defined retention; DPDP erasure honoured in the operational DB (the **blockchain holds only hashes**, so erasure stays possible — a key reason for no-PII-on-chain).
- **Consent management:** explicit, revocable, auditable; the **access-transparency view** lets oversight see every cross-department pull.

## G.3 Confidentiality for corruption complaints
Bribe/corruption complaints: complainant identity **masked from the handling officer**, separate restricted role, extra logging, no disclosure — matching the existing Spandana confidentiality guarantee. Optional **anonymous** mode (track by code, no identity).

## G.4 Integrity & anti-tampering
- Every lifecycle event → **hash-chained AuditEvent → Hyperledger ledger** (Part D.2).
- **Append-only audit logs** in addition to the ledger.
- Scheduled **DB-vs-ledger verification job**; mismatches raise tamper alerts to the audit console.
- Citizen-facing **"verify integrity"** so trust isn't "take our word for it."

## G.5 Application & API security (OWASP-driven)
- Input validation + output encoding (**XSS**), parameterised queries / ORM (**SQLi**), CSRF tokens, strict CORS.
- **SSRF** protection on URL/file fetches; **file uploads** type-checked, size-limited, AV-scanned, stored in isolated object store, served via signed URLs.
- **Rate limiting + bot/abuse protection** at the gateway; CAPTCHA only where it doesn't exclude (prefer device/risk signals; assisted channel exempt).
- **API auth:** OAuth2/OIDC for apps, **mTLS** for service-to-service and X-Road; API gateway with throttling and schema validation.
- **Secrets** in a vault (never in code/repo); signed, scanned dependencies (SCA); SBOM.
- **WAF** in front of public surfaces.

## G.6 Abuse / gaming prevention (governance integrity)
- **No silent closure** (citizen confirmation or evidence+waiting+supervisor sign-off).
- **Fraudulent-closure detection** (instant closes, no evidence, high reopen rate) → audit console.
- **Duplicate/spam control** via dedup + rate limits (without blocking genuine repeat non-finance grievances).
- **Reopen-to-higher-authority** prevents an officer from being judge of their own dismissal.

## G.7 Infrastructure & operations
- **Data residency:** host on **government cloud (MeghRaj/GI Cloud) or the State Data Centre** — citizen data stays in-country/in-state.
- Network segmentation (public / app / data / ledger zones); private subnets for data & ledger; bastion + just-in-time admin access.
- **Backups** (encrypted, tested restores) + **DR** (defined RPO/RTO); the ledger gives an independent integrity reference after any restore.
- **Observability/SIEM:** centralised logs, metrics, alerts; **Wazuh** (or equivalent) SIEM; anomaly alerting on admin actions.
- **VAPT** (pen-test) before pilot go-live and before each scale-up; responsible-disclosure / bug-bounty channel; periodic security audit (CERT-In empanelled auditor for a real govt deployment).

## G.8 Threat model (threat → mitigation)

| # | Threat | Mitigation |
|---|---|---|
| T1 | Insider edits/backdates a grievance to hide inaction | Blockchain notary + DB-vs-ledger verification + append-only logs |
| T2 | Officer "closes" without resolving | Citizen-confirmed closure + fraudulent-closure ML + reopen-to-higher |
| T3 | Aadhaar/PII leak | Vault (no raw Aadhaar), field-level encryption, masking, no-PII-on-chain, no PII to LLM |
| T4 | Unauthorised cross-department data access | X-Road mTLS + signed/logged exchange + consent-gating + access-transparency view |
| T5 | Account takeover (citizen/officer) | MFA (officers), OTP, anomaly detection, session controls |
| T6 | SQLi / XSS / CSRF / SSRF | ORM + validation + encoding + CSRF tokens + SSRF guards + WAF |
| T7 | Malicious file upload | Type/size checks, AV scan, isolated store, signed URLs |
| T8 | DoS / spam / bot floods | Gateway rate-limits, abuse detection, autoscaling, dedup |
| T9 | LLM hallucinates an entitlement / leaks data | RAG-grounded + cited + AI-labelled + human-in-loop + redacted context, never decides/closes |
| T10 | Corruption complainant exposed → retaliation | Identity masking, restricted role, anonymous mode, extra logging |
| T11 | Data loss / ransomware | Encrypted tested backups, DR, segmentation, least-privilege, immutable audit |
| T12 | Supply-chain (dependency) compromise | SCA, SBOM, signed deps, pinned versions, scanning in CI |
| T13 | Model bias deprioritises certain areas/groups | Explainable routing, bias monitoring, human override, audit of priority logic |
| T14 | Exclusion of the vulnerable (de facto "loophole" against citizens) | Assisted channel, voice/Telugu, IVR/SMS, no-Aadhaar fallback, offline mode |

---

# PART H — Small-town pilot plan

> You said it'll be tested in a small town — so the pilot is designed for **one mandal/town**, not the state. Prove value and safety small, then scale.

## H.1 Scope (deliberately narrow)
- **Geography:** 1 mandal / small town (a manageable cluster of Grama/Ward Secretariats).
- **Departments:** the **top 4–5 by grievance volume** — typically **Civil Supplies (ration), Pensions, Energy (APSPDCL), Rural Water/Municipal, Revenue (land)**.
- **Channels (in priority order):**
  1. **Sachivalayam operator console** (primary — DA/Volunteer assisted).
  2. **IVR / 1902-style voicebot** + **SMS status**.
  3. **Citizen PWA** (Telugu, voice) + **WhatsApp** intake.
  4. (Spandana-Monday review supported via supervisor dashboard.)
- **Advanced tech, pilot-sized:**
  - **X-Road:** 2 Security Servers (Praja Setu + Civil Supplies) + 1–2 real data services.
  - **Blockchain:** 3 nodes (3 authorities) notarising lifecycle events + citizen verify.
  - **Bhashini:** Telugu ASR + NMT + TTS.
  - **AI/ML:** rules + simple SLA-risk score + dedup; learned routing **after** data accrues.
  - **LLM:** status explainer + officer draft-assist first; conversational filing once ASR/classify stable.

## H.2 What to build first (MVP cut)
1. Multi-channel **intake → YSR# → SMS ack** (assisted console + voice).
2. **Classification (human-confirmed)** + geo dynamic assignment.
3. **Case management + SLA + escalation + reopen** state machine.
4. **Citizen tracking** (Telugu, plain-language status, integrity shield).
5. **Officer workbench** + supervisor dashboard.
6. **Blockchain notary** + **one X-Road lookup** + **Bhashini voice**.
7. Audit/anti-corruption basics + full security baseline (Part G).

## H.3 Training & change management (make-or-break in a small town)
- Train **Digital Assistants & Volunteers** (they are the real UI) — short, Telugu, hands-on.
- A 1-page **QR poster** at the secretariat: "Speak your complaint, get an SMS, track it."
- Officer onboarding on the workbench + the "no silent closure" rule.
- A feedback loop for the *system itself* (a meta-grievance channel).

## H.4 Success metrics (decide go/no-go on data)
- **Adoption:** % grievances via the new system; assisted vs self-serve mix.
- **Inclusion:** % voice/Telugu; % filed for citizens without smartphones.
- **Quality:** classification accuracy (human-override rate), duplicate rate.
- **Performance:** % within SLA, avg time-to-resolve, reopen rate.
- **Trust:** citizen satisfaction, # integrity verifications run, tamper alerts (should be ~0).
- **Integrity:** fraudulent-closure flags, % closures citizen-confirmed.
- **Ops:** uptime, sync success at secretariat, p95 latency on a low-end device.

## H.5 Rollback / safety
The legacy Spandana path stays available throughout the pilot. If the pilot fails a safety/quality gate, citizens lose nothing — fall back to existing channels. **Never** make the pilot the *only* way to be heard.

---

# PART I — Technology stack (concrete, buildable, scalable)

*(Chosen to be production-credible **and** realistic for a small team to actually build — and deliberately aligned with a Node/NestJS · Prisma/PostgreSQL · Next.js · Flutter skill set.)*

| Layer | Pilot choice | Why / scale path |
|---|---|---|
| Citizen web/PWA | **Next.js 15** (PWA, offline cache) | SSR + offline; lean payloads for 2G |
| Citizen & field mobile | **Flutter** (citizen app + Volunteer/DA app) | One codebase, offline-first, low-end Android |
| Backend services | **NestJS (TypeScript)** — modular monolith → microservices | Start consolidated; split intake/AI/notify under load |
| ORM / DB | **Prisma + PostgreSQL** | Source of truth; mature, scalable (Neon/Patroni HA later) |
| Search | **OpenSearch / Elasticsearch** | Full-text grievance search |
| Vector / embeddings | **pgvector** (in Postgres) → Qdrant at scale | Dedup + RAG; keep it simple in pilot |
| Object storage | **MinIO** (S3-compatible) | Evidence/docs; signed URLs |
| Messaging/events | **RabbitMQ** (pilot) → **Kafka** (state scale) | Decouple intake spikes (Spandana Monday) |
| Cache | **Redis** | Sessions, queues, rate-limit counters |
| Identity (officers) | **Keycloak** (OIDC + MFA) | Standard, self-hostable |
| Identity (citizens) | **Aadhaar eKYC (UIDAI)** + mobile-OTP fallback | Statutory pattern; AUA/KUA prerequisite |
| Documents | **DigiLocker** integration | Verified doc pull |
| Language AI | **Bhashini** (ASR/NMT/TTS/OCR, Telugu) | Govt-of-India national stack; free PoC tier |
| ML services | **Python (FastAPI)** for models | Routing/SLA-risk/anomaly; serve via API |
| LLM | API-based w/ **RAG**, redacted context → sovereign/self-host option | Draft-assist + status; data-residency-aware |
| Data exchange | **X-Road** Security Servers | Estonia's open-source interoperability layer |
| Ledger | **Hyperledger Fabric** | Permissioned, no crypto, multi-authority nodes |
| Gateway/WAF | **Kong/APISIX** + WAF | Auth, throttle, schema validation |
| Containers/orchestration | **Docker** (pilot) → **Kubernetes** | Scale-out at district/state |
| Hosting | **Govt cloud (MeghRaj/GI Cloud) / State Data Centre** | Data residency |
| Observability | **Prometheus + Grafana**, **ELK**, **Sentry** | Metrics/logs/errors |
| Security ops | **Wazuh** (SIEM), **Vault** (secrets), KMS/HSM | Detection + secrets + keys |
| CI/CD | Git + pipelines w/ **SCA/SAST/secret-scan** | Secure delivery |

---

# PART J — Scalability path (pilot → district → state)

```
PHASE 1 — PILOT (1 mandal/town)        PHASE 2 — DISTRICT             PHASE 3 — STATE
• modular monolith                      • split microservices          • full microservices on K8s
• RabbitMQ, pgvector, MinIO             • Kafka, Postgres HA            • multi-region, Qdrant
• 3 ledger nodes, 2 X-Road servers      • more depts on X-Road         • all 33 depts on X-Road
• rules + simple ML                     • learned routing/clustering    • mature ML + LLM at scale
• Bhashini voice (Telugu)               • + OCR, conversational filing  • cross-district analytics
• prove value + safety                  • harden + tune SLAs           • Real-Time Governance statewide
```

**Scaling principles:** stateless services + horizontal scale; event-driven decoupling (Kafka) for intake spikes; read replicas + partitioning by district; cache hot reads; async AI (never block intake on a model); **onboard departments to X-Road incrementally**; add ledger nodes as oversight bodies join. Architecture supports the AP-wide ~15,000-secretariat footprint **without** a rewrite — but each phase ships only what that phase needs.

---

# PART K — Gaps closed, honest limitations, and what you'd actually need

## K.1 Gaps from Part A.4 — and how they're closed
- **G1 inter-dept** → X-Road signed/logged data exchange.
- **G2 tamper-proof** → blockchain notary + citizen verify.
- **G3 inclusion/intake** → Bhashini voice/Telugu + auto-classify + assisted console + offline.
- **G4 reactive SLAs** → ML breach prediction + proactive escalation.
- **G5 invisible systemic issues** → hotspot/anomaly detection + command dashboard.
- **G6 silent closures** → citizen-confirmed closure + fraudulent-closure detection.
- **G7 jargon** → LLM plain-language status + conversational help.

## K.2 Honest limitations & trade-offs (no hand-waving)
- **Blockchain is a notary, not a miracle.** It proves records weren't altered; it doesn't make them *true*, doesn't speed resolution, and costs ops effort. Justified *only* as the integrity layer. If independent nodes aren't politically feasible, downgrade to hash-chained audit logs with periodic anchoring and **say so**.
- **LLMs can be wrong.** Hence RAG-grounding, citations, AI labelling, human-in-loop, and a hard rule: the LLM never decides or closes.
- **Aadhaar mandatory = exclusion.** So Aadhaar is *preferred, not required*; mobile-OTP + assisted filing keep everyone in.
- **X-Road needs governance, not just code.** Central server ownership, certificate policy, departmental MoUs, and legal basis for each data exchange are organisational work — start them early; they're slower than the engineering.
- **AI on day one is weak** (no data). Ship rules first; let models learn from real pilot data.
- **Connectivity is real.** Offline-first, SMS/IVR fallback, lean payloads — assume the network *will* drop.
- **This is a design.** Real deployment needs the approvals in K.3.

## K.3 What you'd actually need to deploy for real
1. **Sponsorship** from the district administration / GAD / IT, E&C dept.
2. **AUA/KUA registration** (or routing Aadhaar via an authorised partner) for eKYC.
3. **Bhashini** onboarding (PoC tier → production/paid for scale).
4. **X-Road governance** (central server operator, certs, MoUs) + departmental API/data agreements.
5. **Independent ledger-node hosts** (e.g., GAD + IT dept + an oversight body).
6. **Govt-cloud/State Data Centre** hosting for data residency.
7. **CERT-In-empanelled VAPT** + DPDP compliance sign-off before go-live.
8. **Sachivalayam training** + change-management plan.
9. **Legacy fallback** kept live throughout the pilot.

---

# Appendix

## A. Illustrative intake API (citizen / assisted)
```
POST /api/v1/grievances
Authorization: Bearer <token>   # citizen OTP token OR DA token + consent ref
{
  "channel": "SACHIVALAYAM_ASSISTED",
  "language": "te",
  "voiceInputRef": "blob://intake/abc123.wav",   # optional; transcribed via Bhashini ASR
  "description": "మా ఊరి బోరు పని చేయట్లేదు...",
  "petitioner": { "aadhaarTokenRef": "vault://...", "mobile": "9XXXXXXX12" },
  "consentRef": "consent://2026/...",            # required on assisted path
  "geo": { "lat": 14.43, "lng": 79.98, "secretariatCode": "AP-XXX-021" },
  "attachments": ["object://uploads/photo1.jpg"]
}
→ 201 {
  "ysr": "YSR-AP-2026-001029",
  "aiSuggested": { "deptId": "RWS", "subjectId": "BOREWELL_REPAIR", "confidence": 0.92,
                   "category": "NON_FINANCE" },     # human confirms before final assignment
  "status": "REGISTERED",
  "ledgerTxId": "fabric://...",                      # notarised
  "smsSent": true
}
```

## B. Auto-classification flow
```
text/voice → [Bhashini ASR if voice] → [language detect/translate]
          → [embed → pgvector dedup check] → duplicate? link & stop
          → [classifier → Dept/Subject/Sub-subject + confidence]
          → [distress/urgency detector] → emergency? fast-lane
          → present suggestion to DA/officer → HUMAN CONFIRMS → assign
```

## C. Glossary
- **Spandana / CMGRS** — AP's existing grievance platform.
- **YSR#** — the unique grievance tracking number citizens receive.
- **GSWS / Sachivalayam** — Grama/Ward Secretariat; AP's last-mile service unit.
- **Digital Assistant (DA) / Volunteer** — staff who file/serve on citizens' behalf.
- **Finance / Non-finance** — benefit-linked (once per family, tracked till delivered) vs general grievances.
- **SLA** — statutory time limit to resolve (AP Public Services Delivery Guarantee Act, 2017).
- **X-Road** — Estonia's open-source secure data-exchange layer.
- **Hyperledger Fabric** — permissioned (non-crypto) blockchain.
- **Bhashini** — Govt of India's language-AI stack (ASR/NMT/TTS/OCR, incl. Telugu).
- **DPDP Act 2023** — India's Digital Personal Data Protection Act.
- **VAPT** — Vulnerability Assessment & Penetration Testing.

---

*End of blueprint. Built to be honest about what's real today, what each technology genuinely adds, and what it takes to ship safely in a small town first.*
