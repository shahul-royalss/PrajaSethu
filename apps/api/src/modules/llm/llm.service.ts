import { Injectable } from '@nestjs/common';
import { Severity, Status, Urgency } from '../../common/constants';
import { detectLanguage, langName } from '../../common/lang';
import { aiEnabled, callClaude, extractJson } from './anthropic.client';
import { DEPARTMENT_KB, departmentBriefing, matchDepartment } from './ai-knowledge';
import { XROAD_SERVICE_META } from '../dataexchange/dataexchange.service';

export interface AiAnalysis {
  summary: string;
  department: string;
  deptId: string | null;
  category: 'FINANCE' | 'NON_FINANCE';
  priority: number; // 0..100
  rootCauses: { cause: string; likelihood: 'high' | 'medium' | 'low' }[];
  suggestedActions: string[];
  relevantOrders: string[];
  slaHint: string;
  confidence: number; // 0..1
  source: 'claude' | 'heuristic';
  // Saarthi 2.0 — officer decision support
  officerBriefing: string[]; // what to check / ask / verify, grounded in this complaint
  xroadSuggestions: { service: string; label: string; member: string; why: string }[];
  interDepartments: { deptId: string; name: string; why: string }[];
}

/** LLM extraction contract (Saarthi 2.0 §7.1) — one structured call. */
export interface Extraction {
  issue: string;
  issueCategory: string;
  summaryEn: string;
  summaryTe: string;
  severity: keyof typeof Severity;
  urgency: keyof typeof Urgency;
  safetyFlag: boolean;
  sentiment: string;
  entities: Record<string, string>;
  departmentHint: string | null; // Stage A of the two-stage classifier
  language: { detected: string; confidence: number; codeSwitched: boolean };
  source: 'claude' | 'heuristic';
}

/** Quick-desk-review analysis of a citizen's reopen request (Saarthi 2.0). */
export interface ReopenReview {
  reasonSummary: string;
  reasonCategory: 'NOT_RESOLVED' | 'PARTIALLY_RESOLVED' | 'RECURRED' | 'WRONG_CLOSURE' | 'NEW_ISSUE' | 'UNCLEAR';
  recommendation: 'REOPEN' | 'FIELD_VERIFY' | 'UPHOLD';
  rationale: string;
  profileSignals: string[];
  confidence: number;
  source: 'claude' | 'heuristic';
}

export interface CitizenProfile {
  totalComplaints: number;
  resolvedOrClosed: number;
  reopens: number;
  avgRating: number | null;
  vulnerabilityFlags: string[];
  memberSinceDays: number;
}

/**
 * LLM assist (Blueprint D.5 + Saarthi 2.0 §7/§11).
 * READ-ONLY and grounded by construction: the AI analyses, extracts, explains
 * and suggests — an officer always decides. Claude powers every capability when
 * ANTHROPIC_API_KEY is set; a KB-grounded heuristic keeps the whole system
 * working end-to-end without it. All outputs are labelled with their source.
 */
