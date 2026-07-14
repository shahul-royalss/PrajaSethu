'use client';

import { Suspense } from 'react';
import { LoginGate } from '../components/LoginGate';
import { Console } from '../components/console/Console';

export default function StaffPage() {
  // Suspense boundary: the Console reads its active view from useSearchParams().
  return (
    <Suspense fallback={null}>
      <LoginGate allowedRoles={['DA', 'OFFICER', 'SUPERVISOR', 'COLLECTOR', 'AUDITOR']} title="Staff sign-in">
        {({ token, officer }) => <Console token={token} officer={officer} />}
      </LoginGate>
    </Suspense>
  );
}
