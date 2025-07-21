import NextAuth, { AuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createSupabaseAdminClient } from "@/lib/server/supabase";

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
          throw new Error("请输入邮箱和密码");
        }
        
        // We need an admin client here to fetch full profile data after auth
        const supabaseAdmin = createSupabaseAdminClient();

        // Step 1: Authenticate user with email and password
        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (authError || !authData.user) {
          console.error("Supabase sign in error:", authError?.message);
          throw new Error("邮箱或密码错误");
        }

        const user = authData.user;

        // Step 2: Fetch the user's profile from the 'profiles' table
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select(`
            *,
            role:roles (
              name
            )
          `)
          .eq('id', user.id)
          .single();

        if (profileError || !profileData) {
          console.error("Failed to fetch user profile:", profileError?.message);
          throw new Error("无法加载用户配置信息");
        }

        // Step 3: Construct the user object for NextAuth session
        return {
          id: profileData.id,
          email: user.email,
          name: profileData.full_name || profileData.username,
          image: profileData.avatar_url,
          role: (profileData.role as any)?.name || 'user', // Add role
          // also add other profile data if needed
          username: profileData.username,
          fullName: profileData.full_name,
          id_number: profileData.id_number, // Add id_number
          avatarUrl: profileData.avatar_url,
          updated_at: user.updated_at || new Date().toISOString(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.fullName = (user as any).fullName;
        token.username = (user as any).username;
        token.id_number = (user as any).id_number; // Add id_number
        token.avatarUrl = (user as any).avatarUrl;
        token.updated_at = (user as any).updated_at; // Add updated_at
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).fullName = token.fullName;
        (session.user as any).username = token.username;
        (session.user as any).id_number = token.id_number; // Add id_number
        (session.user as any).avatarUrl = token.avatarUrl;
        (session.user as any).updated_at = token.updated_at; // Add updated_at
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 