'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus, User, Mail, ShieldCheck, Building2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AvatarUploadCrop } from '@/components/ui/avatar-upload-crop'
import { useActiveCompanyId, useCan, useTenant } from '@/components/portal/tenant-provider'
import { labelFor } from '@/lib/labels'
import { roleLabel, can, CAPABILITIES, CAPABILITY_LABELS, COMPANY_ROLES } from '@/lib/roles'
import { cn } from '@/lib/utils'

type SettingsRow = Database['public']['Tables']['settings']['Row']
type Tab = 'account' | 'werte'

const SETTINGS_CATEGORIES = [
  { key: 'vehicle_statuses', label: 'Fahrzeug-Status', description: 'z. B. Aktiv, In Wartung, Außer Betrieb' },
  { key: 'document_types', label: 'Dokumententypen', description: 'z. B. P-Schein, Hauptuntersuchung, Versicherung' },
  { key: 'document_statuses', label: 'Dokumenten-Status', description: 'z. B. Gültig, Läuft bald ab, Abgelaufen' },
  { key: 'incident_types', label: 'Vorfalltypen', description: 'z. B. Schäden, Bußgelder, Sperrungen' },
  { key: 'incident_severities', label: 'Vorfall-Prioritäten', description: 'z. B. Niedrig, Mittel, Hoch' },
  { key: 'incident_statuses', label: 'Vorfall-Status', description: 'z. B. Offen, In Bearbeitung, Gelöst' },
  { key: 'uber_zones', label: 'Uber-Zonen', description: 'Auswählbare Zonen in der Disposition, z. B. Innenstadt, Flughafen' },
]

interface SettingsCrudProps {
  initialSettings: SettingsRow[]
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  role: string
  avatarUrl: string | null
  lastSignInAt: string | null
}

