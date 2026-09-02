import { NextRequest, NextResponse } from 'next/server';

/**
 * Optional HTTP Basic authentication for the whole app.
 *
 * AdGuard Buddy can toggle protection and rewrite filter rules on every
 * configured server, so an unauthenticated instance hands full control to
 * anyone who can reach the port. Set ADGUARD_BUDDY_AUTH_USER and
 * ADGUARD_BUDDY_AUTH_PASSWORD to require a login; leaving them unset keeps the
 * previous open behaviour for trusted networks.
 */

const REALM = 'AdGuard Buddy';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

/** Length-independent comparison so the response time does not leak the secret. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const user = process.env.ADGUARD_BUDDY_AUTH_USER;
  const password = process.env.ADGUARD_BUDDY_AUTH_PASSWORD;

  if (!user || !password) return NextResponse.next();

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  const separator = decoded.indexOf(':');
  if (separator === -1) return unauthorized();

  const givenUser = decoded.slice(0, separator);
  const givenPassword = decoded.slice(separator + 1);

  // Both comparisons always run so a wrong username is not faster than a wrong password.
  const userOk = safeEqual(givenUser, user);
  const passwordOk = safeEqual(givenPassword, password);

  return userOk && passwordOk ? NextResponse.next() : unauthorized();
}

export const config = {
  // Everything except Next's own static output.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
