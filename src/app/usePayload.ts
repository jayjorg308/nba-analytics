import { useEffect, useState } from 'react'
import type { DerivedPayload } from '../domain/payload'
import { parseDerivedPayload } from '../domain/payload'

export type PayloadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: DerivedPayload }

/**
 * Fetch the persisted derived payload and pass it through the Zod load
 * boundary (ADR-0007). A payload that fails the contract is a real error and
 * is surfaced, never swallowed. The app only ever reads persisted JSON —
 * never the NBA API.
 */
export function usePayload(url: string): PayloadState {
  const [state, setState] = useState<PayloadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    // No loading reset here: initial state already is loading, and if the url
    // ever changes mid-life the previous content stays until the new payload
    // resolves (stale-while-loading). In practice the hero url is constant.

    async function load() {
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) {
          setState({ status: 'error', message: `HTTP ${res.status} loading shot data` })
          return
        }
        const json: unknown = await res.json()
        try {
          setState({ status: 'ready', payload: parseDerivedPayload(json) })
        } catch (parseError) {
          setState({
            status: 'error',
            message: `Payload contract violation: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          })
        }
      } catch (fetchError) {
        if (controller.signal.aborted) return // StrictMode remount / unmount
        setState({
          status: 'error',
          message: `Failed to load shot data: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        })
      }
    }

    void load()
    return () => controller.abort()
  }, [url])

  return state
}
