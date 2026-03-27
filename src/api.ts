const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  token?: string
  body?: unknown
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', token, body }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = (await response.json()) as { message?: string } & T

  if (!response.ok) {
    throw new ApiError(data.message ?? 'Erro ao consumir a API.', response.status)
  }

  return data
}
