const invalidatedContextPattern =
  /extension context invalidated|contexto da extens[aã]o.*inv[aá]lido|chrome runtime is not available/i

export const EXTENSION_CONTEXT_INVALIDATED_MESSAGE =
  'A extensão foi recarregada. Feche este painel e abra o Guardião novamente no DevTools.'

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return invalidatedContextPattern.test(message)
}

export function assertExtensionRuntimeAvailable(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    throw new Error(EXTENSION_CONTEXT_INVALIDATED_MESSAGE)
  }
}
