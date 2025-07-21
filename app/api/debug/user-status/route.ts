import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/server/supabase';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        session: null,
      });
    }
    
    // For consistency, we use the user ID from the session
    const userId = (session.user as any).id;
    const adminClient = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    let roleInfo = null;
    if (profile?.role_id) {
      const { data: role, error: roleError } = await adminClient
        .from('roles')
        .select('*')
        .eq('id', profile.role_id)
        .single();
      
      roleInfo = { role, roleError };
    }

    const { data: allRoles, error: rolesError } = await adminClient
      .from('roles')
      .select('*');

    return NextResponse.json({
      success: true,
      message: 'User is authenticated.',
      session: session, // Return the full NextAuth session for debugging
      db_check: {
        profile: {
          data: profile,
          error: profileError
        },
        userRole: roleInfo,
        allRoles: {
          data: allRoles,
          error: rolesError
        }
      },
      derived_debug_info: {
        isAdmin: profile?.role_id && roleInfo?.role?.name === 'admin',
        hasProfile: !!profile,
        hasRoleId: !!profile?.role_id,
        roleName: roleInfo?.role?.name
      }
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 