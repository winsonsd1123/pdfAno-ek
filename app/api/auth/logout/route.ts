import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 