export function authFieldErrorMessage(source: unknown, field: string): string | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const fields = "fields" in source ? source.fields : undefined;
  if (fields && typeof fields === "object") {
    const candidate = (fields as Record<string, unknown>)[field];
    if (candidate && typeof candidate === "object") {
      const message = (candidate as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  const errors = "errors" in source ? source.errors : undefined;
  if (Array.isArray(errors)) {
    for (const error of errors) {
      if (!error || typeof error !== "object") continue;
      const errorFields = "meta" in error ? (error as { meta?: { paramName?: unknown } }).meta : {};
      if (errorFields?.paramName === field) {
        const message = (error as { longMessage?: unknown; message?: unknown }).longMessage;
        if (typeof message === "string" && message.trim()) return message;
        const shortMessage = (error as { message?: unknown }).message;
        if (typeof shortMessage === "string" && shortMessage.trim()) return shortMessage;
      }
    }
  }

  return undefined;
}

export function authFormErrorMessage(source: unknown): string | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const message = "message" in source ? source.message : undefined;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const errors = "errors" in source ? source.errors : undefined;
  if (Array.isArray(errors)) {
    for (const error of errors) {
      if (!error || typeof error !== "object") continue;
      const longMessage = (error as { longMessage?: unknown }).longMessage;
      if (typeof longMessage === "string" && longMessage.trim()) return longMessage;
      const shortMessage = (error as { message?: unknown }).message;
      if (typeof shortMessage === "string" && shortMessage.trim()) return shortMessage;
    }
  }

  return undefined;
}
