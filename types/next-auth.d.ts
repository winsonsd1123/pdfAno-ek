import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user?: {
      id: string;
      role: string;
      fullName?: string | null;
      username?: string | null;
      id_number?: string | null; // Add id_number
      avatarUrl?: string | null;
      updated_at: string;
    } & DefaultSession["user"];
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User {
    role: string;
    username?: string | null;
    fullName?: string | null;
    id_number?: string | null; // Add id_number
    avatarUrl?: string | null;
    updated_at: string;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string;
    role: string;
    fullName?: string | null;
    username?: string | null;
    id_number?: string | null; // Add id_number
    avatarUrl?: string | null;
    updated_at: string;
  }
}
