// Shared validation primitives.
//
// One canonical place for the rules every form and server action enforces.
// Safe to import from both server and client code — no runtime dependencies
// beyond zod.

import { z } from "zod";

// ─── Phone numbers ────────────────────────────────────────────────────────────
//
// Quivo is Nepal-first. Accepted inputs:
//
//   * 10-digit mobile starting with 9 (98XXXXXXXX, 97XXXXXXXX, …)
//   * Mobile with +977 / 977 country code prefix
//   * Landline with optional area code (e.g. 01-4234567, 014234567)
//
// Stored canonical form: digits only, with leading 977 stripped from mobile
// numbers but preserved for landlines outside Kathmandu if user typed it.
// We do NOT force E.164 — Nepali users mostly think in local 10-digit form.
//
// `formatPhoneForStorage` is the single normaliser. `PhoneSchema` validates
// the *input* and then transforms to the canonical form, so by the time a
// row hits Postgres there's exactly one shape to reason about.

const PHONE_MAX_LEN = 20;

/** Strip whitespace, dashes, parens, dots — everything but digits and a leading '+'. */
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  return keepPlus ? "+" + digits : digits;
}

/**
 * Canonical storage form: digits only. If the user typed +977 / 977 in front
 * of a 10-digit mobile, we drop the country code so all locals look the same.
 */
export function formatPhoneForStorage(raw: string): string {
  const n = normalizePhone(raw);
  const digits = n.replace(/^\+/, "");
  if (digits.startsWith("977") && /^9[6-9]\d{8}$/.test(digits.slice(3))) {
    return digits.slice(3);
  }
  return digits;
}

/** Pretty form: `984 1234 5678` for mobile, `01-4234567` for Kathmandu landline. */
export function prettyPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = formatPhoneForStorage(raw);
  if (/^9[6-9]\d{8}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  if (/^01\d{6,8}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return d;
}

// Mobile: 10 digits, starts with 96/97/98/99
const MOBILE_RE = /^9[6-9]\d{8}$/;
// Landline: leading 0 + 1-2-digit area code + 6-8-digit local (9-11 digits total).
// Examples: 014234567 (Kathmandu), 0214563210 (Kaski), 081551122 (Banke).
const LANDLINE_RE = /^0\d{8,10}$/;
const PHONE_MESSAGE =
  "Enter a valid Nepali phone (e.g. 98XXXXXXXX or 014234567). Country code +977 is optional.";

/** Strict validator — required, returns canonical form. */
export const PhoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX_LEN, "Phone is too long")
  .transform(formatPhoneForStorage)
  .refine((d) => d.length > 0, "Phone is required")
  .refine((d) => MOBILE_RE.test(d) || LANDLINE_RE.test(d), PHONE_MESSAGE);

/** Optional flavour: empty string / null / undefined are all allowed. */
export const OptionalPhoneSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? "" : v.trim()))
  .transform((v) => (v === "" ? "" : formatPhoneForStorage(v)))
  .refine((d) => d === "" || MOBILE_RE.test(d) || LANDLINE_RE.test(d), PHONE_MESSAGE)
  .transform((d) => (d === "" ? null : d));

/** Cheap client-side test — returns boolean only, useful for `onBlur` hints. */
export function isValidPhone(raw: string): boolean {
  return PhoneSchema.safeParse(raw).success;
}

// ─── Email ────────────────────────────────────────────────────────────────────

const EMAIL_MAX_LEN = 200;

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Email is required")
  .max(EMAIL_MAX_LEN, "Email is too long")
  .email("Enter a valid email address");

export const OptionalEmailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? "" : v.trim().toLowerCase()))
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address")
  .refine((v) => v.length <= EMAIL_MAX_LEN, "Email is too long")
  .transform((v) => (v === "" ? null : v));

export function isValidEmail(raw: string): boolean {
  return EmailSchema.safeParse(raw).success;
}

