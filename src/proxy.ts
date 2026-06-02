import { clerkMiddleware } from "@clerk/nextjs/server";

// clerkMiddleware() with no callback just initialises the Clerk context so
// that auth() and currentUser() work in API route handlers. Each handler
// manages its own auth checks — we don't protect routes at middleware level.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