function SettingsCrudInner({
  initialSettings,
  userId,
  firstName,
  lastName,
  email,
  avatarUrl: initialAvatarUrl,
  lastSignInAt,
}: SettingsCrudProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const canManageSettings = useCan('manageSettings')
  const { activeCompany, isSuperadmin } = useTenant()
  const roleDisplay = isSuperadmin ? 'Superadmin' : roleLabel(activeCompany.role)

  const urlTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(
    urlTab === 'werte' && canManageSettings ? 'werte' : 'account',
  )

  // Sync state when URL changes (sidebar navigation). The "Werte & Status"
  // tab is reserved for roles with the manageSettings capability.
  useEffect(() => {
    const wantsWerte = searchParams.get('tab') === 'werte'
    setActiveTab(wantsWerte && canManageSettings ? 'werte' : 'account')
  }, [searchParams, canManageSettings])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    router.replace(`/einstellungen?tab=${tab}`, { scroll: false })
  }

  // --- Account state ---
  const [profileAvatar, setProfileAvatar] = useState<string | null>(initialAvatarUrl)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unbekannt'

  async function handleAvatarChange(url: string | null) {
    setProfileAvatar(url)
    setIsSavingAvatar(true)
    setAvatarSaved(false)
    setAvatarError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId)
    if (error) {
      setAvatarError(error.message)
    } else {
      setAvatarSaved(true)
      setTimeout(() => setAvatarSaved(false), 3000)
    }
    setIsSavingAvatar(false)
  }

  // --- Passwort & Sitzung ---
  const [newPassword, setNewPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword.length < 8) {
      setPwMsg({ ok: false, text: 'Das Passwort muss mindestens 8 Zeichen haben.' })
      return
    }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwBusy(false)
    if (error) setPwMsg({ ok: false, text: error.message })
    else {
      setNewPassword('')
      setPwMsg({ ok: true, text: 'Passwort aktualisiert.' })
    }
  }

  async function handleSignOutEverywhere() {
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = '/login'
  }

  // --- Settings state ---
  const [settings, setSettings] = useState<SettingsRow[]>(initialSettings)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newValues, setNewValues] = useState<Record<string, string>>({})
  const showBusySpinner = useDelayedLoading(isBusy)

  async function refreshSettings() {
    const { data, error: fetchError } = await supabase
      .from('settings')
      .select('*')
      .eq('company_id', companyId)
    if (fetchError) { setError(fetchError.message); return }
    setSettings(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('settings-crud-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        void refreshSettings()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase])

  function getValues(key: string): string[] {
    const s = settings.find((s) => s.key === key)
    if (!s || !s.value || !Array.isArray(s.value)) return []
    return s.value as string[]
  }

  async function updateSetting(key: string, values: string[]) {
    setIsBusy(true)
    setError(null)
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({ company_id: companyId, key, value: values }, { onConflict: 'company_id,key' })
    if (upsertError) setError(upsertError.message)
    await refreshSettings()
    setIsBusy(false)
  }

  async function handleAdd(key: string) {
    const val = (newValues[key] || '').trim()
    if (!val) return
    const current = getValues(key)
    if (current.includes(val)) { setNewValues((p) => ({ ...p, [key]: '' })); return }
    await updateSetting(key, [...current, val])
    setNewValues((p) => ({ ...p, [key]: '' }))
  }

  async function handleRemove(key: string, val: string) {
    await updateSetting(key, getValues(key).filter((v) => v !== val))
  }

  return (
    <div className="space-y-6 animate-fade-up-delay">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-fit">
        {([
          { id: 'account' as Tab, label: 'Account' },
          ...(canManageSettings ? [{ id: 'werte' as Tab, label: 'Werte & Status' }] : []),
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Account Tab ── */}
      {activeTab === 'account' && (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[340px_1fr]">

          {/* Profile card */}
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Dein Nutzerbild und Anzeigename</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/50 p-6 text-center">
                <AvatarUploadCrop value={profileAvatar} onChange={handleAvatarChange} pathPrefix="profiles" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fullName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
                  <Badge variant="secondary" className="mt-2">
                    {roleDisplay}
                  </Badge>
                </div>
                {isSavingAvatar && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Wird gespeichert…
                  </p>
                )}
                {avatarSaved && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Profilbild gespeichert ✓</p>}
                {avatarError && <p className="text-xs text-red-600 dark:text-red-400">{avatarError}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Account details */}
          <div className="space-y-6">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Accountdetails</CardTitle>
                <CardDescription>Deine persönlichen Accountinformationen</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { icon: User, label: 'Name', value: fullName },
                  { icon: Mail, label: 'E-Mail', value: email },
                  { icon: ShieldCheck, label: 'Rolle', value: roleDisplay },
                  { icon: Building2, label: 'Unternehmen', value: activeCompany.name },
                  {
                    icon: Clock,
                    label: 'Letzte Anmeldung',
                    value: lastSignInAt
                      ? new Date(lastSignInAt).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        }) + ' Uhr'
                      : '–',
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-4 py-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Sicherheit</CardTitle>
                <CardDescription>Passwort ändern und Sitzungen verwalten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleChangePassword} className="space-y-2">
                  <label htmlFor="new-password" className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Neues Passwort
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="mind. 8 Zeichen"
                      autoComplete="new-password"
                    />
                    <Button type="submit" disabled={pwBusy || newPassword.length < 8}>
                      {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ändern'}
                    </Button>
                  </div>
                  {pwMsg && (
                    <p className={cn('text-sm', pwMsg.ok ? 'text-brand-700 dark:text-brand-300' : 'text-rose-600 dark:text-rose-400')}>{pwMsg.text}</p>
                  )}
                </form>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Aktive Sitzungen</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Auf allen Geräten abmelden</p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleSignOutEverywhere()}>
                    Überall abmelden
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Rechte-Übersicht</CardTitle>
                <CardDescription>Welche Rolle was darf</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/60">
                      <th className="py-2 pr-3 text-left font-medium text-slate-500 dark:text-slate-400">Berechtigung</th>
                      {COMPANY_ROLES.map((r) => (
                        <th key={r} className="px-2 py-2 text-center font-medium text-slate-500 dark:text-slate-400">{roleLabel(r)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CAPABILITIES.map((cap) => (
                      <tr key={cap} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{CAPABILITY_LABELS[cap]}</td>
                        {COMPANY_ROLES.map((r) => (
                          <td key={r} className="px-2 py-2 text-center">
                            {can(r, cap) ? (
                              <span className="text-brand-700 dark:text-brand-300">✓</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Werte & Status Tab ── */}
      {activeTab === 'werte' && (
        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            {SETTINGS_CATEGORIES.map((cat) => {
              const values = getValues(cat.key)
              return (
                <Card key={cat.key} className="surface-card">
                  <CardHeader>
                    <CardTitle className="text-base">{cat.label}</CardTitle>
                    <CardDescription className="text-xs">{cat.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Neuer Wert…"
                        value={newValues[cat.key] || ''}
                        onChange={(e) => setNewValues((p) => ({ ...p, [cat.key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); void handleAdd(cat.key) }
                        }}
                        disabled={isBusy}
                        className="border-slate-300 dark:border-slate-600"
                      />
                      <Button
                        onClick={() => void handleAdd(cat.key)}
                        disabled={isBusy || !(newValues[cat.key] || '').trim()}
                        size="sm"
                        className="shrink-0"
                      >
                        {showBusySpinner ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {values.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700/60 p-4 text-center text-sm italic text-slate-400">
                        Noch keine Werte konfiguriert.
                      </p>
                    ) : (
                      <ul className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {values.map((val) => (
                          <li
                            key={val}
                            className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                          >
                            <span className="font-medium text-slate-900 dark:text-slate-100">{labelFor(val)}</span>
                            <button
                              type="button"
                              onClick={() => void handleRemove(cat.key, val)}
                              disabled={isBusy}
                              className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              Entfernen
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function SettingsCrud(props: SettingsCrudProps) {
  return (
    <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}>
      <SettingsCrudInner {...props} />
    </Suspense>
  )
}
