// Every backend call goes through here, so the base URL (VITE_API_URL) lives in one place
// and every failure becomes a readable message instead of an unhandled rejection.

export const API = import.meta.env.VITE_API_URL ?? ''

// Render's free tier can take about a minute to wake up, so the timeout is generous.
const DEFAULT_TIMEOUT_MS = 90000

export async function request(path, { method = 'GET', json, formData, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(`${API}${path}`, {
            method,
            headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
            body: json !== undefined ? JSON.stringify(json) : formData,
            signal: controller.signal,
        })

        let data = null
        try {
            data = await response.json()
        } catch {
            // Not JSON. Handled below.
        }

        if (!response.ok) {
            throw new Error(data?.error || data?.message || `The server answered with an error (${response.status}).`)
        }
        if (data === null) {
            throw new Error('The server sent back something unexpected.')
        }
        return data
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('The backend took too long to answer. It may still be waking up, so try again in a moment.')
        }
        if (err instanceof TypeError) {
            throw new Error("Couldn't reach the backend. If it was asleep, give it a minute and try again.")
        }
        throw err
    } finally {
        clearTimeout(timer)
    }
}

// Fire-and-forget request that wakes a sleeping backend. Any response at all (even a 404)
// means the server is up, and no-cors keeps a missing CORS header from logging an error.
// Resolves true once the server answers, false if it can't be reached.
export function wakeBackend() {
    return fetch(`${API}/`, { mode: 'no-cors', cache: 'no-store' })
        .then(() => true)
        .catch(() => false)
}