import { Injectable } from '@nestjs/common';
import { Status } from '../../common/constants';

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
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
