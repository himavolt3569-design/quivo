import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding/owner");
}

function buildCsp(nonce: string) {
  void nonce;
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
    : "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://rc-epay.esewa.com.np https://epay.esewa.com.np",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://tessdata.projectnaptha.com https://cdn.jsdelivr.net https://rc-epay.esewa.com.np https://epay.esewa.com.np https://khalti.com https://dev.khalti.com",
    "frame-src 'self' https://rc-epay.esewa.com.np https://epay.esewa.com.np",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    scriptSrc,
  ].join("; ");
}

function makeResponse(requestHeaders: Headers, nonce: string) {
  const csp = buildCsp(nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = makeResponse(requestHeaders, nonce);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("Supabase environment variables are missing. Skipping auth proxy.");

    if (isProtectedPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/?login=true", request.url));
    }

    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = makeResponse(requestHeaders, nonce);
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (isProtectedPath(request.nextUrl.pathname) && !user) {
      return NextResponse.redirect(new URL("/?login=true", request.url));
    }
  } catch (error) {
    console.error("Proxy Auth Error:", error);
    if (isProtectedPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/?login=true", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
