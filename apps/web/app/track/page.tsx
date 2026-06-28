'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Header } from '../components/Header';
import { Button, Card, CardBody, Field } from '../components/ui';

export default function TrackEntry() {
  const router = useRouter();
  const [ysr, setYsr] = useState('');

  function go() {
    const v = ysr.trim();
    if (v) router.push(`/track/${encodeURIComponent(v)}`);
  }

  return (
    <div className="min-h-screen">
      <Header title="Track" />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Track your grievance</h1>
              <p className="font-telugu text-sm text-slate-500">మీ ఫిర్యాదు స్థితిని తెలుసుకోండి</p>
            </div>
            <Field label="Tracking ID (YSR number)" hint="Sent to you by SMS when you filed.">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="YSR-AP-2026-000001"
                value={ysr}
                onChange={(e) => setYsr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && go()}
              />
            </Field>
            <Button onClick={go} disabled={!ysr.trim()} className="w-full">
              Track →
            </Button>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Try a sample: <button className="font-mono text-brand underline" onClick={() => setYsr('YSR-AP-2026-000001')}>YSR-AP-2026-000001</button>{' '}
              (in progress), <button className="font-mono text-brand underline" onClick={() => setYsr('YSR-AP-2026-000006')}>…000006</button>{' '}
              (resolved, awaiting your confirmation), <button className="font-mono text-brand underline" onClick={() => setYsr('YSR-AP-2026-000004')}>…000004</button>{' '}
              (closed).
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
