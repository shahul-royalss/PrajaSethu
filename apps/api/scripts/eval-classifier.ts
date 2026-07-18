/**
 * Classifier evaluation harness — run with:
 *   npx ts-node --project tsconfig.seed.json scripts/eval-classifier.ts
 *
 * Two tests:
 *  1) Leave-one-out over the training corpus: each example is classified by an
 *     index built WITHOUT it — an honest estimate of generalisation, not recall.
 *  2) A held-out set of novel phrasings never seen in the corpus.
 *
 * Prints overall/per-department accuracy, confidence distribution and the
 * confusion pairs — the numbers behind the auto-route gate.
 */
import { AP_GRIEVANCE_CORPUS } from '../src/modules/classification/ap-grievance-corpus';
import { buildIndex, DeptLexicon } from '../src/modules/classification/classifier-core';
import { DEPARTMENT_KB } from '../src/modules/llm/ai-knowledge';

const LEXICONS: DeptLexicon[] = DEPARTMENT_KB.map((d) => ({ deptId: d.deptId, keywords: d.keywords }));

// Novel held-out examples (NOT in the corpus) — phrasing the model never saw.
const HELD_OUT: { deptId: string; text: string }[] = [
  { deptId: 'RWS', text: 'the mini tank in our colony is empty and no water has come through the taps since sunday' },
  { deptId: 'RWS', text: 'బోరింగ్ దగ్గర నీళ్లు ఉప్పగా వస్తున్నాయి, తాగలేకపోతున్నాం' },
  { deptId: 'ENERGY', text: 'the fuse on our street keeps burning and half the homes have no light after 7pm' },
  { deptId: 'ENERGY', text: 'కరెంటు తీగ మా పొలం మీద తెగి పడింది, ఎవరైనా చనిపోయే ప్రమాదం ఉంది' },
  { deptId: 'CS', text: 'the shop says my thumb impression fails every time and sends me home without the monthly rice' },
  { deptId: 'CS', text: 'రేషన్ షాపు వాళ్లు పాత బకాయి ఉందని సరుకులు ఆపేశారు' },
  { deptId: 'PEN', text: 'my grandmother has not got her monthly welfare amount in the bank for two months now' },
  { deptId: 'PEN', text: 'వికలాంగ పింఛను మంజూరు కాగితం వచ్చింది కానీ డబ్బులు జమ కావడం లేదు' },
  { deptId: 'REVENUE', text: 'the tahsildar office keeps postponing the field measurement of my inherited plot' },
  { deptId: 'REVENUE', text: 'మా భూమి పక్కవాళ్ల పేరు మీద రికార్డుల్లో నమోదైంది, సరిదిద్దాలి' },
  { deptId: 'PR', text: 'the lamp posts in our colony have no bulbs and the whole street is pitch dark' },
  { deptId: 'PR', text: 'చెత్త బండి వారం రోజులుగా రావడం లేదు, ఇంటి ముందు కుప్పలు పేరుకుపోయాయి' },
  { deptId: 'MA', text: 'the town office charged my small house under commercial tax category wrongly' },
  { deptId: 'MA', text: 'మున్సిపల్ ఆఫీసులో జనన ధృవీకరణ పత్రం ఇవ్వడానికి వారాలు తిప్పుతున్నారు' },
  { deptId: 'RB', text: 'lorries have carved deep ruts on the mandal road and two wheeler riders keep falling' },
  { deptId: 'RB', text: 'వాగు మీద కల్వర్టు కూలిపోవడంతో పక్క ఊరికి రాకపోకలు ఆగిపోయాయి' },
  { deptId: 'HEALTH', text: 'the government dispensary has been locked for days and there is nobody to see patients' },
  { deptId: 'HEALTH', text: 'జ్వరంతో వెళ్తే ఆసుపత్రిలో పారాసిటమాల్ కూడా లేదన్నారు' },
  { deptId: 'EDU', text: 'our village school has one master for all the classes and children just play all day' },
  { deptId: 'EDU', text: 'బడిలో మధ్యాహ్న భోజనం సరిగా పెట్టడం లేదు, పిల్లలు ఆకలితో ఉంటున్నారు' },
  { deptId: 'AGRI', text: 'the fertiliser shop at the mandal has no stock and sowing season is passing' },
  { deptId: 'AGRI', text: 'పంట నష్టపరిహారం లిస్టులో నా పేరు లేదు, పూర్తిగా పంట పోయింది' },
  { deptId: 'POLICE', text: 'someone broke our shop lock at night and the station is dragging its feet on the case' },
  { deptId: 'POLICE', text: 'రౌడీలు దుకాణదారుల నుంచి డబ్బులు వసూలు చేస్తున్నారు, రక్షణ కావాలి' },
  { deptId: 'TRANSPORT', text: 'the morning bus that takes children to the high school was cancelled without notice' },
  { deptId: 'TRANSPORT', text: 'లైసెన్స్ టెస్ట్ కి స్లాట్ దొరకడం లేదు, ఏజెంట్లు డబ్బులు అడుగుతున్నారు' },
  { deptId: 'HOUSING', text: 'my sanctioned scheme house is stuck at the basement stage because the money stopped' },
  { deptId: 'HOUSING', text: 'ఇళ్ల స్థలాల లేఅవుట్ లో నా ప్లాట్ వేరే వాళ్లకు ఇచ్చేశారు' },
  { deptId: 'VIG', text: 'the office staff openly say the file will move only if we pay them something' },
  { deptId: 'VIG', text: 'పథకం డబ్బుల్లో అధికారులు వాటా తీసుకుంటున్నారని అందరికీ తెలుసు, విచారణ చేయండి' },
];

