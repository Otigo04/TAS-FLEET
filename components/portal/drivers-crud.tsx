'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type DriverInsert = Database['public']['Tables']['drivers']['Insert']
type DriverUpdate = Database['public']['Tables']['drivers']['Update']

interface DriversCrudProps {
  initialDrivers: DriverRow[]
}

const shifts = ['Frueh', 'Spaet', 'Nacht']

function shiftVariant(shift: string): 'secondary' | 'warning' | 'danger' {
  if (shift === 'Frueh') return 'secondary'
  if (shift === 'Spaet') return 'warning'
  return 'danger'
}

export function DriversCrud({ initialDrivers }: DriversCrudProps) {
  const supabase = useMemo(() => createClient(), [])

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
  const [notes, setNotes] = useState<string[]>([])
  const [noteInput, setNoteInput] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
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
  const [editNotes, setEditNotes] = useState<string[]>([])
  const [editNoteInput, setEditNoteInput] = useState('')

  async function refreshDrivers() {
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('*')
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
      pschein_valid_until: pscheinValidUntil,
      district,
      current_shift: currentShift,
      notes,
    }

    const { error: insertError } = await supabase.from('drivers').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

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
    setNotes([])
    setNoteInput('')
    setIsBusy(false)
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
    setEditPscheinValidUntil(driver.pschein_valid_until)
    setEditDistrict(driver.district)
    setEditCurrentShift(driver.current_shift)
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
      pschein_valid_until: editPscheinValidUntil,
      district: editDistrict,
      current_shift: editCurrentShift,
      notes: editNotes,
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

    setIsBusy(false)
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setImportStatus(null)
    setImportWarnings([])

    if (!importFile) {
      setError('Bitte zuerst ein Personalstammblatt auswaehlen.')
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
        setPscheinValidUntil(result.driver.pschein_valid_until)
        setDistrict(result.driver.district)
        setCurrentShift(result.driver.current_shift)
      }
      await refreshDrivers()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import fehlgeschlagen.')
    } finally {
      setIsImporting(false)
    }
  }

  const districtOptions = Array.from(new Set(drivers.map((driver) => driver.district))).sort()
  const filteredDrivers = drivers.filter((driver) => {
    const matchSearch =
      search.trim().length === 0 ||
      driver.name.toLowerCase().includes(search.toLowerCase()) ||
      (driver.notes ?? []).some((note) => note.toLowerCase().includes(search.toLowerCase()))

    const matchShift = filterShift === 'alle' || driver.current_shift === filterShift
    const matchDistrict = filterDistrict === 'alle' || driver.district === filterDistrict

    return matchSearch && matchShift && matchDistrict
  })

  return (
    <section className="animate-fade-up-delay grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Neuen Fahrer anlegen</CardTitle>
          <CardDescription>Neuer Eintrag</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="mb-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="space-y-2">
              <Label htmlFor="driver-sheet">Personalstammblatt importieren</Label>
              <Input
                id="driver-sheet"
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-slate-500">PDF oder Bild hochladen. Daten werden automatisch ausgelesen.</p>
            </div>

            <Button type="submit" variant="secondary" className="w-full" disabled={isImporting}>
              {isImporting ? 'Import laeuft...' : 'Stammblatt lesen und Fahrer anlegen'}
            </Button>

            {importStatus ? <p className="text-sm text-emerald-700">{importStatus}</p> : null}
            {importWarnings.length > 0 ? (
              <ul className="space-y-1 text-xs text-amber-700">
                {importWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>- {warning}</li>
                ))}
              </ul>
            ) : null}
          </form>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">Name</Label>
              <Input id="driver-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driver-first-name">Vorname</Label>
                <Input id="driver-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-last-name">Nachname</Label>
                <Input id="driver-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-street">Strasse</Label>
                <Input id="driver-street" value={street} onChange={(event) => setStreet(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-street-number">Strassennr</Label>
                <Input id="driver-street-number" value={streetNumber} onChange={(event) => setStreetNumber(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-postal-code">PLZ</Label>
                <Input id="driver-postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-city">Ort</Label>
                <Input id="driver-city" value={city} onChange={(event) => setCity(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-birth-date">Geburtsdatum</Label>
                <Input id="driver-birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-nationality">Staatsangehoerigkeit</Label>
                <Input id="driver-nationality" value={nationality} onChange={(event) => setNationality(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-marital-status">Familienstand</Label>
                <Input id="driver-marital-status" value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-tax-class">Steuerklasse</Label>
                <Input id="driver-tax-class" value={taxClass} onChange={(event) => setTaxClass(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-tax-id">Steuer Identifikationsnummer</Label>
                <Input id="driver-tax-id" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-social-security">Sozialversicherungsnummer</Label>
                <Input
                  id="driver-social-security"
                  value={socialSecurityNumber}
                  onChange={(event) => setSocialSecurityNumber(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-health-insurance">Krankenkasse</Label>
                <Input
                  id="driver-health-insurance"
                  value={healthInsurance}
                  onChange={(event) => setHealthInsurance(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-employment-start">Eintritt am</Label>
                <Input
                  id="driver-employment-start"
                  type="date"
                  value={employmentStartDate}
                  onChange={(event) => setEmploymentStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-employed-as">Beschaeftigt als</Label>
                <Input id="driver-employed-as" value={employedAs} onChange={(event) => setEmployedAs(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-bank-name">Name der Bank</Label>
                <Input id="driver-bank-name" value={bankName} onChange={(event) => setBankName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-iban">IBAN</Label>
                <Input id="driver-iban" value={iban} onChange={(event) => setIban(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-pschein">P-Schein gueltig bis</Label>
              <Input
                id="driver-pschein"
                type="date"
                value={pscheinValidUntil}
                onChange={(event) => setPscheinValidUntil(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-district">Bezirk</Label>
              <Input
                id="driver-district"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-shift">Schicht</Label>
              <select
                id="driver-shift"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={currentShift}
                onChange={(event) => setCurrentShift(event.target.value)}
              >
                {shifts.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-note">Notizpunkt</Label>
              <div className="flex gap-2">
                <Input
                  id="driver-note"
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  placeholder="z. B. bevorzugt Bezirk Zentrum"
                />
                <Button type="button" variant="secondary" onClick={addCreateNote}>
                  Hinzufuegen
                </Button>
              </div>

              {notes.length > 0 ? (
                <ul className="space-y-2 rounded-md border border-slate-200/80 bg-white/70 p-3">
                  {notes.map((note, index) => (
                    <li key={`${note}-${index}`} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                      <span>{note}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeCreateNote(index)}>
                        Entfernen
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              Fahrer speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Fahrerliste</CardTitle>
          <CardDescription>Eintraege</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 rounded-lg border border-slate-200/80 bg-white/70 p-3 md:grid-cols-3">
            <Input
              placeholder="Suche Name oder Notiz"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={filterShift}
              onChange={(event) => setFilterShift(event.target.value)}
            >
              <option value="alle">Alle Schichten</option>
              {shifts.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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

          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          <div className="space-y-4">
            {filteredDrivers.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Fahrer vorhanden.</p>
            ) : (
              filteredDrivers.map((driver) => {
                const isEditing = editingId === driver.id

                return (
                  <div
                    key={driver.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                        <Input value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} placeholder="Vorname" />
                        <Input value={editLastName} onChange={(event) => setEditLastName(event.target.value)} placeholder="Nachname" />
                        <Input value={editStreet} onChange={(event) => setEditStreet(event.target.value)} placeholder="Strasse" />
                        <Input value={editStreetNumber} onChange={(event) => setEditStreetNumber(event.target.value)} placeholder="Strassennr" />
                        <Input value={editPostalCode} onChange={(event) => setEditPostalCode(event.target.value)} placeholder="PLZ" />
                        <Input value={editCity} onChange={(event) => setEditCity(event.target.value)} placeholder="Ort" />
                        <Input type="date" value={editBirthDate} onChange={(event) => setEditBirthDate(event.target.value)} />
                        <Input value={editNationality} onChange={(event) => setEditNationality(event.target.value)} placeholder="Staatsangehoerigkeit" />
                        <Input value={editMaritalStatus} onChange={(event) => setEditMaritalStatus(event.target.value)} placeholder="Familienstand" />
                        <Input value={editTaxClass} onChange={(event) => setEditTaxClass(event.target.value)} placeholder="Steuerklasse" />
                        <Input value={editTaxId} onChange={(event) => setEditTaxId(event.target.value)} placeholder="Steuer Identifikationsnummer" />
                        <Input
                          value={editSocialSecurityNumber}
                          onChange={(event) => setEditSocialSecurityNumber(event.target.value)}
                          placeholder="Sozialversicherungsnummer"
                        />
                        <Input
                          value={editHealthInsurance}
                          onChange={(event) => setEditHealthInsurance(event.target.value)}
                          placeholder="Krankenkasse"
                        />
                        <Input
                          type="date"
                          value={editEmploymentStartDate}
                          onChange={(event) => setEditEmploymentStartDate(event.target.value)}
                        />
                        <Input value={editEmployedAs} onChange={(event) => setEditEmployedAs(event.target.value)} placeholder="Beschaeftigt als" />
                        <Input value={editBankName} onChange={(event) => setEditBankName(event.target.value)} placeholder="Name der Bank" />
                        <Input value={editIban} onChange={(event) => setEditIban(event.target.value)} placeholder="IBAN" />
                        <Input
                          type="date"
                          value={editPscheinValidUntil}
                          onChange={(event) => setEditPscheinValidUntil(event.target.value)}
                        />
                        <Input value={editDistrict} onChange={(event) => setEditDistrict(event.target.value)} />
                        <select
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={editCurrentShift}
                          onChange={(event) => setEditCurrentShift(event.target.value)}
                        >
                          {shifts.map((shift) => (
                            <option key={shift} value={shift}>
                              {shift}
                            </option>
                          ))}
                        </select>

                        <div className="md:col-span-2 space-y-2 rounded-md border border-slate-200 bg-white p-3">
                          <Label htmlFor={`edit-driver-note-${driver.id}`}>Notizpunkte</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`edit-driver-note-${driver.id}`}
                              value={editNoteInput}
                              onChange={(event) => setEditNoteInput(event.target.value)}
                              placeholder="Neuen Punkt hinzufuegen"
                            />
                            <Button type="button" variant="secondary" onClick={addEditNote}>
                              Hinzufuegen
                            </Button>
                          </div>

                          {editNotes.length > 0 ? (
                            <ul className="space-y-2">
                              {editNotes.map((note, index) => (
                                <li
                                  key={`${note}-${index}`}
                                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-2 py-1 text-sm text-slate-700"
                                >
                                  <span>{note}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeEditNote(index)}
                                  >
                                    Entfernen
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-500">Noch keine Notizpunkte.</p>
                          )}
                        </div>

                        <div className="md:col-span-2 flex gap-2">
                          <Button onClick={() => void handleSave(driver.id)} disabled={isBusy}>
                            Speichern
                          </Button>
                          <Button variant="secondary" onClick={cancelEdit} disabled={isBusy}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <p className="font-semibold text-slate-900">{[driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.name}</p>
                          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                            <span>Bezirk: {driver.district}</span>
                            <Badge variant={shiftVariant(driver.current_shift)}>{driver.current_shift}</Badge>
                          </div>
                          <p className="text-xs text-slate-500">P-Schein bis: {driver.pschein_valid_until}</p>

                          {driver.notes && driver.notes.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                              {driver.notes.map((note, index) => (
                                <li key={`${driver.id}-note-${index}`} className="rounded bg-slate-100 px-2 py-1">
                                  {note}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(driver)} disabled={isBusy}>
                            Bearbeiten
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDelete(driver.id)}
                            disabled={isBusy}
                          >
                            Loeschen
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
