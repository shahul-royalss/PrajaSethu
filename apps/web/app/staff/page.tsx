'use client';

import { LoginGate } from '../components/LoginGate';
import { Console } from '../components/console/Console';

export default function StaffPage() {
  return (
    <LoginGate allowedRoles={['DA', 'OFFICER', 'SUPERVISOR', 'COLLECTOR', 'AUDITOR']} title="Staff sign-in">
      {({ token, officer, logout }) => <Console token={token} officer={officer} logout={logout} />}
    </LoginGate>
  );
}