@Injectable()
export class LlmService {
  // Plain-language, Telugu-first status (the citizen-facing payoff of D.5).
  plainStatus(input: {
    status: string;
    deptNameEn?: string | null;
    deptNameTe?: string | null;
    subjectEn?: string | null;
    assigneeRole?: string | null;
    officerName?: string | null;
    slaDueAt?: Date | null;
  }): { te: string; en: string; aiGenerated: boolean } {
    const due = input.slaDueAt ? formatDate(input.slaDueAt) : null;
    const deptTe = input.deptNameTe ?? 'సంబంధిత శాఖ';
    const deptEn = input.deptNameEn ?? 'the concerned department';
    const who = input.officerName ? `${input.officerName} ` : '';

    const map: Record<string, { te: string; en: string }> = {
      [Status.REGISTERED]: {
        te: `మీ ఫిర్యాదు నమోదైంది. AI దీన్ని విశ్లేషించి సరైన శాఖకు పంపుతోంది.`,
        en: `Your grievance is registered. AI is analysing it and routing it to the right department.`,
      },
      [Status.PENDING_VERIFICATION]: {
        te: `మీ ఫిర్యాదును జిల్లా గ్రీవెన్స్ అధికారి ధృవీకరిస్తున్నారు (4 పని గంటల్లో).`,
        en: `A District Grievance Officer is confirming the right department for your case (within 4 working hours).`,
      },
      [Status.CLASSIFIED]: {
        te: `మీ ఫిర్యాదు ${deptTe}కు వర్గీకరించబడింది.`,
        en: `Your grievance has been categorised to ${deptEn}.`,
      },
      [Status.ASSIGNED]: {
        te: `${who ? who + 'గారు' : 'ఒక అధికారి'} (${deptTe}) మీ ఫిర్యాదును పరిశీలిస్తున్నారు.${due ? ` ${due} లోపు అప్‌డేట్ ఆశించండి.` : ''}`,
        en: `${who || 'An officer '}(${deptEn}) is reviewing your grievance.${due ? ` Expect an update by ${due}.` : ''}`,
      },
      [Status.UNDER_ENQUIRY]: {
        te: `మీ సమస్యపై క్షేత్రస్థాయి విచారణ జరుగుతోంది.${due ? ` ${due} లోపు అప్‌డేట్ ఆశించండి.` : ''}`,
        en: `A field enquiry into your issue is in progress.${due ? ` Expected by ${due}.` : ''}`,
      },
      [Status.ACTION_TAKEN]: {
        te: `మీ సమస్యపై చర్య తీసుకోబడింది, పరిష్కారం ధృవీకరించబడుతోంది.`,
        en: `Action has been taken on your issue and the resolution is being confirmed.`,
      },
      [Status.RESOLVED]: {
        te: `మీ ఫిర్యాదు పరిష్కరించబడింది. దయచేసి ధృవీకరించండి — సంతృప్తి చెందకపోతే తిరిగి తెరవమని అడగవచ్చు.`,
        en: `Your grievance has been resolved. Please confirm — if you are not satisfied you can ask to reopen it.`,
      },
      [Status.CLOSED]: {
        te: `మీ ఫిర్యాదు మూసివేయబడింది. మీ అభిప్రాయానికి ధన్యవాదాలు.`,
        en: `Your grievance is closed. Thank you for your feedback.`,
      },
      [Status.QUICK_DESK_REVIEW]: {
        te: `మీ రీఓపెన్ అభ్యర్థన ఉన్నత అధికారి డెస్క్‌లో త్వరిత సమీక్షలో ఉంది. మీ కారణం (వాయిస్/టెక్స్ట్) అధికారికి చేరింది.`,
        en: `Your reopen request is under a quick desk review by a senior officer. Your stated reason (voice/text) has reached them.`,
      },
      [Status.REOPENED]: {
        te: `మీ ఫిర్యాదు ఉన్నత అధికారికి తిరిగి తెరవబడింది.`,
        en: `Your grievance has been reopened and escalated to a higher authority.`,
      },
      [Status.ON_HOLD]: {
        te: `మీ ఫిర్యాదు తాత్కాలికంగా నిలిపివేయబడింది (అదనపు సమాచారం/శాఖల సమన్వయం కోసం).`,
        en: `Your grievance is temporarily on hold (awaiting more information or another department).`,
      },
      [Status.REROUTED]: {
        te: `ఇది ఫిర్యాదు కాదు — సరైన విభాగానికి (సేవా అభ్యర్థన/RTI) మళ్లించబడింది.`,
        en: `This was not a grievance — it has been routed to the correct desk (service request / RTI).`,
      },
      [Status.MERGED]: {
        te: `ఇదే సమస్యపై ఇప్పటికే ఉన్న ఫిర్యాదుతో కలపబడింది — మీ నివేదిక దాని ప్రాధాన్యతను పెంచింది.`,
        en: `This was merged with an existing grievance about the same issue — your report raised its priority.`,
      },
      [Status.REJECTED]: {
        te: `మీ ఫిర్యాదు చెల్లదని గుర్తించబడింది. మీరు అప్పీల్ చేయవచ్చు.`,
        en: `Your grievance was found invalid. You may appeal.`,
      },
    };

    const base = map[input.status] ?? {
      te: `మీ ఫిర్యాదు ప్రాసెస్ చేయబడుతోంది.`,
      en: `Your grievance is being processed.`,
    };
    return {
      te: `${base.te} (సహాయం కోసం 1902కు కాల్ చేయండి)`,
      en: `${base.en} (Call 1902 for help.)`,
      aiGenerated: true,
    };
  }

