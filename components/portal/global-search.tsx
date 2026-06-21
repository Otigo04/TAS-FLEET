'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-sm hidden md:flex items-center">
      <Search className="absolute left-3 h-4 w-4 text-slate-400" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Schnellsuche (Fahrer, Fahrzeuge)..."
        className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-300 w-full"
      />
    </form>
  )
}
