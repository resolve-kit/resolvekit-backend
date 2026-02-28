const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_REQUIREMENT_GUIDANCE = [
  `At least ${MIN_PASSWORD_LENGTH} characters`,
  "At least one uppercase letter",
  "At least one lowercase letter",
  "At least one number",
  "At least one special character",
  "No whitespace characters",
];

export function passwordRequirementFailures(password: string): string[] {
  const failures: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) failures.push(`must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) failures.push("must include an uppercase letter");
  if (!/[a-z]/.test(password)) failures.push("must include a lowercase letter");
  if (!/[0-9]/.test(password)) failures.push("must include a number");
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("must include a special character");
  if (/\s/.test(password)) failures.push("must not include whitespace");
  return failures;
}

export const PASSWORD_MINIMUM_LENGTH = MIN_PASSWORD_LENGTH;