  // Officer draft-assist — human edits & approves before anything is saved/sent.
  draftAssist(input: {
    kind: 'ACK' | 'ENQUIRY_NOTE' | 'RESOLUTION';
    subjectEn?: string | null;
    mandal?: string | null;
    facts?: string[];
  }): { draft: string; aiGenerated: boolean; requiresHumanApproval: true } {
    const subject = input.subjectEn ?? 'the reported issue';
    const place = input.mandal ? ` in ${input.mandal}` : '';
    const facts = (input.facts ?? []).map((f) => `- ${f}`).join('\n');
    let draft = '';
    if (input.kind === 'ACK') {
      draft = `Acknowledgement: Your grievance regarding ${subject}${place} has been received and assigned for enquiry. We will update you on progress.`;
    } else if (input.kind === 'ENQUIRY_NOTE') {
      draft = `Enquiry note (${subject}${place}):\n${facts || '- Field verification undertaken.'}\nNext step: verify and record corrective action.`;
    } else {
      draft = `Resolution summary (${subject}${place}):\n${facts || '- Corrective action completed and verified.'}\nOutcome communicated to the petitioner for confirmation.`;
    }
    return { draft, aiGenerated: true, requiresHumanApproval: true };
  }

  // ── Saarthi 2.0 §7.1 — one-call structured complaint understanding ─────────
  async extractComplaint(input: { text: string; languageHint?: string | null }): Promise<Extraction> {
    const text = (input.text || '').trim();
    const det = detectLanguage(text);

    if (aiEnabled()) {
      const system =
        `You are the Saarthi grievance-understanding engine for Andhra Pradesh. Extract structured fields from ONE citizen ` +
        `complaint (any Indian language or script, possibly code-switched or romanised). Never invent facts.\n\n` +
        `DEPARTMENTS:\n${departmentBriefing()}\n\n` +
        `Severity rubric: CRITICAL = life/safety risk or an essential service fully down for a community; HIGH = major ` +
        `disruption or safety-adjacent; MEDIUM = significant bounded inconvenience; LOW = minor/cosmetic.\n` +
        `Urgency rubric: IMMEDIATE = act within hours (any safety risk); HIGH = 24-72h; MEDIUM = within SLA; LOW = schedulable.\n\n` +
        `Return ONLY JSON with keys: issue (one line, EN), issueCategory (snake_case), summaryEn (2 sentences), ` +
        `summaryTe (same summary in Telugu), severity, urgency, safetyFlag (bool), sentiment (one word), ` +
        `entities (object; e.g. issue_duration, affected_estimate, place), departmentHint (one of ` +
        `${DEPARTMENT_KB.map((d) => d.deptId).join(', ')} or null), detectedLanguage (ISO 639), languageConfidence (0-1), codeSwitched (bool).`;
      const user = `Complaint:\n"""${text}"""\nLanguage hint from client: ${input.languageHint ?? det.lang}.`;
      const reply = await callClaude({ system, user, maxTokens: 1000, temperature: 0.1 });
      const p = reply ? extractJson<any>(reply) : null;
      if (p && p.issue) {
        return {
          issue: String(p.issue),
          issueCategory: String(p.issueCategory ?? 'general_grievance'),
          summaryEn: String(p.summaryEn ?? p.issue),
          summaryTe: String(p.summaryTe ?? ''),
          severity: normSeverity(p.severity),
          urgency: normUrgency(p.urgency),
          safetyFlag: !!p.safetyFlag,
          sentiment: String(p.sentiment ?? 'neutral'),
          entities: p.entities && typeof p.entities === 'object' ? p.entities : {},
          departmentHint: p.departmentHint && DEPARTMENT_KB.some((d) => d.deptId === p.departmentHint) ? p.departmentHint : null,
          language: {
            detected: String(p.detectedLanguage ?? det.lang),
            confidence: clamp01(Number(p.languageConfidence ?? det.confidence)),
            codeSwitched: !!(p.codeSwitched ?? det.codeSwitched),
          },
          source: 'claude',
        };
      }
    }

    // Heuristic extraction — KB match + auditable rubric regexes.
    const kb = matchDepartment(text);
    const t = text.toLowerCase();
    const safety = /(live wire|electrocut|fall|fell|danger|accident|open pit|collapse|fire|snake|drown|assault|threat|ప్రమాద|ప్రాణ|అపాయ)/.test(t);
    const communityDown = /(whole village|entire village|no drinking water|no water supply|అందరికీ|ఊరంతా|గ్రామమంతా)/.test(t);
    const major = /(10 days|week|weeks|month|months|overflow|burnt|broken|stopped|blocked|dark|unsafe|రోజులుగా|నెలల|వారం)/.test(t);
    const severity: keyof typeof Severity = safety || communityDown ? 'CRITICAL' : major ? 'HIGH' : kb ? 'MEDIUM' : 'MEDIUM';
    const urgency: keyof typeof Urgency = safety ? 'IMMEDIATE' : severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM';
    const duration = t.match(/(\d+)\s*(days?|weeks?|months?|రోజుల|నెలల|వారాల)/)?.[0] ?? null;
    const affected = t.match(/(\d{2,})\s*(families|people|households|villagers|మంది|కుటుంబాల)/)?.[0] ?? null;
    const teluguSrc = det.script === 'Telugu';
    const gist = text.length > 160 ? text.slice(0, 157) + '…' : text;

    return {
      issue: kb ? `${kb.name} grievance reported by citizen` : 'Citizen grievance (uncategorised)',
      issueCategory: kb ? kb.deptId.toLowerCase() + '_issue' : 'general_grievance',
      summaryEn: `${kb ? `Likely a ${kb.name} issue. ` : ''}Citizen reports: ${teluguSrc ? '(original in Telugu) ' : ''}${gist}`,
      summaryTe: teluguSrc ? gist : `పౌరుడి ఫిర్యాదు${kb ? ` — ${kb.name}` : ''}: పరిశీలన అవసరం.`,
      severity,
      urgency,
      safetyFlag: safety,
      sentiment: safety ? 'alarmed' : major ? 'worried' : 'concerned',
      entities: {
        ...(duration ? { issue_duration: duration } : {}),
        ...(affected ? { affected_estimate: affected } : {}),
      },
      departmentHint: kb?.deptId ?? null,
      language: { detected: det.lang, confidence: det.confidence, codeSwitched: det.codeSwitched },
      source: 'heuristic',
    };
  }

