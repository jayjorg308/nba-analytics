import { useEffect, useState } from 'react'
import type { CreationPayload } from '../domain/creationPayload'
import { parseCreationPayload } from '../domain/creationPayload'
import type { FreethrowPayload } from '../domain/freethrowPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import type { DerivedPayload } from '../domain/payload'
import { parseDerivedPayload } from '../domain/payload'
import type { ShotContextPayload } from '../domain/shotContextPayload'
import { parseShotContextPayload } from '../domain/shotContextPayload'

export type PayloadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: T }

/** A payload the page may not need this render (the prior season's shot
 * payload behind the growth coda, ADR-0061): hooks must run unconditionally,
 * so absence is a state, never a skipped call. */
export type OptionalPayloadState<T> = PayloadState<T> | { status: 'absent' }

/**
 * Fetch a persisted payload and pass it through its Zod load boundary
 * (ADR-0007/0030). A payload that fails the contract is a real error and is
 * surfaced, never swallowed. The app only ever reads persisted JSON — never
 * the NBA API. A null url resolves to the absent state without a request.
 */
function useOptionalParsedPayload<T>(
  url: string | null,
  parse: (json: unknown) => T,
  /** How error copy names this payload ("shot data", "creation data"). */
  noun: string,
): OptionalPayloadState<T> {
  const [state, setState] = useState<OptionalPayloadState<T>>(
    url === null ? { status: 'absent' } : { status: 'loading' },
  )

  useEffect(() => {
    if (url === null) return
    const controller = new AbortController()
    // No loading reset here: initial state already is loading, and if the url
    // ever changes mid-life the previous content stays until the new payload
    // resolves (stale-while-loading). In practice the hero url is constant.

    async function load() {
      try {
        const res = await fetch(url!, { signal: controller.signal })
        if (!res.ok) {
          setState({ status: 'error', message: `HTTP ${res.status} loading ${noun}` })
          return
        }
        const json: unknown = await res.json()
        try {
          setState({ status: 'ready', payload: parse(json) })
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
          message: `Failed to load ${noun}: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        })
      }
    }

    void load()
    return () => controller.abort()
    // parse and noun are stable module-level arguments at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return state
}

function useParsedPayload<T>(
  url: string,
  parse: (json: unknown) => T,
  noun: string,
): PayloadState<T> {
  // A non-null url can never resolve to the absent state.
  return useOptionalParsedPayload(url, parse, noun) as PayloadState<T>
}

export function usePayload(url: string): PayloadState<DerivedPayload> {
  return useParsedPayload(url, parseDerivedPayload, 'shot data')
}

/** The prior season's shot payload (ADR-0061): fetched only when the
 * rendered season is canonical with a prior argued season — the coda's
 * whole data need beyond the page's own four payloads. */
export function useOptionalShotPayload(
  url: string | null,
): OptionalPayloadState<DerivedPayload> {
  return useOptionalParsedPayload(url, parseDerivedPayload, 'prior season shot data')
}

/** The sibling creation payload (ADR-0030) — one class of hero page: the
 * page waits for every required payload and surfaces any failure. */
export function useCreationPayload(url: string): PayloadState<CreationPayload> {
  return useParsedPayload(url, parseCreationPayload, 'creation data')
}

export function useShotContextPayload(url: string): PayloadState<ShotContextPayload> {
  return useParsedPayload(url, parseShotContextPayload, 'shot context data')
}

/** The fourth required sibling (ADR-0053): free-throw trips at trip grain. */
export function useFreethrowPayload(url: string): PayloadState<FreethrowPayload> {
  return useParsedPayload(url, parseFreethrowPayload, 'free throw data')
}
