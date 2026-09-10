import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchModelIds, normalizeModelIds } from './modelList'

describe('normalizeModelIds', () => {
  it('reads and de-duplicates the OpenAI data list', () => {
    expect(normalizeModelIds({
      object: 'list',
      data: [
        { id: 'gpt-image-2.5-flare' },
        { id: 'gpt-image-2.5-sunburst' },
        { id: 'gpt-image-2.5-flare' },
      ],
    })).toEqual(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'])
  })

  it('accepts plain string lists and model maps', () => {
    expect(normalizeModelIds({ data: ['gpt-image-2', ''] })).toEqual(['gpt-image-2'])
    expect(normalizeModelIds({ models: [{ id: 'gpt-image-2' }] })).toEqual(['gpt-image-2'])
    expect(normalizeModelIds(['gpt-image-2'])).toEqual(['gpt-image-2'])
    expect(normalizeModelIds({ 'gpt-image-2': { owned_by: 'openai' } })).toEqual(['gpt-image-2'])
  })

  it('ignores entries without a usable id', () => {
    expect(normalizeModelIds({ data: [{ id: '   ' }, { object: 'model' }, null, 42] })).toEqual([])
    expect(normalizeModelIds('not-a-list')).toEqual([])
    expect(normalizeModelIds(null)).toEqual([])
  })
})

describe('fetchModelIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('requests the models endpoint with the API key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'gpt-image-2.5-flare' }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const ids = await fetchModelIds({ baseUrl: 'https://api.example.com/v1', apiKey: 'test-key' })

    expect(ids).toEqual(['gpt-image-2.5-flare'])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-key' }, cache: 'no-store' }),
    )
  })

  it('uses the same-origin API proxy path when API proxy is enabled', async () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await fetchModelIds({ baseUrl: 'https://api.example.com/v1', apiKey: 'test-key', apiProxy: true })

    expect(fetchMock.mock.calls[0][0]).toBe('/api-proxy/models')
  })

  it('surfaces the upstream error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Invalid API key' },
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(fetchModelIds({ baseUrl: 'https://api.example.com/v1', apiKey: 'bad-key' }))
      .rejects.toThrow('Invalid API key')
  })

  it('reports network failures and unparsable payloads', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('<html>gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }))

    await expect(fetchModelIds({ baseUrl: 'https://api.example.com/v1', apiKey: 'test-key' }))
      .rejects.toThrow('无法连接模型列表接口：Failed to fetch')
    await expect(fetchModelIds({ baseUrl: 'https://api.example.com/v1', apiKey: 'test-key' }))
      .rejects.toThrow('模型列表接口返回的不是有效 JSON。')
  })
})