  /**
   * Analyse a grievance for the officer: root cause, next actions, governing
   * orders, PLUS (Saarthi 2.0) an officer briefing, suggested X-Road lookups,
   * and inter-department routing when one department cannot resolve it alone.
   */
  async analyzeComplaint(input: {
    text: string;
    descriptionEn?: string | null;
    language?: string;
    mandal?: string | null;
    district?: string | null;
    category?: string | null;
    deptHint?: string | null;
  }): Promise<AiAnalysis> {
    // Analyse over BOTH surfaces — original words + working translation — so
    // keyword grounding survives a weak/partial translation of Indic text.
    const text = [input.text, input.descriptionEn]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .join('\n')
      .trim();

    if (aiEnabled()) {
      const xroadList = XROAD_SERVICE_META.map((s) => `${s.id} (${s.label}, owner ${s.deptId})`).join('; ');
      const system =
        `You are "Saarthi", an AI co-pilot for a senior Andhra Pradesh district grievance-redressal officer. ` +
        `You ANALYSE a citizen grievance and propose how to resolve it. You NEVER decide, assign or close a case — ` +
        `an officer always acts on your suggestion. Be specific, practical and grounded in the departments and orders below; ` +
        `do not invent schemes or orders. Identify the most likely ROOT CAUSE(S).\n\n` +
        `DEPARTMENTS UNDER THE AP PUBLIC GRIEVANCE REDRESSAL SYSTEM:\n${departmentBriefing()}\n\n` +
        `AVAILABLE X-ROAD DATA-EXCHANGE SERVICES (consent-gated cross-department lookups): ${xroadList}\n\n` +
        `Return ONLY a JSON object with keys: summary (1-2 sentences), department (name), deptId (one of ` +
        `${DEPARTMENT_KB.map((d) => d.deptId).join(', ')} or null), category ("FINANCE"|"NON_FINANCE"), ` +
        `priority (0-100 integer; weigh severity, people affected, vulnerability, time-sensitivity), ` +
        `rootCauses (array of {cause, likelihood:"high"|"medium"|"low"}, most likely first, max 4), ` +
        `suggestedActions (array of concrete next steps the officer should take, max 5), ` +
        `relevantOrders (array of the governing acts/GOs/SLAs that apply, max 4), ` +
        `officerBriefing (array of max 5 short strings: what to CHECK on the ground, what to ASK the citizen, what to VERIFY in records — specific to THIS complaint), ` +
        `xroadSuggestions (array of {service: one of the X-Road ids above, why: one line tied to this complaint}, max 3, only genuinely useful ones), ` +
        `interDepartments (array of {deptId, why} for OTHER departments that must be looped in via the X-Road layer if this crosses department boundaries; empty if single-department), ` +
        `slaHint (string), confidence (0-1).`;
      const user =
        `Grievance (language=${input.language ?? 'te'}):\n"""${text}"""\n` +
        `Location: ${[input.mandal, input.district].filter(Boolean).join(', ') || 'unknown'}.` +
        (input.deptHint ? ` Currently routed to department ${input.deptHint}.` : '') +
        `\nAnalyse and return the JSON.`;
      const reply = await callClaude({ system, user, maxTokens: 1300, temperature: 0.2 });
      const parsed = reply ? extractJson<Partial<AiAnalysis> & { xroadSuggestions?: any[]; interDepartments?: any[] }>(reply) : null;
      if (parsed && parsed.summary) {
        return this.normalize({ ...parsed, source: 'claude' });
      }
      // fall through to heuristic on any failure
    }

    return this.heuristicAnalysis(text, input);
  }

