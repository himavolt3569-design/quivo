"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  PhoneSchema, OptionalPhoneSchema,
  EmailSchema, OptionalEmailSchema,
  prettyPhone,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

type BaseProps = Omit<React.ComponentProps<"input">, "type">;

// ─── PhoneInput ──────────────────────────────────────────────────────────────
//
// - Forces inputMode="tel" and a permissive HTML pattern (so iOS shows the
//   number pad and form-level required validation still works).
// - On blur: validates with the shared schema, sets aria-invalid, optionally
//   reformats the visible value to the pretty form ("984 1234 567").
// - If `required` is false (the default) and the field is empty, no error.
// - Errors render below the input. Caller can also read `onValidChange` to
//   gate submit buttons.

export interface PhoneInputProps extends BaseProps {
  required?: boolean;
  formatOnBlur?: boolean;
  errorClassName?: string;
  onValidChange?: (isValid: boolean, canonical: string | null) => void;
}

export function PhoneInput({
  required = false,
  formatOnBlur = true,
  className,
  errorClassName,
  onBlur,
  onChange,
  onValidChange,
  defaultValue,
  value,
  ...rest
}: PhoneInputProps) {
  const isControlled = value !== undefined;
  // Local state is only used in uncontrolled mode (for format-on-blur). When
  // controlled, the parent owns the value and we render `value` directly —
  // no useEffect sync needed.
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(() => {
    const raw = defaultValue ?? "";
    return typeof raw === "string" ? raw : String(raw);
  });
  const displayValue = isControlled
    ? typeof value === "string"
      ? value
      : String(value ?? "")
    : uncontrolledValue;
  const [error, setError] = React.useState<string | null>(null);

  const validate = React.useCallback((raw: string): { ok: boolean; canonical: string | null; err: string | null } => {
    if (!raw || raw.trim() === "") {
      if (required) return { ok: false, canonical: null, err: "Phone is required" };
      return { ok: true, canonical: null, err: null };
    }
    const schema = required ? PhoneSchema : OptionalPhoneSchema;
    const result = schema.safeParse(raw);
    if (!result.success) return { ok: false, canonical: null, err: result.error.issues[0].message };
    return { ok: true, canonical: (result.data as string | null) ?? null, err: null };
  }, [required]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const { ok, canonical, err } = validate(raw);
    setError(err);
    onValidChange?.(ok, canonical);
    if (ok && canonical && formatOnBlur) {
      const pretty = prettyPhone(canonical);
      if (pretty !== raw) {
        // Update both the visible value and the form's value via change event semantics.
        if (!isControlled) setUncontrolledValue(pretty);
        // Fire a synthetic change so consumers using onChange see the cleaned value.
        const ev = { ...e, target: { ...e.target, value: pretty } } as React.ChangeEvent<HTMLInputElement>;
        onChange?.(ev);
      }
    }
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setUncontrolledValue(e.target.value);
    if (error) {
      // Clear the error as the user starts editing again
      const { err } = validate(e.target.value);
      if (!err) setError(null);
    }
    onChange?.(e);
  };

  return (
    <div className="space-y-1">
      <Input
        {...rest}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        pattern="[\+\d\s\-()]{7,20}"
        maxLength={20}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rest.name ?? "phone"}-error` : undefined}
        className={cn(className)}
        value={isControlled ? displayValue : uncontrolledValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {error && (
        <p
          id={`${rest.name ?? "phone"}-error`}
          role="alert"
          className={cn("flex items-start gap-1 text-[11px] font-bold text-red-600", errorClassName)}
        >
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── EmailInput ──────────────────────────────────────────────────────────────

export interface EmailInputProps extends BaseProps {
  required?: boolean;
  errorClassName?: string;
  onValidChange?: (isValid: boolean, canonical: string | null) => void;
}

export function EmailInput({
  required = false,
  className,
  errorClassName,
  onBlur,
  onChange,
  onValidChange,
  defaultValue,
  value,
  ...rest
}: EmailInputProps) {
  const isControlled = value !== undefined;
  const [error, setError] = React.useState<string | null>(null);

  const validate = (raw: string) => {
    if (!raw || raw.trim() === "") {
      if (required) return { ok: false, canonical: null, err: "Email is required" };
      return { ok: true, canonical: null, err: null };
    }
    const schema = required ? EmailSchema : OptionalEmailSchema;
    const result = schema.safeParse(raw);
    if (!result.success) return { ok: false, canonical: null, err: result.error.issues[0].message };
    return { ok: true, canonical: (result.data as string | null) ?? null, err: null };
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { ok, canonical, err } = validate(e.target.value);
    setError(err);
    onValidChange?.(ok, canonical);
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) {
      const { err } = validate(e.target.value);
      if (!err) setError(null);
    }
    onChange?.(e);
  };

  return (
    <div className="space-y-1">
      <Input
        {...rest}
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        autoCapitalize="off"
        maxLength={200}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rest.name ?? "email"}-error` : undefined}
        className={cn(className)}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : (defaultValue ?? "")}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {error && (
        <p
          id={`${rest.name ?? "email"}-error`}
          role="alert"
          className={cn("flex items-start gap-1 text-[11px] font-bold text-red-600", errorClassName)}
        >
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Helper: react-hook-form style register for direct ref forwarding ───────
//
// Some forms in this repo use refs / FormData. The plain components above
// forward all standard props so they're drop-in replacements for <input>.
