import { redirect } from 'next/navigation';
import { getServerSession } from '@/server/auth';
import { getDefaultRedirectForRole } from '@/lib/rbac';

export default async function OpsRootPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login?redirect=/ops');
  }
  const target = getDefaultRedirectForRole(session.role);
  redirect(target);
}