  private heuristicAnalysis(text: string, input: { mandal?: string | null; category?: string | null; deptHint?: string | null }): AiAnalysis {
    const kb =
      DEPARTMENT_KB.find((d) => d.deptId === input.deptHint) || matchDepartment(text) || null;
    const t = text.toLowerCase();
    const urgent = /(emergency|urgent|danger|no water|days|elderly|child|fire|live wire|outbreak|collapse|ప్రాణ|అత్యవసర|ప్రమాద)/.test(t);
    let priority = 45;
    if (kb?.category === 'FINANCE' || input.category === 'FINANCE') priority += 12;
    if (urgent) priority += 25;
    if (/(\d{2,})\s*(families|people|households|మంది)/.test(t)) priority += 10;
    priority = Math.max(20, Math.min(95, priority));

    // Inter-department detection: a second department with real keyword signal.
    const scores = DEPARTMENT_KB.map((d) => ({
      d,
      score: d.keywords.reduce((n, k) => (t.includes(k.toLowerCase()) ? n + 1 : n), 0),
    }))
      .filter((x) => x.score >= 2 && x.d.deptId !== kb?.deptId)
      .sort((a, b) => b.score - a.score);
    const interDepartments = scores.slice(0, 2).map((x) => ({
      deptId: x.d.deptId,
      name: x.d.name,
      why: `Complaint also carries strong ${x.d.name} signals (${x.d.keywords.filter((k) => t.includes(k.toLowerCase())).slice(0, 3).join(', ')}) — coordinate via the X-Road layer.`,
    }));

    const xroadSuggestions = XROAD_SERVICE_META.filter(
      (s) => s.deptId === kb?.deptId || interDepartments.some((i) => i.deptId === s.deptId),
    )
      .slice(0, 3)
      .map((s) => ({
        service: s.id,
        label: s.label,
        member: s.member,
        why: `Verify the citizen-side record with ${s.member} before field action.`,
      }));

    if (!kb) {
      return this.normalize({
        summary: 'Could not confidently map this to a department from keywords — needs operator categorisation.',
        department: 'Unclassified', deptId: null, category: (input.category as any) || 'NON_FINANCE',
        priority, rootCauses: [{ cause: 'Insufficient detail to determine the root cause; field enquiry needed.', likelihood: 'medium' }],
        suggestedActions: ['Categorise the grievance to the correct department.', 'Call the citizen (1902) to gather missing details.', 'Record a field-enquiry note.'],
        relevantOrders: ['AP Public Services Guarantee Act, 2017'], slaHint: 'Acknowledge within 24 hours.',
        officerBriefing: ['Call the citizen to clarify the exact issue and location.', 'Check whether a similar complaint exists nearby (possible duplicate).'],
        xroadSuggestions: [], interDepartments: [],
        confidence: 0.35, source: 'heuristic',
      });
    }
    return this.normalize({
      summary: `Likely a ${kb.name} grievance${input.mandal ? ` in ${input.mandal}` : ''}. ${urgent ? 'Time-sensitive.' : ''}`.trim(),
      department: kb.name, deptId: kb.deptId, category: kb.category,
      priority,
      rootCauses: kb.rootCauses.slice(0, 3).map((c, i) => ({ cause: c, likelihood: i === 0 ? 'high' : i === 1 ? 'medium' : 'low' })),
      suggestedActions: [
        `Route to ${kb.name} (lowest competent officer for the mandal).`,
        'Verify the citizen-side facts via X-Road before field action.',
        `Conduct field enquiry and record corrective action; restore within ~${kb.slaDays} days.`,
        'Update the citizen by SMS and seek closure confirmation.',
      ],
      relevantOrders: kb.orders.slice(0, 4),
      slaHint: `Department SLA ≈ ${kb.slaDays} days.`,
      officerBriefing: [
        `Check: ${kb.rootCauses[0] ?? 'primary failure point'} — the most common cause for this grievance type.`,
        `Ask the citizen: exact location landmark, how long the issue has persisted, how many households affected.`,
        `Verify in records: prior complaints at the same spot (report count), and any pending work orders for ${input.mandal ?? 'the area'}.`,
        `Governing rule to cite in the reply: ${kb.orders[0] ?? 'department citizen charter'}.`,
      ],
      xroadSuggestions, interDepartments,
      confidence: 0.55, source: 'heuristic',
    });
  }

