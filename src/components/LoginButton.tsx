'use client';

import { getSupabaseClient } from '@/lib/supabase';
import { User, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LoginButton() {
  const [user, setUser] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    let authListener: any = null;

    const getUser = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user) setUser(data.user);
      } catch (e) {
        console.warn("Supabase auth user check unavailable:", e);
      }
    };
    getUser();

    try {
      const supabase = getSupabaseClient();
      const res = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
      });
      authListener = res?.data;
    } catch (e) {
      console.warn("Supabase auth state listener unavailable:", e);
    }

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowMenu(false);
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Op') return 'Op';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || 'Op';

  return (
    <div className="relative">
      <button 
        onClick={user ? () => setShowMenu(!showMenu) : handleLogin}
        className="user-avatar"
        title={user ? fullName : "Sign In"}
      >
        {user && avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="user-avatar" />
        ) : (
          <span className="text-white text-xs font-medium">
            {getInitials(fullName)}
          </span>
        )}
      </button>

      {showMenu && user && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-72 glass-card p-6 z-50 shadow-2xl border border-white-10 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-white-10">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-teal flex items-center justify-center text-xl font-bold text-white">
                    {getInitials(fullName)}
                  </div>
                )}
              </div>
              <span className="text-base font-bold text-white mb-0-5">{fullName}</span>
              <span className="text-xs text-white-40">{user.email}</span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white-5 hover-bg-white-10 text-white-80 hover:text-white transition-all text-sm font-medium border border-white-10"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
