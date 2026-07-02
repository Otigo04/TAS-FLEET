'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, Plus, Trash2, Pencil, Check, X, Loader2,
  ShieldCheck, Crown, Mail, ChevronDown,
} from 'lucide-react'
import type { AdminCompany, AdminUser } from '@/lib/superadmin'
import type { CompanyRole } from '@/lib/supabase/database.types'
import { COMPANY_ROLES, roleLabel } from '@/lib/roles'
import {
  createCompanyAsAdmin, renameCompany, deleteCompany, setCompanyLogo,
  createUser, updateUser, assignMembership, removeMembership, deleteUser,
} from '@/actions/superadmin-actions'
import { AvatarUploadCrop } from '@/components/ui/avatar-upload-crop'

type Tab = 'companies' | 'users'
// Anzeige immer als deutsche Rollenbezeichnung (Geschäftsführer usw.) —
// die DB-Codes bleiben als <option value> erhalten.
const ROLES = COMPANY_ROLES

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function SuperadminConsole({
  companies,
  users,
}: {
  companies: AdminCompany[]
  users: AdminUser[]
}) {
  const [tab, setTab] = useState<Tab>('companies')

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Building2} label="Unternehmen" value={companies.length} tone="amber" />
        <StatCard icon={Users} label="Nutzer" value={users.length} tone="sky" />
      </div>

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {([
          { id: 'companies' as Tab, label: 'Unternehmen', icon: Building2 },
          { id: 'users' as Tab, label: 'Nutzer', icon: Users },
        ]).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'companies' ? (
        <CompaniesPanel companies={companies} />
      ) : (
        <UsersPanel users={users} companies={companies} />
      )}
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: typeof Building2; label: string; value: number; tone: 'amber' | 'sky' }) {
  const toneCls = tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'
  return (
    <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-md text-slate-950 ${toneCls}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="text-sm text-rose-400">{msg}</p>
}

// =====================================================================
// COMPANIES
// =====================================================================

function CompaniesPanel({ companies }: { companies: AdminCompany[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function run(fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) { setError(res.error ?? 'Fehler'); return }
      after?.()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Unternehmen verwalten</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
        >
          <Plus className="h-4 w-4" /> Neues Unternehmen
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Unternehmensname"
              className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') run(() => createCompanyAsAdmin(name), () => { setName(''); setShowCreate(false) })
              }}
            />
            <button
              type="button"
              disabled={isPending || name.trim().length < 2}
              onClick={() => run(() => createCompanyAsAdmin(name), () => { setName(''); setShowCreate(false) })}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Erstellen
            </button>
          </div>
          <FieldError msg={error} />
        </div>
      )}

      {!showCreate && <FieldError msg={error} />}

      <div className="overflow-hidden rounded-xl border border-white/10">
        {companies.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Noch keine Unternehmen angelegt.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.03]">
                <AvatarUploadCrop
                  value={c.logoUrl}
                  onChange={(url) => run(() => setCompanyLogo(c.id, url))}
                  placeholder={<Building2 className="h-7 w-7" />}
                  pathPrefix="companies"
                />

                {editingId === c.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                    <IconBtn title="Speichern" onClick={() => run(() => renameCompany(c.id, editName), () => setEditingId(null))}>
                      <Check className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="Abbrechen" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </IconBtn>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{c.name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {c.slug} · {c.memberCount} {c.memberCount === 1 ? 'Mitglied' : 'Mitglieder'} · seit {fmtDate(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconBtn title="Umbenennen" onClick={() => { setEditingId(c.id); setEditName(c.name) }}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      {confirmDelete === c.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => deleteCompany(c.id), () => setConfirmDelete(null))}
                            className="rounded-lg bg-rose-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
                          >
                            Wirklich löschen?
                          </button>
                          <IconBtn title="Abbrechen" onClick={() => setConfirmDelete(null)}>
                            <X className="h-4 w-4" />
                          </IconBtn>
                        </span>
                      ) : (
                        <IconBtn title="Löschen" danger onClick={() => setConfirmDelete(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Achtung: Beim Löschen eines Unternehmens werden alle zugehörigen Daten (Fahrer, Fahrzeuge, Schichten,
        Mitgliedschaften) unwiderruflich entfernt.
      </p>
    </div>
  )
}

// =====================================================================
// USERS
// =====================================================================

function UsersPanel({ users, companies }: { users: AdminUser[]; companies: AdminCompany[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // create form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSuper, setIsSuper] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [role, setRole] = useState<CompanyRole>('member')

  function run(fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) { setError(res.error ?? 'Fehler'); return }
      after?.()
      router.refresh()
    })
  }

  function resetCreate() {
    setEmail(''); setPassword(''); setFirstName(''); setLastName('')
    setIsSuper(false); setCompanyId(''); setRole('member'); setShowCreate(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Nutzer verwalten</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
        >
          <Plus className="h-4 w-4" /> Neuer Nutzer
        </button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-Mail">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@firma.de" />
            </Field>
            <Field label="Passwort">
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="mind. 8 Zeichen" />
            </Field>
            <Field label="Vorname">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Nachname">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Unternehmen (optional)">
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
                <option value="">— keine —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Rolle">
              <select value={role} onChange={(e) => setRole(e.target.value as CompanyRole)} className={inputCls} disabled={!companyId}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex w-fit items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} className="h-4 w-4 accent-amber-400" />
            Als Superadmin anlegen
          </label>
          <FieldError msg={error} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(
                () => createUser({ email, password, firstName, lastName, isSuperadmin: isSuper, companyId: companyId || undefined, role }),
                resetCreate,
              )}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Nutzer erstellen
            </button>
            <button type="button" onClick={resetCreate} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {!showCreate && <FieldError msg={error} />}

      <div className="overflow-hidden rounded-xl border border-white/10">
        {users.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Keine Nutzer gefunden.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {users.map((u) => {
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'
              const open = expanded === u.id
              return (
                <li key={u.id}>
                  <div className="flex items-center gap-4 p-4 hover:bg-white/[0.03]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-sky-300">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-white">{u.email}</p>
                        {u.isSuperadmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                            <Crown className="h-3 w-3" /> Superadmin
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400">
                        {name}
                        {u.memberships.length > 0 && ' · '}
                        {u.memberships.map((m) => `${m.companyName} (${roleLabel(m.role)})`).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : u.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5"
                    >
                      Verwalten
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {open && (
                    <UserEditPanel
                      user={u}
                      companies={companies}
                      isPending={isPending}
                      run={run}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function UserEditPanel({
  user, companies, isPending, run,
}: {
  user: AdminUser
  companies: AdminCompany[]
  isPending: boolean
  run: (fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) => void
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [lastName, setLastName] = useState(user.lastName ?? '')
  const [isSuper, setIsSuper] = useState(user.isSuperadmin)
  const [addCompanyId, setAddCompanyId] = useState('')
  const [addRole, setAddRole] = useState<CompanyRole>('member')
  const [confirmDel, setConfirmDel] = useState(false)

  const availableCompanies = companies.filter(
    (c) => !user.memberships.some((m) => m.companyId === c.id),
  )

  return (
    <div className="space-y-5 border-t border-white/10 bg-black/20 p-4">
      {/* Profile */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Profil</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vorname">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Nachname">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <label className="flex w-fit items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          Superadmin-Rechte
        </label>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => updateUser({ userId: user.id, firstName, lastName, isSuperadmin: isSuper }))}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Profil speichern
        </button>
      </div>

      {/* Memberships */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Unternehmenszugehörigkeit</p>
        {user.memberships.length === 0 ? (
          <p className="text-sm text-slate-400">Keinem Unternehmen zugeordnet.</p>
        ) : (
          <ul className="space-y-2">
            {user.memberships.map((m) => (
              <li key={m.companyId} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-amber-400" />
                  <span className="font-medium text-white">{m.companyName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => run(() => assignMembership({ userId: user.id, companyId: m.companyId, role: e.target.value as CompanyRole }))}
                    className="rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                  <IconBtn title="Aus Unternehmen entfernen" danger onClick={() => run(() => removeMembership({ userId: user.id, companyId: m.companyId }))}>
                    <X className="h-4 w-4" />
                  </IconBtn>
                </span>
              </li>
            ))}
          </ul>
        )}

        {availableCompanies.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={addCompanyId} onChange={(e) => setAddCompanyId(e.target.value)} className={`${inputCls} w-auto`}>
              <option value="">Unternehmen hinzufügen…</option>
              {availableCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as CompanyRole)} className={`${inputCls} w-auto`}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button
              type="button"
              disabled={isPending || !addCompanyId}
              onClick={() => run(() => assignMembership({ userId: user.id, companyId: addCompanyId, role: addRole }), () => setAddCompanyId(''))}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-400 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Zuordnen
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <p className="text-xs text-slate-500">Nutzer endgültig aus dem System entfernen.</p>
        {confirmDel ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => deleteUser(user.id))}
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
            >
              Wirklich löschen?
            </button>
            <IconBtn title="Abbrechen" onClick={() => setConfirmDel(false)}>
              <X className="h-4 w-4" />
            </IconBtn>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" /> Nutzer löschen
          </button>
        )}
      </div>
    </div>
  )
}

// ---- small shared bits ----------------------------------------------

const inputCls =
  'w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function IconBtn({
  children, onClick, title, danger,
}: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 transition-colors ${
        danger ? 'text-rose-300 hover:bg-rose-500/10' : 'text-slate-300 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}
