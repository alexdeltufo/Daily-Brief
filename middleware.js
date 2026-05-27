import { NextResponse } from 'next/server';

export function middleware(req) {
  const auth = req.headers.get('authorization');
  const valid = 'Basic ' + btoa('alex:alexisverycool1');
  if (auth !== valid) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Daily Brief"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api/auth).*)',
};
