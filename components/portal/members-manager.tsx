'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, UserPlus, Crown, ShieldCheck, X, Check } from 'lucide-react'
import type { CompanyMember } from '@/actions/member-actions'
import {
  createCompanyMember,
  changeMemberRole,
  removeCompanyMember,
} from '@/actions/member-actions'
import type { CompanyRole } from '@/lib/supabase/database.types'
import { roleLabel, ROLE_DESCRIPTIONS } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Nur diese Rollen darf der Geschäftsführer vergeben (owner bleibt tabu).
const ASSIGNABLE_ROLES: CompanyRole[] = ['admin', 'member']

const selectCls =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none disabled:opacity-50'

function fullName(m: { firstName: string | null; lastName: string | null }) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ')
}

export function MembersManager({
  companyId,
  initialMembers,
}: {
  companyId: string
  initialMembers: CompanyMember[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  // Create-Form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<CompanyRole>('member')

  function run(
    fn: () => Promise<{ success: boolean; error?: string }>,
    after?: () => void,
  ) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) {
        setError(res.error ?? 'Es ist ein Fehler aufgetreten.')
        return
      }
      after?.()
      router.refresh()
    })
  }

  function resetCreate() {
    setEmail('')
    setPassword('')
    setFirstName('')
    setLastName('')
    setRole('member')
    setShowCreate(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Mitglieder verwalten
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Zugänge für deine Mitarbeiter anlegen, Rollen ändern und entfernen.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="shrink-0"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Neuer Zugang
        </Button>
      </div>

      {/* Neuen Nutzer anlegen */}
      {showCreate && (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Neuen Zugang anlegen</CardTitle>
            <CardDescription>
              Der Mitarbeiter meldet sich anschließend mit E-Mail und diesem Passwort an.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">E-Mail</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@firma.de"
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Passwort</span>
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mind. 8 Zeichen"
                  autoComplete="new-password"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Vorname</span>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Nachname</span>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rolle</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as CompanyRole)}
                  className={cn(selectCls, 'w-full py-2')}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">{ROLE_DESCRIPTIONS[role]}</span>
              </label>
            </div>

            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={isPending || !email.trim() || password.length < 8}
                onClick={() =>
                  run(
                    () =>
                      createCompanyMember({
                        companyId,
                        email,
                        password,
                        firstName,
                        lastName,
                        role,
                      }),
                    resetCreate,
                  )
                }
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Zugang erstellen
              </Button>
              <Button type="button" variant="outline" onClick={resetCreate}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showCreate && error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {/* Mitgliederliste */}
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">
            Team ({initialMembers.length})
          </CardTitle>
          <CardDescription>Alle Mitglieder deines Unternehmens.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {initialMembers.map((m) => {
              const name = fullName(m) || m.email
              const locked = m.role === 'owner' || m.isSuperadmin
              return (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold uppercase text-slate-600 dark:text-slate-300">
                    {(fullName(m) || m.email).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {name}
                      </p>
                      {m.isSelf && (
                        <Badge variant="secondary" className="text-xs">
                          Du
                        </Badge>
                      )}
                      {m.role === 'owner' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <Crown className="h-3.5 w-3.5" /> Geschäftsführer
                        </span>
                      )}
                      {m.isSuperadmin && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                          <ShieldCheck className="h-3.5 w-3.5" /> Superadmin
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.email}</p>
                  </div>

                  {/* Rolle */}
                  {locked ? (
                    <Badge variant="secondary" className="shrink-0">
                      {roleLabel(m.role)}
                    </Badge>
                  ) : (
                    <select
                      value={m.role}
                      disabled={isPending}
                      onChange={(e) =>
                        run(() =>
                          changeMemberRole({
                            companyId,
                            userId: m.userId,
                            role: e.target.value as CompanyRole,
                          }),
                        )
                      }
                      className={cn(selectCls, 'shrink-0')}
                      aria-label={`Rolle von ${name}`}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Entfernen */}
                  {!locked && !m.isSelf && (
                    confirmRemove === m.userId ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() =>
                            run(
                              () => removeCompanyMember({ companyId, userId: m.userId }),
                              () => setConfirmRemove(null),
                            )
                          }
                        >
                          {m.onlyThisCompany ? 'Endgültig löschen?' : 'Entfernen?'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="px-2"
                          onClick={() => setConfirmRemove(null)}
                          aria-label="Abbrechen"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0 px-2 text-slate-400 hover:text-rose-600"
                        onClick={() => setConfirmRemove(m.userId)}
                        aria-label={`${name} entfernen`}
                        title={
                          m.onlyThisCompany
                            ? 'Nutzer endgültig löschen'
                            : 'Nutzer aus diesem Unternehmen entfernen'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Nutzer, die nur zu diesem Unternehmen gehören, werden beim Entfernen vollständig gelöscht.
        Gehört ein Nutzer noch zu weiteren Unternehmen, wird lediglich sein Zugang zu diesem
        Unternehmen aufgehoben. Die Rolle des Geschäftsführers kann hier nicht geändert werden.
      </p>
    </div>
  )
}
