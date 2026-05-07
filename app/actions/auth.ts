'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    return { error: authError.message }
  }

  // Fetch the user's role from the profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  const role = profile?.role || 'customer';
  
  // Determine where to send them based on their true role
  const redirectUrl = role === 'owner' ? '/dashboard' : '/';

  return { success: true, redirectUrl }
}

export async function signUpWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string || 'customer'

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  if (isDisposableEmail(email)) {
    return { error: 'Temporary or disposable emails are not allowed for security reasons.' }
  }

  if (role !== 'customer' && role !== 'owner') {
    return { error: 'Invalid role selection.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: role,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email to verify your account.' }
}

export async function signInWithGoogle() {
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