  // ── Saarthi 2.0 — quick desk review of a reopen request ────────────────────
  async analyzeReopen(input: {
    complaintEn: string;
    resolutionNotes: string[];
    reopenReason: string;
    reasonLang?: string | null;
    profile: CitizenProfile;
  }): Promise<ReopenReview> {
    const profileSignals = buildProfileSignals(input.profile);

    if (aiEnabled()) {
      const system =
        `You are Saarthi's quick-desk-review assistant for a senior grievance officer in Andhra Pradesh. A citizen has asked ` +
        `to REOPEN a resolved/closed grievance and has given a reason (typed or spoken — the original voice file travels ` +
        `with the case). Your job: explain WHY the citizen is reopening, weigh it against what the department recorded, and ` +
        `recommend a next step. The OFFICER decides — you only analyse. Be fair to the citizen: a reopen is a signal, not a nuisance.\n\n` +
        `Return ONLY JSON: reasonSummary (1-2 sentences, plain English), ` +
        `reasonCategory ("NOT_RESOLVED"|"PARTIALLY_RESOLVED"|"RECURRED"|"WRONG_CLOSURE"|"NEW_ISSUE"|"UNCLEAR"), ` +
        `recommendation ("REOPEN"|"FIELD_VERIFY"|"UPHOLD"), rationale (2-3 sentences referencing both the citizen's reason ` +
        `and the department's resolution record), confidence (0-1).`;
      const user =
        `ORIGINAL COMPLAINT (EN): """${input.complaintEn}"""\n` +
        `DEPARTMENT RESOLUTION RECORD: ${input.resolutionNotes.length ? input.resolutionNotes.map((n) => `- ${n}`).join('\n') : '(no notes recorded)'}\n` +
        `CITIZEN'S REOPEN REASON (${langName(input.reasonLang).en}): """${input.reopenReason}"""\n` +
        `CITIZEN BACKGROUND PROFILE: ${profileSignals.join(' · ')}\n` +
        `Analyse and return the JSON.`;
      const reply = await callClaude({ system, user, maxTokens: 700, temperature: 0.2 });
      const p = reply ? extractJson<any>(reply) : null;
      if (p && p.reasonSummary) {
        return {
          reasonSummary: String(p.reasonSummary),
          reasonCategory: normEnum(p.reasonCategory, ['NOT_RESOLVED', 'PARTIALLY_RESOLVED', 'RECURRED', 'WRONG_CLOSURE', 'NEW_ISSUE', 'UNCLEAR'], 'UNCLEAR'),
          recommendation: normEnum(p.recommendation, ['REOPEN', 'FIELD_VERIFY', 'UPHOLD'], 'FIELD_VERIFY'),
          rationale: String(p.rationale ?? ''),
          profileSignals,
          confidence: clamp01(Number(p.confidence ?? 0.6)),
          source: 'claude',
        };
      }
    }

    // Heuristic desk review.
    const r = (input.reopenReason || '').toLowerCase();
    const notDone = /(still|not done|nothing|no one came|not fixed|same problem|not working|pending|ఇంకా|రాలేదు|కాలేదు|అలాగే|చేయలేదు)/.test(r);
    const recurred = /(again|back|recur|repeat|మళ్ళీ|మరలా)/.test(r);
    const partial = /(partial|half|some|only|కొంత|సగం)/.test(r);
    const newIssue = /(new|another|different|కొత్త|వేరే)/.test(r);
    const noEvidence = input.resolutionNotes.length === 0;
    const category = notDone ? 'NOT_RESOLVED' : recurred ? 'RECURRED' : partial ? 'PARTIALLY_RESOLVED' : newIssue ? 'NEW_ISSUE' : r.trim() ? 'WRONG_CLOSURE' : 'UNCLEAR';
    const recommendation = category === 'NOT_RESOLVED' && noEvidence ? 'REOPEN' : category === 'UNCLEAR' ? 'UPHOLD' : 'FIELD_VERIFY';
    return {
      reasonSummary:
        category === 'NOT_RESOLVED'
          ? 'The citizen states the issue was not actually fixed on the ground despite the case being marked resolved.'
          : category === 'RECURRED'
            ? 'The citizen states the problem returned after the fix.'
            : category === 'PARTIALLY_RESOLVED'
              ? 'The citizen states only part of the issue was addressed.'
              : category === 'NEW_ISSUE'
                ? 'The citizen appears to be describing a related but new issue.'
                : 'The citizen disputes the closure; the stated reason needs officer reading.',
      reasonCategory: category as ReopenReview['reasonCategory'],
      recommendation: recommendation as ReopenReview['recommendation'],
      rationale:
        `${noEvidence ? 'The resolution was recorded WITHOUT field evidence, which strengthens the citizen’s claim. ' : 'The department did record resolution notes/evidence — compare them against the citizen’s claim. '}` +
        `Citizen history: ${profileSignals[0] ?? 'first complaint'}.`,
      profileSignals,
      confidence: 0.55,
      source: 'heuristic',
    };
  }