function evaluate(name: string, rows: { deptId: string; text: string }[], loo: boolean) {
  let correct = 0;
  const perDept = new Map<string, { ok: number; total: number }>();
  const confusions = new Map<string, number>();
  const probsWhenCorrect: number[] = [];
  let confident = 0; // correct AND ≥0.75

  for (let i = 0; i < rows.length; i++) {
    const corpus = loo ? AP_GRIEVANCE_CORPUS.filter((_, j) => j !== i) : AP_GRIEVANCE_CORPUS;
    const index = buildIndex(corpus, LEXICONS);
    const r = index.classify(rows[i].text);
    const want = rows[i].deptId;
    const got = r.top1?.deptId ?? '∅';
    const stat = perDept.get(want) ?? { ok: 0, total: 0 };
    stat.total++;
    if (got === want) {
      stat.ok++;
      correct++;
      probsWhenCorrect.push(r.top1!.probability);
      if (r.top1!.probability >= 0.75) confident++;
    } else {
      confusions.set(`${want}→${got}`, (confusions.get(`${want}→${got}`) ?? 0) + 1);
    }
    perDept.set(want, stat);
  }

  const acc = ((correct / rows.length) * 100).toFixed(1);
  const meanP = probsWhenCorrect.length
    ? (probsWhenCorrect.reduce((a, b) => a + b, 0) / probsWhenCorrect.length).toFixed(3)
    : '—';
  console.log(`\n═══ ${name} ═══`);
  console.log(`accuracy: ${correct}/${rows.length} = ${acc}%   mean top1-prob when correct: ${meanP}   correct@≥0.75: ${confident}`);
  const weak = [...perDept.entries()].filter(([, s]) => s.ok < s.total);
  if (weak.length) {
    console.log('per-dept misses:', weak.map(([d, s]) => `${d} ${s.ok}/${s.total}`).join('  '));
    console.log('confusions:', [...confusions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}×${n}`).join('  '));
  } else {
    console.log('per-dept: all clean');
  }
}

evaluate('LEAVE-ONE-OUT (training corpus)', AP_GRIEVANCE_CORPUS, true);
evaluate('HELD-OUT (novel phrasings)', HELD_OUT, false);
