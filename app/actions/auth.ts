'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'temp-mail.org',
  'yopmail.com', 'throwawaymail.com', 'tempmail.com', 'tempmail.net',
  'tempmail.co', 'tempmail.info', 'tempmail.biz', 'tempmail.io', 'tempmail.org',
  'dropmail.me', 'getnada.com', 'sharklasers.com', 'dispostable.com'
];

function isDisposableEmail(email: string) {
  const domain = email.split('@')[1];
  if (!domain) return true;
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain.toLowerCase());
}

const AuthSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
})

const SignUpSchema = AuthSchema.extend({
  role: z.enum(['customer', 'owner']).default('customer'),
})

export async function loginWithEmail(formData: FormData) {
  const rateLimit = await checkRateLimit('loginWithEmail');
  if (!rateLimit.success) {
    return { error: rateLimit.error }
  }

  const parseResult = AuthSchema.safeParse(Object.fromEntries(formData));
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0].message }
  }

  const { email, password } = parseResult.data;
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    return { error: authError.message }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  const role = profile?.role || 'customer';
  const redirectUrl = role === 'owner' ? '/dashboard' : '/';

  return { success: true, redirectUrl }
}

export async function signUpWithEmail(formData: FormData) {
  const rateLimit = await checkRateLimit('signUpWithEmail');
  if (!rateLimit.success) {
    return { error: rateLimit.error }
  }

  const parseResult = SignUpSchema.safeParse(Object.fromEntries(formData));
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0].message }
  }

  const { email, password, role } = parseResult.data;

  if (isDisposableEmail(email)) {
    return { error: 'Temporary or disposable emails are not allowed for security reasons.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email to verify your account.' }
}

export async function signInWithGoogle() {
  const rateLimit = await checkRateLimit('signInWithGoogle');
  if (!rateLimit.success) {
    return { error: rateLimit.error }
  }

  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    },
  })

  if (error) {
    console.error("Google Auth Error:", error.message)
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}


