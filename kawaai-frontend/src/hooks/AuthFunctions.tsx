import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseConfig';

export const handleGoogleSignIn = async (): Promise<{ error: AuthError | null }> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/home`,
      },
    });

    if (error) return { error };
    return { error: null };
  } catch (err) {
    return { error: err as AuthError };
  }
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
