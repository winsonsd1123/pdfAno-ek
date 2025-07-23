import NextAuth, { type AuthOptions, type User } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { createSupabaseAdminClient } from "@/lib/server/supabase"

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码")
        }

        try {
          // Create admin client for authentication
          const supabaseAdmin = createSupabaseAdminClient()

          // Step 1: Authenticate user with email and password
          const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })

          if (authError || !authData.user) {
            console.error("Supabase sign in error:", authError?.message)
            throw new Error("邮箱或密码错误")
          }

          const user = authData.user

          // Step 2: Fetch the user's profile from the 'profiles' table
          const { data: profileData, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select(`
              *,
              role:roles (
                name
              )
            `)
            .eq("id", user.id)
            .single()

          if (profileError) {
            console.error("Failed to fetch user profile:", profileError?.message)
            // If profile doesn't exist, create a basic user object
            return {
              id: user.id,
              email: user.email,
              name: user.email?.split("@")[0] || "User",
              role: "user",
              username: user.email?.split("@")[0] || "user",
              fullName: user.email?.split("@")[0] || "User",
              id_number: null,
              avatarUrl: null,
              updated_at: user.updated_at || new Date().toISOString(),
            }
          }

          // Step 3: Construct the user object for NextAuth session
          return {
            id: profileData.id,
            email: user.email,
            name: profileData.full_name || profileData.username || user.email?.split("@")[0],
            image: profileData.avatar_url,
            role: (profileData.role as any)?.name || "user",
            username: profileData.username,
            fullName: profileData.full_name,
            id_number: profileData.id_number,
            avatarUrl: profileData.avatar_url,
            updated_at: user.updated_at || new Date().toISOString(),
          }
        } catch (error) {
          console.error("Authorization error:", error)
          if (error instanceof Error) {
            throw error
          }
          throw new Error("认证过程中发生错误")
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.fullName = (user as any).fullName
        token.username = (user as any).username
        token.id_number = (user as any).id_number
        token.avatarUrl = (user as any).avatarUrl
        token.updated_at = (user as any).updated_at
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).fullName = token.fullName
        ;(session.user as any).username = token.username
        ;(session.user as any).id_number = token.id_number
        ;(session.user as any).avatarUrl = token.avatarUrl
        ;(session.user as any).updated_at = token.updated_at
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect errors to login page
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
