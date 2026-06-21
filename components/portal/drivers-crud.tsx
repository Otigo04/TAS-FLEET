'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, X, Search, Filter, User, Download } from 'lucide-react'
import { AvatarUploadCrop } from '@/components/ui/avatar-upload-crop'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type DriverInsert = Database['public']['Tables']['drivers']['Insert']
type DriverUpdate = Database['public']['Tables']['drivers']['Update']

interface DriversCrudProps {
  initialDrivers: DriverRow[]
}

const shifts = ['Frueh', 'Spaet', 'Nacht']

function shiftLabel(shift: string) {
  if (shift === 'Frueh') return 'Früh'
  if (shift === 'Spaet') return 'Spät'
  return shift
}

function shiftVariant(shift: string): 'secondary' | 'warning' | 'danger' {
  if (shift === 'Frueh') return 'secondary'
  if (shift === 'Spaet') return 'warning'
  return 'danger'
}

export function DriversCrud({ initialDrivers }: DriversCrudProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const [drivers, setDrivers] = useState<DriverRow[]>(initialDrivers)
  const [isBusy, setIsBusy] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [filterShift, setFilterShift] = useState('alle')
  const [filterDistrict, setFilterDistrict] = useState('alle')
  const [showAddForm, setShowAddForm] = useState(false)

  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [street, setStreet] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [nationality, setNationality] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [taxClass, setTaxClass] = useState('')
  const [taxId, setTaxId] = useState('')
  const [socialSecurityNumber, setSocialSecurityNumber] = useState('')
  const [healthInsurance, setHealthInsurance] = useState('')
  const [employmentStartDate, setEmploymentStartDate] = useState('')
  const [employedAs, setEmployedAs] = useState('')
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')
  const [pscheinValidUntil, setPscheinValidUntil] = useState('')
  const [district, setDistrict] = useState('')
  const [currentShift, setCurrentShift] = useState(shifts[0])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [noteInput, setNoteInput] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editStreet, setEditStreet] = useState('')
  const [editStreetNumber, setEditStreetNumber] = useState('')
  const [editPostalCode, setEditPostalCode] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editNationality, setEditNationality] = useState('')
  const [editMaritalStatus, setEditMaritalStatus] = useState('')
  const [editTaxClass, setEditTaxClass] = useState('')
  const [editTaxId, setEditTaxId] = useState('')
  const [editSocialSecurityNumber, setEditSocialSecurityNumber] = useState('')
  const [editHealthInsurance, setEditHealthInsurance] = useState('')
  const [editEmploymentStartDate, setEditEmploymentStartDate] = useState('')
  const [editEmployedAs, setEditEmployedAs] = useState('')
  const [editBankName, setEditBankName] = useState('')
  const [editIban, setEditIban] = useState('')
  const [editPscheinValidUntil, setEditPscheinValidUntil] = useState('')
  const [editDistrict, setEditDistrict] = useState('')
  const [editCurrentShift, setEditCurrentShift] = useState(shifts[0])
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState<string[]>([])
  const [editNoteInput, setEditNoteInput] = useState('')
  const showBusySpinner = useDelayedLoading(isBusy)
  const showImportSpinner = useDelayedLoading(isImporting)

  async function refreshDrivers() {
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setDrivers(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('drivers-crud-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        void refreshDrivers()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setError(null)

    const payload: DriverInsert = {
      company_id: companyId,
      name,
      first_name: firstName || null,
      last_name: lastName || null,
      street: street || null,
      street_number: streetNumber || null,
      postal_code: postalCode || null,
      city: city || null,
      birth_date: birthDate || null,
      nationality: nationality || null,
      marital_status: maritalStatus || null,
      tax_class: taxClass || null,
      tax_id: taxId || null,
      social_security_number: socialSecurityNumber || null,
      health_insurance: healthInsurance || null,
      employment_start_date: employmentStartDate || null,
      employed_as: employedAs || null,
      bank_name: bankName || null,
      iban: iban || null,
      pschein_valid_until: pscheinValidUntil || null,
      district: district || null,
      current_shift: currentShift,
      notes,
      avatar_url: avatarUrl,
    }

    const { error: insertError } = await supabase.from('drivers').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    await refreshDrivers()

    setName('')
    setFirstName('')
    setLastName('')
    setStreet('')
    setStreetNumber('')
    setPostalCode('')
    setCity('')
    setBirthDate('')
    setNationality('')
    setMaritalStatus('')
    setTaxClass('')
    setTaxId('')
    setSocialSecurityNumber('')
    setHealthInsurance('')
    setEmploymentStartDate('')
    setEmployedAs('')
    setBankName('')
    setIban('')
    setPscheinValidUntil('')
    setDistrict('')
    setCurrentShift(shifts[0])
    setAvatarUrl(null)
    setNotes([])
    setNoteInput('')
    setIsBusy(false)
    setShowAddForm(false)
  }

  function addCreateNote() {
    const value = noteInput.trim()
    if (!value) return
    setNotes((prev) => [...prev, value])
    setNoteInput('')
  }

  function removeCreateNote(index: number) {
    setNotes((prev) => prev.filter((_, i) => i !== index))
  }

  function addEditNote() {
    const value = editNoteInput.trim()
    if (!value) return
    setEditNotes((prev) => [...prev, value])
    setEditNoteInput('')
  }

  function removeEditNote(index: number) {
    setEditNotes((prev) => prev.filter((_, i) => i !== index))
  }

  function startEdit(driver: DriverRow) {
    setEditingId(driver.id)
    setEditName(driver.name)
    setEditFirstName(driver.first_name ?? '')
    setEditLastName(driver.last_name ?? '')
    setEditStreet(driver.street ?? '')
    setEditStreetNumber(driver.street_number ?? '')
    setEditPostalCode(driver.postal_code ?? '')
    setEditCity(driver.city ?? '')
    setEditBirthDate(driver.birth_date ?? '')
    setEditNationality(driver.nationality ?? '')
    setEditMaritalStatus(driver.marital_status ?? '')
    setEditTaxClass(driver.tax_class ?? '')
    setEditTaxId(driver.tax_id ?? '')
    setEditSocialSecurityNumber(driver.social_security_number ?? '')
    setEditHealthInsurance(driver.health_insurance ?? '')
    setEditEmploymentStartDate(driver.employment_start_date ?? '')
    setEditEmployedAs(driver.employed_as ?? '')
    setEditBankName(driver.bank_name ?? '')
    setEditIban(driver.iban ?? '')
    setEditPscheinValidUntil(driver.pschein_valid_until ?? '')
    setEditDistrict(driver.district ?? '')
    setEditCurrentShift(driver.current_shift)
    setEditAvatarUrl(driver.avatar_url)
    setEditNotes(driver.notes ?? [])
    setEditNoteInput('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditNotes([])
    setEditNoteInput('')
  }

  async function handleSave(id: string) {
    setIsBusy(true)
    setError(null)

    const payload: DriverUpdate = {
      name: editName,
      first_name: editFirstName || null,
      last_name: editLastName || null,
      street: editStreet || null,
      street_number: editStreetNumber || null,
      postal_code: editPostalCode || null,
      city: editCity || null,
      birth_date: editBirthDate || null,
      nationality: editNationality || null,
      marital_status: editMaritalStatus || null,
      tax_class: editTaxClass || null,
      tax_id: editTaxId || null,
      social_security_number: editSocialSecurityNumber || null,
      health_insurance: editHealthInsurance || null,
      employment_start_date: editEmploymentStartDate || null,
      employed_as: editEmployedAs || null,
      bank_name: editBankName || null,
      iban: editIban || null,
      pschein_valid_until: editPscheinValidUntil || null,
      district: editDistrict || null,
      current_shift: editCurrentShift,
      notes: editNotes,
      avatar_url: editAvatarUrl,
    }

    const { error: updateError } = await supabase.from('drivers').update(payload).eq('id', id)

    if (updateError) {
      setError(updateError.message)
      setIsBusy(false)
      return
    }

    setEditingId(null)
    setIsBusy(false)
  }

  async function handleDelete(id: string) {
    setIsBusy(true)
    setError(null)

    const { error: deleteError } = await supabase.from('drivers').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      setIsBusy(false)
      return
    }

    setConfirmDeleteId(null)
    setIsBusy(false)
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setImportStatus(null)
    setImportWarnings([])

    if (!importFile) {
      setError('Bitte zuerst ein Personalstammblatt auswählen.')
      return
    }

    setIsImporting(true)

    const body = new FormData()
    body.append('file', importFile)

    try {
      const response = await fetch('/api/import-driver-sheet', {
        method: 'POST',
        body,
      })

      const result = (await response.json()) as {
        error?: string
        warnings?: string[]
        driver?: DriverRow
      }

      if (!response.ok) {
        setError(result.error ?? 'Import fehlgeschlagen.')
        setImportWarnings(result.warnings ?? [])
        setIsImporting(false)
        return
      }

      setImportFile(null)
      setImportWarnings(result.warnings ?? [])
      setImportStatus(result.driver ? `Import erfolgreich: ${result.driver.name}` : 'Import erfolgreich.')
      if (result.driver) {
        setName(result.driver.name)
        setFirstName(result.driver.first_name ?? '')
        setLastName(result.driver.last_name ?? '')
        setStreet(result.driver.street ?? '')
        setStreetNumber(result.driver.street_number ?? '')
        setPostalCode(result.driver.postal_code ?? '')
        setCity(result.driver.city ?? '')
        setBirthDate(result.driver.birth_date ?? '')
        setNationality(result.driver.nationality ?? '')
        setMaritalStatus(result.driver.marital_status ?? '')
        setTaxClass(result.driver.tax_class ?? '')
        setTaxId(result.driver.tax_id ?? '')
        setSocialSecurityNumber(result.driver.social_security_number ?? '')
        setHealthInsurance(result.driver.health_insurance ?? '')
        setEmploymentStartDate(result.driver.employment_start_date ?? '')
        setEmployedAs(result.driver.employed_as ?? '')
        setBankName(result.driver.bank_name ?? '')
        setIban(result.driver.iban ?? '')
        setPscheinValidUntil(result.driver.pschein_valid_until ?? '')
        setDistrict(result.driver.district ?? '')
        setCurrentShift(result.driver.current_shift)
      }
      await refreshDrivers()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import fehlgeschlagen.')
    } finally {
      setIsImporting(false)
    }
  }

  const districtOptions = Array.from(
    new Set(drivers.map((driver) => driver.district).filter((d): d is string => !!d))
  ).sort()
  const filteredDrivers = drivers.filter((driver) => {
    const matchSearch =
      search.trim().length === 0 ||
      driver.name.toLowerCase().includes(search.toLowerCase()) ||
      (driver.notes ?? []).some((note) => note.toLowerCase().includes(search.toLowerCase()))

    const matchShift = filterShift === 'alle' || driver.current_shift === filterShift
    const matchDistrict = filterDistrict === 'alle' || driver.district === filterDistrict

    return matchSearch && matchShift && matchDistrict
  })

  function exportToCsv() {
    if (filteredDrivers.length === 0) return

    const headers = ['Name', 'Vorname', 'Nachname', 'Bezirk', 'Schicht', 'P-Schein bis', 'Geburtsdatum', 'Eintritt am', 'Beschäftigt als']
    const rows = filteredDrivers.map(d => [
      d.name,
      d.first_name || '',
      d.last_name || '',
      d.district || '',
      d.current_shift,
      d.pschein_valid_until || '',
      d.birth_date || '',
      d.employment_start_date || '',
      d.employed_as || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Fahrer_Export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="animate-fade-up-delay space-y-6">
      
      {/* Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative w-full max-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 bg-slate-50/50 border-slate-300"
              placeholder="Suchen..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="relative flex-1 min-w-[140px] max-w-[180px]">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-slate-50/50 pl-9 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={filterShift}
              onChange={(event) => setFilterShift(event.target.value)}
            >
              <option value="alle">Alle Schichten</option>
              {shifts.map((shift) => (
                <option key={shift} value={shift}>
                  {shiftLabel(shift)}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 min-w-[140px] max-w-[180px]">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-slate-50/50 pl-9 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={filterDistrict}
              onChange={(event) => setFilterDistrict(event.target.value)}
            >
              <option value="alle">Alle Bezirke</option>
              {districtOptions.map((districtOption) => (
                <option key={districtOption} value={districtOption}>
                  {districtOption}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={exportToCsv} disabled={filteredDrivers.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{showAddForm ? 'Schließen' : 'Neuen Fahrer anlegen'}</span>
            <span className="sm:hidden">{showAddForm ? 'Zu' : 'Neu'}</span>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">{error}</p> : null}

      {/* Add Form Container */}
      {showAddForm && (
        <Card className="border-slate-200 shadow-lg bg-white overflow-hidden transition-all duration-300">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80">
            <CardTitle className="text-xl text-slate-900">Neuen Fahrer anlegen</CardTitle>
            <CardDescription className="text-slate-600">
              Personalstammblatt importieren oder Daten manuell eintragen.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid gap-8 xl:grid-cols-[1fr_2fr]">
            
            <form onSubmit={handleImport} className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-5 self-start">
              <div>
                <Label htmlFor="driver-sheet" className="text-blue-900 font-semibold mb-1 block">Smart Import</Label>
                <p className="text-xs text-blue-700 mb-3">PDF oder Bild hochladen. Daten werden automatisch ausgelesen.</p>
                <Input
                  id="driver-sheet"
                  type="file"
                  accept=".pdf,image/*"
                  className="bg-white border-blue-200"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
              </div>

              <Button type="submit" variant="secondary" className="w-full bg-white hover:bg-blue-50 text-blue-900 border-blue-200" disabled={isImporting}>
                {showImportSpinner ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isImporting ? 'Wird ausgelesen...' : 'Stammblatt auslesen'}
              </Button>

              {importStatus ? <p className="text-sm font-medium text-emerald-700 mt-2">{importStatus}</p> : null}
              {importWarnings.length > 0 ? (
                <ul className="space-y-1 text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                  {importWarnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>- {warning}</li>
                  ))}
                </ul>
              ) : null}
            </form>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-700">Profilbild (optional)</Label>
                <AvatarUploadCrop value={avatarUrl} onChange={setAvatarUrl} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-name" className="text-slate-700">Name (Anzeige)</Label>
                <Input id="driver-name" className="border-slate-300 focus-visible:ring-slate-400" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="driver-first-name" className="text-slate-700">Vorname</Label>
                  <Input id="driver-first-name" className="border-slate-300" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-last-name" className="text-slate-700">Nachname</Label>
                  <Input id="driver-last-name" className="border-slate-300" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-street" className="text-slate-700">Straße</Label>
                  <Input id="driver-street" className="border-slate-300" value={street} onChange={(event) => setStreet(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-street-number" className="text-slate-700">Straßennr</Label>
                  <Input id="driver-street-number" className="border-slate-300" value={streetNumber} onChange={(event) => setStreetNumber(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-postal-code" className="text-slate-700">PLZ</Label>
                  <Input id="driver-postal-code" className="border-slate-300" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-city" className="text-slate-700">Ort</Label>
                  <Input id="driver-city" className="border-slate-300" value={city} onChange={(event) => setCity(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-birth-date" className="text-slate-700">Geburtsdatum</Label>
                  <Input id="driver-birth-date" type="text" className="border-slate-300" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-nationality" className="text-slate-700">Staatsangehörigkeit</Label>
                  <Input id="driver-nationality" className="border-slate-300" value={nationality} onChange={(event) => setNationality(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-marital-status" className="text-slate-700">Familienstand</Label>
                  <Input id="driver-marital-status" className="border-slate-300" value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-tax-class" className="text-slate-700">Steuerklasse</Label>
                  <Input id="driver-tax-class" className="border-slate-300" value={taxClass} onChange={(event) => setTaxClass(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-tax-id" className="text-slate-700">Steuer Identifikationsnr</Label>
                  <Input id="driver-tax-id" className="border-slate-300" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-social-security" className="text-slate-700">Sozialversicherungsnr</Label>
                  <Input
                    id="driver-social-security"
                    className="border-slate-300"
                    value={socialSecurityNumber}
                    onChange={(event) => setSocialSecurityNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-health-insurance" className="text-slate-700">Krankenkasse</Label>
                  <Input
                    id="driver-health-insurance"
                    className="border-slate-300"
                    value={healthInsurance}
                    onChange={(event) => setHealthInsurance(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-employment-start" className="text-slate-700">Eintritt am</Label>
                  <Input
                    id="driver-employment-start"
                    type="text"
                    className="border-slate-300"
                    value={employmentStartDate}
                    onChange={(event) => setEmploymentStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-employed-as" className="text-slate-700">Beschäftigt als</Label>
                  <Input id="driver-employed-as" className="border-slate-300" value={employedAs} onChange={(event) => setEmployedAs(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-bank-name" className="text-slate-700">Name der Bank</Label>
                  <Input id="driver-bank-name" className="border-slate-300" value={bankName} onChange={(event) => setBankName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-iban" className="text-slate-700">IBAN</Label>
                  <Input id="driver-iban" className="border-slate-300" value={iban} onChange={(event) => setIban(event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <Label htmlFor="driver-pschein" className="text-slate-700 font-semibold">P-Schein gültig bis</Label>
                  <Input
                    id="driver-pschein"
                    type="text"
                    className="border-slate-300"
                    value={pscheinValidUntil}
                    onChange={(event) => setPscheinValidUntil(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-district" className="text-slate-700 font-semibold">Bezirk</Label>
                  <Input
                    id="driver-district"
                    className="border-slate-300"
                    value={district}
                    onChange={(event) => setDistrict(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-shift" className="text-slate-700 font-semibold">Schicht</Label>
                  <select
                    id="driver-shift"
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={currentShift}
                    onChange={(event) => setCurrentShift(event.target.value)}
                  >
                    {shifts.map((shift) => (
                      <option key={shift} value={shift}>
                        {shiftLabel(shift)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <Label htmlFor="driver-note" className="text-slate-700">Notizpunkte</Label>
                <div className="flex gap-2">
                  <Input
                    id="driver-note"
                    className="border-slate-300"
                    value={noteInput}
                    onChange={(event) => setNoteInput(event.target.value)}
                    placeholder="z. B. bevorzugt Bezirk Zentrum"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCreateNote()
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addCreateNote} className="bg-slate-100 hover:bg-slate-200">
                    Hinzufügen
                  </Button>
                </div>

                {notes.length > 0 ? (
                  <ul className="space-y-2 mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {notes.map((note, index) => (
                      <li key={`${note}-${index}`} className="flex items-center justify-between gap-3 text-sm text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-md shadow-sm">
                        <span>{note}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeCreateNote(index)} className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                          Entfernen
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isBusy} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[160px]">
                  {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Fahrer speichern
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Driver List */}
      <div className="space-y-3">
        {filteredDrivers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <p className="text-slate-500">Keine Fahrer gefunden.</p>
          </div>
        ) : (
          filteredDrivers.map((driver) => {
            const isEditing = editingId === driver.id

            return (
              <Card
                key={driver.id}
                className={`transition-all duration-200 ${isEditing ? 'border-slate-300 shadow-md ring-1 ring-slate-200' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}
              >
                {isEditing ? (
                  <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Fahrer bearbeiten</h3>
                      <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8 px-2 text-slate-500">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Edit form contents... */}
                    <div className="space-y-5">
                      {/* Persönliche Daten */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Persönliche Daten</p>
                        <div className="mb-4 space-y-1.5">
                          <Label className="text-slate-700">Profilbild</Label>
                          <AvatarUploadCrop value={editAvatarUrl} onChange={setEditAvatarUrl} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-name-${driver.id}`}>Name (Anzeige)</Label>
                            <Input id={`edit-name-${driver.id}`} className="bg-white border-slate-300" value={editName} onChange={(event) => setEditName(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-firstname-${driver.id}`}>Vorname</Label>
                            <Input id={`edit-firstname-${driver.id}`} className="bg-white border-slate-300" value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-lastname-${driver.id}`}>Nachname</Label>
                            <Input id={`edit-lastname-${driver.id}`} className="bg-white border-slate-300" value={editLastName} onChange={(event) => setEditLastName(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-birthdate-${driver.id}`}>Geburtsdatum</Label>
                            <Input id={`edit-birthdate-${driver.id}`} type="date" className="bg-white border-slate-300" value={editBirthDate} onChange={(event) => setEditBirthDate(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-nationality-${driver.id}`}>Staatsangehörigkeit</Label>
                            <Input id={`edit-nationality-${driver.id}`} className="bg-white border-slate-300" value={editNationality} onChange={(event) => setEditNationality(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-marital-${driver.id}`}>Familienstand</Label>
                            <Input id={`edit-marital-${driver.id}`} className="bg-white border-slate-300" value={editMaritalStatus} onChange={(event) => setEditMaritalStatus(event.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Anschrift */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Anschrift</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-street-${driver.id}`}>Straße</Label>
                            <Input id={`edit-street-${driver.id}`} className="bg-white border-slate-300" value={editStreet} onChange={(event) => setEditStreet(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-streetnr-${driver.id}`}>Hausnummer</Label>
                            <Input id={`edit-streetnr-${driver.id}`} className="bg-white border-slate-300" value={editStreetNumber} onChange={(event) => setEditStreetNumber(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-plz-${driver.id}`}>PLZ</Label>
                            <Input id={`edit-plz-${driver.id}`} className="bg-white border-slate-300" value={editPostalCode} onChange={(event) => setEditPostalCode(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-city-${driver.id}`}>Ort</Label>
                            <Input id={`edit-city-${driver.id}`} className="bg-white border-slate-300" value={editCity} onChange={(event) => setEditCity(event.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Steuer & Sozialversicherung */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Steuer &amp; Sozialversicherung</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-taxclass-${driver.id}`}>Steuerklasse</Label>
                            <Input id={`edit-taxclass-${driver.id}`} className="bg-white border-slate-300" value={editTaxClass} onChange={(event) => setEditTaxClass(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-taxid-${driver.id}`}>Steuer-Identifikationsnummer</Label>
                            <Input id={`edit-taxid-${driver.id}`} className="bg-white border-slate-300" value={editTaxId} onChange={(event) => setEditTaxId(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-svnr-${driver.id}`}>Sozialversicherungsnummer</Label>
                            <Input id={`edit-svnr-${driver.id}`} className="bg-white border-slate-300" value={editSocialSecurityNumber} onChange={(event) => setEditSocialSecurityNumber(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-kk-${driver.id}`}>Krankenkasse</Label>
                            <Input id={`edit-kk-${driver.id}`} className="bg-white border-slate-300" value={editHealthInsurance} onChange={(event) => setEditHealthInsurance(event.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Beschäftigung */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Beschäftigung</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-eintritt-${driver.id}`}>Eintritt am</Label>
                            <Input id={`edit-eintritt-${driver.id}`} type="date" className="bg-white border-slate-300" value={editEmploymentStartDate} onChange={(event) => setEditEmploymentStartDate(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-employed-${driver.id}`}>Beschäftigt als</Label>
                            <Input id={`edit-employed-${driver.id}`} className="bg-white border-slate-300" value={editEmployedAs} onChange={(event) => setEditEmployedAs(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-pschein-${driver.id}`} className="font-semibold text-slate-700">P-Schein gültig bis *</Label>
                            <Input id={`edit-pschein-${driver.id}`} type="date" className="bg-white border-slate-300" value={editPscheinValidUntil} onChange={(event) => setEditPscheinValidUntil(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-district-${driver.id}`} className="font-semibold text-slate-700">Bezirk *</Label>
                            <Input id={`edit-district-${driver.id}`} className="bg-white border-slate-300" value={editDistrict} onChange={(event) => setEditDistrict(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-shift-${driver.id}`} className="font-semibold text-slate-700">Schicht *</Label>
                            <select
                              id={`edit-shift-${driver.id}`}
                              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              value={editCurrentShift}
                              onChange={(event) => setEditCurrentShift(event.target.value)}
                            >
                              {shifts.map((shift) => (
                                <option key={shift} value={shift}>
                                  {shiftLabel(shift)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Bankverbindung */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
                        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Bankverbindung</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-bank-${driver.id}`}>Name der Bank</Label>
                            <Input id={`edit-bank-${driver.id}`} className="bg-white border-slate-300" value={editBankName} onChange={(event) => setEditBankName(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-iban-${driver.id}`}>IBAN</Label>
                            <Input id={`edit-iban-${driver.id}`} className="bg-white border-slate-300" value={editIban} onChange={(event) => setEditIban(event.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Notizpunkte */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5 space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notizpunkte</p>
                        <div className="flex gap-2">
                          <Input
                            id={`edit-driver-note-${driver.id}`}
                            className="bg-white border-slate-300"
                            value={editNoteInput}
                            onChange={(event) => setEditNoteInput(event.target.value)}
                            placeholder="Neuen Punkt hinzufügen"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addEditNote()
                              }
                            }}
                          />
                          <Button type="button" variant="secondary" onClick={addEditNote} className="bg-white border border-slate-200 hover:bg-slate-50">
                            Hinzufügen
                          </Button>
                        </div>

                        {editNotes.length > 0 ? (
                          <ul className="space-y-2 mt-2">
                            {editNotes.map((note, index) => (
                              <li
                                key={`${note}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                              >
                                <span>{note}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeEditNote(index)} className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                                  Entfernen
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-500 italic">Noch keine Notizpunkte vorhanden.</p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={cancelEdit} disabled={isBusy}>
                          Abbrechen
                        </Button>
                        <Button onClick={() => void handleSave(driver.id)} disabled={isBusy} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px]">
                          {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Änderungen speichern
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="p-4 sm:p-5 flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="space-y-3 flex items-start gap-4">
                      {driver.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={driver.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200 mt-1" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200/50 mt-1">
                          <User className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-lg text-slate-900">
                            {[driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.name}
                          </h4>
                          <Badge variant={shiftVariant(driver.current_shift)} className="px-2 py-0.5">{shiftLabel(driver.current_shift)}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 font-medium">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Bezirk: {driver.district || 'Nicht angegeben'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            P-Schein: <span className={driver.pschein_valid_until && new Date(driver.pschein_valid_until).getTime() < Date.now() + 60 * 24 * 60 * 60 * 1000 ? 'text-amber-600 font-bold' : ''}>
                              {driver.pschein_valid_until ? new Date(driver.pschein_valid_until).toLocaleDateString('de-DE') : 'Nicht angegeben'}
                            </span>
                          </span>
                        </div>

                        {driver.notes && driver.notes.length > 0 ? (
                          <div className="flex gap-2 flex-wrap pt-2">
                            {driver.notes.map((note, index) => (
                              <span key={`${driver.id}-note-${index}`} className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                                {note}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:self-center">
                      <Button variant="outline" size="sm" onClick={() => startEdit(driver)} disabled={isBusy} className="bg-white">
                        Bearbeiten
                      </Button>
                      {confirmDeleteId === driver.id ? (
                        <div className="flex items-center gap-2 bg-red-50 p-1 rounded-md border border-red-100">
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(driver.id)} disabled={isBusy}>
                            {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Wirklich löschen?
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isBusy} className="hover:bg-red-100 text-slate-700">
                            Abbrechen
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(driver.id)} disabled={isBusy} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          Löschen
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>
    </section>
  )
}
