'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface OperationsBoardProps {
  defaultTasks: string[]
  expiringSoon: number
  maintenanceCount: number
}

export function OperationsBoard({ defaultTasks, expiringSoon, maintenanceCount }: OperationsBoardProps) {
  const [tasks, setTasks] = useState<string[]>(defaultTasks)
  const [taskInput, setTaskInput] = useState('')

  const urgency = useMemo(() => {
    if (expiringSoon > 4 || maintenanceCount > 3) return 'hoch'
    if (expiringSoon > 1 || maintenanceCount > 1) return 'mittel'
    return 'niedrig'
  }, [expiringSoon, maintenanceCount])

  function addTask() {
    const value = taskInput.trim()
    if (!value) return
    setTasks((prev) => [...prev, value])
    setTaskInput('')
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader>
          <CardTitle>Tages-Checkliste Betrieb</CardTitle>
          <CardDescription>Quick Tasks fuer Disposition, Fahrzeugstatus und Fahrer-Verfuegbarkeit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            <Input
              placeholder="Neue Aufgabe hinzufuegen"
              value={taskInput}
              onChange={(event) => setTaskInput(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={addTask}>
              Add
            </Button>
          </div>

          <ul className="space-y-2">
            {tasks.map((task, index) => (
              <li
                key={`${task}-${index}`}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm"
              >
                <span>{task}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => removeTask(index)}>
                  Erledigt
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="surface-card animate-fade-up-delay-3">
        <CardHeader>
          <CardTitle>Operative Lage</CardTitle>
          <CardDescription>Direkte Indikatoren fuer Uber-relevanten Tagesbetrieb.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white/70 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dringlichkeit</p>
            <div className="mt-2">
              <Badge variant={urgency === 'hoch' ? 'danger' : urgency === 'mittel' ? 'warning' : 'success'}>{urgency}</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/70 p-3 text-sm text-slate-700">
            P-Schein ablaufend (30 Tage): <span className="font-semibold">{expiringSoon}</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/70 p-3 text-sm text-slate-700">
            Fahrzeuge in Wartung: <span className="font-semibold">{maintenanceCount}</span>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