  // ── Saarthi 2.0 §11 — citizen copilot on the track page ────────────────────
  async copilotAnswer(input: {
    question: string;
    lang?: string | null;
    caseContext?: {
      ysr: string;
      status: string;
      departmentEn?: string | null;
      departmentTe?: string | null;
      officerName?: string | null;
      officerDesignation?: string | null;
      slaDueAt?: Date | null;
      daysLeft?: number | null;
      summaryEn?: string | null;
      helpline?: string | null;
      reportCount?: number;
    } | null;
  }): Promise<{ answer: string; sources: string[]; aiGenerated: true }> {
    const ctx = input.caseContext;
    if (aiEnabled()) {
      const system =
        `You are Saarthi Copilot, a grievance assistant for citizens of Andhra Pradesh. Answer the citizen's question ` +
        `helpfully and briefly (2-4 sentences), in the SAME language as their question (language hint: ${input.lang ?? 'auto'}). ` +
        `Ground every claim in the case facts and the knowledge base below — never invent statuses, dates, laws or sections. ` +
        `You give legal INFORMATION with sources, never legal advice. If asked about rights/SLAs, cite the act by name. ` +
        `If the question suggests an emergency (self-harm, violence, fire), tell them to call 112/108 immediately.\n\n` +
        `KNOWLEDGE BASE:\n${departmentBriefing()}\n\n` +
        (ctx
          ? `CASE FACTS: tracking ${ctx.ysr}; status ${ctx.status}; department ${ctx.departmentEn ?? 'not yet assigned'};` +
            ` officer ${ctx.officerName ? `${ctx.officerName} (${ctx.officerDesignation ?? 'officer'})` : 'not yet assigned'};` +
            ` SLA ${ctx.daysLeft != null ? `${ctx.daysLeft} day(s) left` : 'not started'};` +
            ` ${ctx.reportCount && ctx.reportCount > 1 ? `${ctx.reportCount} citizens reported this issue;` : ''}` +
            ` department helpline ${ctx.helpline ?? '1902'}; summary: ${ctx.summaryEn ?? '—'}.\n`
          : 'No case is loaded — answer generally about how SAARTHI works (file by voice in any language, AI routes to the right department, track with the PGRS number, call 1902).\n') +
        `Return plain text only.`;
      const reply = await callClaude({ system, user: input.question, maxTokens: 500, temperature: 0.3 });
      if (reply) {
        return { answer: reply.trim(), sources: ['AP Public Services Guarantee Act, 2017', 'Department citizen charter', ctx ? `Case record ${ctx.ysr}` : 'SAARTHI service guide'], aiGenerated: true };
      }
    }

    // Grounded template answer.
    if (!ctx) {
      return {
        answer:
          'You can file a complaint by speaking in any Indian language — SAARTHI detects the language, understands the problem and routes it to the right department automatically. Track it anytime with your PGRS number, or call 1902.',
        sources: ['SAARTHI service guide'],
        aiGenerated: true,
      };
    }
    const plain = this.plainStatus({ status: ctx.status, deptNameEn: ctx.departmentEn, deptNameTe: ctx.departmentTe, officerName: ctx.officerName, slaDueAt: ctx.slaDueAt ?? null });
    const extra =
      ctx.daysLeft != null && ctx.daysLeft >= 0
        ? ` The department's service deadline is in ${ctx.daysLeft} day(s) (AP Public Services Guarantee Act, 2017).`
        : ctx.daysLeft != null
          ? ` The service deadline has passed — the case auto-escalates to a higher officer, and you can ask the Copilot for an escalation/RTI draft.`
          : '';
    const officerLine = ctx.officerName ? ` Your case is with ${ctx.officerName}${ctx.officerDesignation ? ` (${ctx.officerDesignation})` : ''}.` : '';
    return {
      answer: `${plain.en}${officerLine}${extra} You can call the ${ctx.departmentEn ?? 'department'} helpline at ${ctx.helpline ?? '1902'}.`,
      sources: ['AP Public Services Guarantee Act, 2017', `Case record ${ctx.ysr}`],
      aiGenerated: true,
    };
  }

