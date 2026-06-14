export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}

export const fetchWithRetry = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  const {
    timeoutMs = 15000,
    retries = 3,
    baseDelayMs = 1000,
    ...fetchOptions
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Return immediately if successful or if it's a 4xx error (client error, retrying won't help)
      // We retry on 5xx errors or network failures
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      throw new Error(`Error HTTP: ${response.status}`);
    } catch (error: any) {
      if (attempt === retries) {
        throw new Error(error.name === 'AbortError' ? 'Tiempo de espera agotado.' : 'Error de conexión con el servidor.');
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw new Error('Número máximo de reintentos superado');
};
