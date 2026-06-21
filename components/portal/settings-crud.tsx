'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus, User, Mail, ShieldCheck, Phone, Building2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AvatarUploadCrop } from '@/components/ui/avatar-upload-crop'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'
import { cn } from '@/lib/utils'

type SettingsRow = Database['public']['Tables']['settings']['Row']
type Tab = 'account' | 'werte'

const SETTINGS_CATEGORIES = [
  { key: 'vehicle_statuses', label: 'Fahrzeug-Status', description: 'z. B. active, maintenance, offline' },
  { key: 'document_types', label: 'Dokumententypen', description: 'z. B. TÜV, Führerschein, Versicherung' },
  { key: 'document_statuses', label: 'Dokumenten-Status', description: 'z. B. valid, expiring, expired' },
  { key: 'incident_types', label: 'Vorfalltypen', description: 'z. B. Unfall, Schaden, Bußgeld' },
  { key: 'incident_severities', label: 'Vorfall-Prioritäten', description: 'z. B. low, medium, high' },
  { key: 'incident_statuses', label: 'Vorfall-Status', description: 'z. B. offen, in Bearbeitung, geschlossen' },
]

interface SettingsCrudProps {
  initialSettings: SettingsRow[]
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  role: string
  avatarUrl: string | null
}

function SettingsCrudInner({
  initialSettings,
  userId,
  firstName,
  lastName,
  email,
  role,
  avatarUrl: initialAvatarUrl,
}: SettingsCrudProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const urlTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(urlTab === 'werte' ? 'werte' : 'account')

  // Sync state when URL changes (sidebar navigation)
  useEffect(() => {
    const tab = searchParams.get('tab') === 'werte' ? 'werte' : 'account'
    setActiveTab(tab)
  }, [searchParams])

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
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {([
          { id: 'account' as Tab, label: 'Account' },
          { id: 'werte' as Tab, label: 'Werte & Status' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Account Tab ── */}
      {activeTab === 'account' && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">

          {/* Profile card */}
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Dein Nutzerbild und Anzeigename</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-center">
                <AvatarUploadCrop value={profileAvatar} onChange={handleAvatarChange} />
                <div>
                  <p className="text-lg font-bold text-slate-900">{fullName}</p>
                  <p className="text-sm text-slate-500">{email}</p>
                  <Badge variant="secondary" className="mt-2">
                    {role === 'admin' ? 'Administrator' : role}
                  </Badge>
                </div>
                {isSavingAvatar && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Wird gespeichert…
                  </p>
                )}
                {avatarSaved && <p className="text-xs text-emerald-600 font-medium">Profilbild gespeichert ✓</p>}
                {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
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
              <CardContent className="divide-y divide-slate-100">
                {[
                  { icon: User, label: 'Name', value: fullName },
                  { icon: Mail, label: 'E-Mail', value: email },
                  { icon: ShieldCheck, label: 'Rolle', value: role === 'admin' ? 'Administrator' : role },
                  { icon: Building2, label: 'Abteilung', value: 'Flottenmanagement' },
                  { icon: Phone, label: 'Telefon', value: '+49 151 000 0000' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-4 py-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="truncate text-sm font-medium text-slate-900">{value}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Zugangsdaten</CardTitle>
                <CardDescription>Sicherheit und Sitzungsinformationen</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                <div className="flex items-center gap-4 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Passwort</p>
                    <p className="text-sm font-medium text-slate-900">••••••••••••</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Letzte Anmeldung</p>
                    <p className="text-sm font-medium text-slate-900">Heute, 08:32 Uhr</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Werte & Status Tab ── */}
      {activeTab === 'werte' && (
        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
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
                        className="border-slate-300"
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
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm italic text-slate-400">
                        Noch keine Werte konfiguriert.
                      </p>
                    ) : (
                      <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                        {values.map((val) => (
                          <li
                            key={val}
                            className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <span className="font-medium text-slate-900">{val}</span>
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
    <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-slate-100" />}>
      <SettingsCrudInner {...props} />
    </Suspense>
  )
}
