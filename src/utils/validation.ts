export const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCommonFields(body: any): string | null {
  const { deviceId, content, to } = body;

  if (typeof deviceId !== "string" || !deviceId.trim()) {
    return "deviceId is required and must be a non-empty string";
  }
  if (typeof content !== "string" || !content.trim()) {
    return "content is required and must be a non-empty string";
  }
  if (typeof to !== "string" || !to.trim()) {
    return "to is required and must be a non-empty string";
  }

  return null;
}
