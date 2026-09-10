import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { getApiErrorMessage } from './imageApiShared'

const MODEL_LIST_TIMEOUT_MS = 20000

interface FetchModelIdsOptions {
  baseUrl: string
  apiKey: string
  apiProxy?: boolean
  timeoutMs?: number
}

function readModelId(item: unknown): string | null {
  if (typeof item === 'string') return item.trim() || null
  if (!item || typeof item !== 'object') return null

  const id = (item as Record<string, unknown>).id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/** 兼容 OpenAI 的 { data: [{ id }] }、{ models: [...] }、纯数组以及 { id: {...} } 这类映射写法 */
export function normalizeModelIds(payload: unknown): string[] {
  const raw = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).data ?? (payload as Record<string, unknown>).models ?? payload
    : payload
  const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.keys(raw) : []
  const ids = items.map(readModelId).filter((id): id is string => id !== null)

  return [...new Set(ids)]
}

export async function fetchModelIds(opts: FetchModelIdsOptions): Promise<string[]> {
  const proxyConfig = readClientDevProxyConfig()
  const url = buildApiUrl(opts.baseUrl, 'models', proxyConfig, shouldUseApiProxy(Boolean(opts.apiProxy), proxyConfig))
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs ?? MODEL_LIST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (err) {
    if (controller.signal.aborted) throw new Error('查询模型列表超时，请检查 API URL 与网络连接。')
    throw new Error(`无法连接模型列表接口：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) throw new Error(await getApiErrorMessage(response))

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('模型列表接口返回的不是有效 JSON。')
  }

  return normalizeModelIds(payload)
}
