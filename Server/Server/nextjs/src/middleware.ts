// src/middleware.ts
import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // If the request reaches here, the user is authenticated
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login", // Redirect users to this page if not authenticated
    },
  }
);

// Define protected routes
export const config = {
  matcher: ["/admin/:path*"], // Protect all /admin/* routes
};