// ─── Person / business names ──────────────────────────────────────────────────
//
// We strip control characters (anything in the C0/C1 ranges) and collapse
// consecutive whitespace. Unicode letters are allowed so names like
// "साेज, Aman, José" all work. We do *not* allow only-digit names — common
// abuse vector for spammy signups.

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;

function cleanName(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, "").replace(/\s+/g, " ").trim();
}

export const PersonNameSchema = z
  .string()
  .max(120, "Name is too long")
  .transform(cleanName)
  .refine((v) => v.length >= 2, "Name must be at least 2 characters")
  .refine((v) => !/^\d+$/.test(v), "Name cannot be only digits");

export const OptionalPersonNameSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? "" : cleanName(v)))
  .refine((v) => v === "" || (v.length >= 2 && !/^\d+$/.test(v)), "Name must be at least 2 characters")
  .refine((v) => v.length <= 120, "Name is too long")
  .transform((v) => (v === "" ? null : v));

export const ShopNameSchema = z
  .string()
  .max(80, "Shop name is too long")
  .transform(cleanName)
  .refine((v) => v.length >= 2, "Shop name must be at least 2 characters");

// ─── Money + currency ────────────────────────────────────────────────────────

/** Rounded to 2 decimals, non-negative, sane upper bound. */
export const MoneyAmountSchema = z
  .coerce.number({ message: "Enter a valid amount" })
  .finite("Enter a valid amount")
  .nonnegative("Amount cannot be negative")
  .max(100_000_000, "Amount is too large")
  .transform((n) => Math.round(n * 100) / 100);

/** Strict positive amount — for things that must be > 0 (e.g. selling price). */
export const PositiveMoneySchema = MoneyAmountSchema.refine((n) => n > 0, "Amount must be greater than 0");

/** Uppercase 3-letter ISO-4217-ish currency code. We don't enforce the full list. */
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code (e.g. NPR, USD, INR)");

// ─── Time of day (HH:MM or HH:MM:SS, 24-hour) ────────────────────────────────

export const TimeOfDaySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM (24-hour)");

// ─── URLs (re-exported here so forms have a single import point) ─────────────

export const HttpUrlSchema = z
  .string()
  .trim()
  .max(2000, "URL is too long")
  .url("Enter a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://");

export const OptionalHttpUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? "" : v.trim()))
  .refine((v) => v === "" || HttpUrlSchema.safeParse(v).success, "Enter a valid URL")
  .transform((v) => (v === "" ? null : v));

// ─── Quantities and stock ────────────────────────────────────────────────────

export const QuantitySchema = z
  .coerce.number({ message: "Enter a valid number" })
  .finite()
  .nonnegative("Quantity cannot be negative")
  .max(1_000_000, "Quantity is too large");

export const PositiveQuantitySchema = QuantitySchema.refine((n) => n > 0, "Quantity must be greater than 0");

// ─── Short text (notes, descriptions) ────────────────────────────────────────

export function ShortText(maxLen: number, label = "Text") {
  return z
    .string()
    .max(maxLen, `${label} is too long (max ${maxLen} characters)`)
    .transform((v) => v.replace(CONTROL_CHARS_RE, "").trim());
}

export function OptionalShortText(maxLen: number, label = "Text") {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? "" : v.replace(CONTROL_CHARS_RE, "").trim()))
    .refine((v) => v.length <= maxLen, `${label} is too long (max ${maxLen} characters)`)
    .transform((v) => (v === "" ? null : v));
}

// ─── Address ─────────────────────────────────────────────────────────────────

export const AddressSchema = ShortText(300, "Address").refine(
  (v) => v.length >= 3,
  "Address is too short"
);

export const OptionalAddressSchema = OptionalShortText(300, "Address").refine(
  (v) => v === null || v.length >= 3,
  "Address is too short"
);

// ─── Latitude / longitude ────────────────────────────────────────────────────

export const LatitudeSchema = z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude");
export const LongitudeSchema = z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude");

// ─── Generic UUID (kept here for one-stop shop) ──────────────────────────────

export const UuidSchema = z.string().uuid("Invalid ID");
