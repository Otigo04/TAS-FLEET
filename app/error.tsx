'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the error to the browser console / monitoring in production.
    // eslint-disable-next-line no-console
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-950/40">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Etwas ist schiefgelaufen
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
          </p>
          {error.digest ? (
            <p className="pt-1 font-mono text-xs text-slate-400 dark:text-slate-500">
              Ref: {error.digest}
            </p>
          ) : null}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}
