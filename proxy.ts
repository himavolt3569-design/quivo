import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/log";

const isDev = process.env.NODE_ENV === "development";
const REQUEST_ID_HEADER = "x-request-id";

const SCRIPT_SRC = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
  : "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net";

const CSP = [
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
  SCRIPT_SRC,
].join("; ");

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding/owner")
  );
}

function makeResponse(requestHeaders: Headers, requestId: string) {
  requestHeaders.set("Content-Security-Policy", CSP);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const incomingRequestId = request.headers.get(REQUEST_ID_HEADER);
  const requestId =
    incomingRequestId && incomingRequestId.length <= 64
      ? incomingRequestId
      : crypto.randomUUID();

  let response = makeResponse(requestHeaders, requestId);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    log.warn("proxy: Supabase env vars missing — skipping auth check", {
      requestId,
    });

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
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = makeResponse(requestHeaders, requestId);
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isProtectedPath(request.nextUrl.pathname) && !user) {
      return NextResponse.redirect(new URL("/?login=true", request.url));
    }
  } catch (error) {
    log.error("proxy: auth check failed", {
      requestId,
      err: error instanceof Error ? error.message : String(error),
    });
    if (isProtectedPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/?login=true", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
