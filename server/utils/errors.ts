// Narrow helpers for inspecting unknown caught errors (AWS S3 error names)
// without resorting to `any`.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const errName = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.name;
  if (isRecord(error) && typeof error.name === 'string') return error.name;
  return undefined;
};

export const errHttpStatus = (error: unknown): number | undefined => {
  if (!isRecord(error)) return undefined;
  const meta = error.$metadata;
  if (isRecord(meta) && typeof meta.httpStatusCode === 'number') {
    return meta.httpStatusCode;
  }
  return undefined;
};
