import { listCompanies, listUsers } from '@/lib/superadmin'
import { SuperadminConsole } from '@/components/superadmin/superadmin-console'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const [companies, users] = await Promise.all([listCompanies(), listUsers()])

  return <SuperadminConsole companies={companies} users={users} />
}
