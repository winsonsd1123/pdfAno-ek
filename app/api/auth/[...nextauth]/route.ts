import NextAuth, { type AuthOptions, type User } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

// Simple in-memory user store for testing
const testUsers = [
  {
    id: "1",
    email: "admin@test.com",
    password: "admin123",
    name: "Admin User",
    role: "admin",
  },
  {
    id: "2",
    email: "user@test.com",
    password: "user123",
    name: "Test User",
    role: "user",
  },
]

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        console.log("NextAuth authorize called with:", { email: credentials?.email })

        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials")
          return null
        }

        try {
          // For now, use simple test users instead of Supabase
          const user = testUsers.find((u) => u.email === credentials.email && u.password === credentials.password)

          if (!user) {
            console.log("User not found or password incorrect")
            return null
          }

          console.log("User authenticated successfully:", user.email)

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        } catch (error) {
          console.error("Authorization error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  debug: process.env.NODE_ENV === "development",
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