  private normalize(a: Partial<AiAnalysis> & { source: 'claude' | 'heuristic'; xroadSuggestions?: any[]; interDepartments?: any[] }): AiAnalysis {
    const cat = a.category === 'FINANCE' ? 'FINANCE' : 'NON_FINANCE';
    const pr = Math.max(0, Math.min(100, Math.round(Number(a.priority ?? 50))));
    const xroad = (a.xroadSuggestions ?? [])
      .map((s: any) => {
        const meta = XROAD_SERVICE_META.find((m) => m.id === (s.service ?? s.id));
        if (!meta) return null;
        return { service: meta.id, label: meta.label, member: meta.member, why: String(s.why ?? '') };
      })
      .filter((x): x is AiAnalysis['xroadSuggestions'][number] => !!x)
      .slice(0, 3);
    const inter = (a.interDepartments ?? [])
      .map((i: any) => {
        const kb = DEPARTMENT_KB.find((d) => d.deptId === (i.deptId ?? i.id));
        if (!kb) return null;
        return { deptId: kb.deptId, name: kb.name, why: String(i.why ?? '') };
      })
      .filter((x): x is AiAnalysis['interDepartments'][number] => !!x)
      .slice(0, 3);
    return {
      summary: a.summary || 'Grievance analysed.',
      department: a.department || 'Unclassified',
      deptId: a.deptId ?? null,
      category: cat,
      priority: pr,
      rootCauses: (a.rootCauses ?? []).slice(0, 4).map((r) => ({
        cause: String((r as any).cause ?? r),
        likelihood: (['high', 'medium', 'low'].includes((r as any).likelihood) ? (r as any).likelihood : 'medium'),
      })),
      suggestedActions: (a.suggestedActions ?? []).slice(0, 5).map(String),
      relevantOrders: (a.relevantOrders ?? []).slice(0, 4).map(String),
      slaHint: a.slaHint || '',
      confidence: Math.max(0, Math.min(1, Number(a.confidence ?? 0.5))),
      source: a.source,
      officerBriefing: (a.officerBriefing ?? []).slice(0, 5).map(String),
      xroadSuggestions: xroad,
      interDepartments: inter,
    };
  }
}

function buildProfileSignals(p: CitizenProfile): string[] {
  const signals: string[] = [];
  signals.push(
    p.totalComplaints <= 1
      ? 'First-time complainant'
      : `${p.totalComplaints} complaints filed, ${p.resolvedOrClosed} resolved/closed, ${p.reopens} reopen(s)`,
  );
  if (p.avgRating != null) signals.push(`Average satisfaction ${p.avgRating.toFixed(1)}★`);
  if (p.vulnerabilityFlags.length) signals.push(`Vulnerability: ${p.vulnerabilityFlags.join(', ')}`);
  if (p.reopens >= 3) signals.push('Multiple prior reopens — review pattern, but judge THIS case on its own facts');
  if (p.memberSinceDays >= 0) signals.push(`On SAARTHI for ${p.memberSinceDays >= 30 ? `${Math.round(p.memberSinceDays / 30)} month(s)` : `${p.memberSinceDays} day(s)`}`);
  return signals;
}

function normSeverity(v: any): keyof typeof Severity {
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(v) ? v : 'MEDIUM';
}
function normUrgency(v: any): keyof typeof Urgency {
  return ['LOW', 'MEDIUM', 'HIGH', 'IMMEDIATE'].includes(v) ? v : 'MEDIUM';
}
function normEnum<T extends string>(v: any, allowed: T[], fallback: T): T {
  return allowed.includes(v) ? v : fallback;
}
function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
