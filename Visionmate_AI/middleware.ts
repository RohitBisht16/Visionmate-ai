import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/dashboard", "/scan", "/prescription", "/medicines", "/safety", "/ask", "/history", "/profile", "/settings"];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // Without configuration nobody can be signed in, so private pages stay closed.
  if (!url || !key) {
    if (matches(path, PROTECTED)) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the session with Supabase; never trust getSession() here.
  const { data: { user } } = await supabase.auth.getUser();

  const redirect = (to: string, search?: string) => {
    const target = new URL(to, request.url);
    if (search) target.search = search;
    const res = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && matches(path, PROTECTED)) {
    return redirect("/login", `?next=${encodeURIComponent(path)}`);
  }
  if (user && matches(path, GUEST_ONLY)) return redirect("/dashboard");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
