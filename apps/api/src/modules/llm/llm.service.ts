import { Injectable } from '@nestjs/common';
import { Status } from '../../common/constants';
import { aiEnabled, callClaude, extractJson } from './anthropic.client';
import { DEPARTMENT_KB, departmentBriefing, matchDepartment } from './ai-knowledge';

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
}

/**
 * LLM assist, pilot implementation (Blueprint D.5).
 * Hard guardrails from the blueprint are encoded by construction: this service is
 * READ-ONLY and template-grounded. It (a) never decides or closes a grievance,
 * (b) is derived only from real state, (c) labels output as AI-generated, and
 * (d) always offers the 1902 helpline. A real deployment swaps these templates
 * for a RAG-grounded sovereign LLM behind the same interface — with redacted,
 * tokenised context only (never raw Aadhaar/PII).
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
    slaDueAt?: Date | null;
  }): { te: string; en: string; aiGenerated: boolean } {
    const due = input.slaDueAt ? formatDate(input.slaDueAt) : null;
    const deptTe = input.deptNameTe ?? 'సంబంధిత శాఖ';
    const deptEn = input.deptNameEn ?? 'the concerned department';

    const map: Record<string, { te: string; en: string }> = {
      [Status.REGISTERED]: {
        te: `మీ ఫిర్యాదు నమోదైంది. త్వరలో ఒక అధికారికి అప్పగించబడుతుంది.`,
        en: `Your grievance is registered. It will be assigned to an officer shortly.`,
      },
      [Status.CLASSIFIED]: {
        te: `మీ ఫిర్యాదు ${deptTe}కు వర్గీకరించబడింది.`,
        en: `Your grievance has been categorised to ${deptEn}.`,
      },
      [Status.ASSIGNED]: {
        te: `ఒక అధికారి మీ ఫిర్యాదును పరిశీలిస్తున్నారు.${due ? ` ${due} లోపు అప్‌డేట్ ఆశించండి.` : ''}`,
        en: `An officer is reviewing your grievance.${due ? ` Expect an update by ${due}.` : ''}`,
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
        te: `మీ ఫిర్యాదు పరిష్కరించబడింది. దయచేసి ధృవీకరించండి — సంతృప్తి చెందకపోతే తిరిగి తెరవవచ్చు.`,
        en: `Your grievance has been resolved. Please confirm — if you are not satisfied you can reopen it.`,
      },
      [Status.CLOSED]: {
        te: `మీ ఫిర్యాదు మూసివేయబడింది. మీ అభిప్రాయానికి ధన్యవాదాలు.`,
        en: `Your grievance is closed. Thank you for your feedback.`,
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
        te: `ఇదే సమస్యపై ఇప్పటికే ఉన్న ఫిర్యాదుతో కలపబడింది.`,
        en: `This was merged with an existing grievance about the same issue.`,
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

  /**
   * Analyse a grievance: identify the likely department, the ROOT CAUSE, suggested
   * next actions and the governing orders. Uses Claude when ANTHROPIC_API_KEY is
   * set (grounded in the department knowledge base), else a heuristic from the same
   * KB. ANALYSIS ONLY — the officer always decides; the AI never closes a case.
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
    const text = (input.descriptionEn || input.text || '').trim();

    if (aiEnabled()) {
      const system =
        `You are "Saarthi", an AI co-pilot for a senior Andhra Pradesh district grievance-redressal officer. ` +
        `You ANALYSE a citizen grievance and propose how to resolve it. You NEVER decide, assign or close a case — ` +
        `an officer always acts on your suggestion. Be specific, practical and grounded in the departments and orders below; ` +
        `do not invent schemes or orders. Identify the most likely ROOT CAUSE(S).\n\n` +
        `DEPARTMENTS UNDER THE AP PUBLIC GRIEVANCE REDRESSAL SYSTEM:\n${departmentBriefing()}\n\n` +
        `Return ONLY a JSON object with keys: summary (1-2 sentences), department (name), deptId (one of ` +
        `${DEPARTMENT_KB.map((d) => d.deptId).join(', ')} or null), category ("FINANCE"|"NON_FINANCE"), ` +
        `priority (0-100 integer; weigh severity, people affected, vulnerability, time-sensitivity), ` +
        `rootCauses (array of {cause, likelihood:"high"|"medium"|"low"}, most likely first, max 4), ` +
        `suggestedActions (array of concrete next steps the officer should take, max 5), ` +
        `relevantOrders (array of the governing acts/GOs/SLAs that apply, max 4), ` +
        `slaHint (string), confidence (0-1).`;
      const user =
        `Grievance (language=${input.language ?? 'te'}):\n"""${text}"""\n` +
        `Location: ${[input.mandal, input.district].filter(Boolean).join(', ') || 'unknown'}.` +
        (input.deptHint ? ` Operator hint: department ${input.deptHint}.` : '') +
        `\nAnalyse and return the JSON.`;
      const reply = await callClaude({ system, user, maxTokens: 900, temperature: 0.2 });
      const parsed = reply ? extractJson<Partial<AiAnalysis>>(reply) : null;
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

    if (!kb) {
      return this.normalize({
        summary: 'Could not confidently map this to a department from keywords — needs operator categorisation.',
        department: 'Unclassified', deptId: null, category: (input.category as any) || 'NON_FINANCE',
        priority, rootCauses: [{ cause: 'Insufficient detail to determine the root cause; field enquiry needed.', likelihood: 'medium' }],
        suggestedActions: ['Categorise the grievance to the correct department.', 'Call the citizen (1902) to gather missing details.', 'Record a field-enquiry note.'],
        relevantOrders: ['AP Public Services Guarantee Act, 2017'], slaHint: 'Acknowledge within 24 hours.',
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
      confidence: 0.55, source: 'heuristic',
    });
  }

  private normalize(a: Partial<AiAnalysis> & { source: 'claude' | 'heuristic' }): AiAnalysis {
    const cat = a.category === 'FINANCE' ? 'FINANCE' : 'NON_FINANCE';
    const pr = Math.max(0, Math.min(100, Math.round(Number(a.priority ?? 50))));
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
    };
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
