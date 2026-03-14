import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { gsap } from 'gsap';
import { useEffect } from 'react';
import { User, Save, Mail, AtSign } from 'lucide-react';
import { updateProfile } from '../../store/slices/authSlice';
import { Btn, InputField } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';

export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);
  const [form, setForm] = useState({ 
    full_name: user?.full_name || '', 
    email: user?.email || '' 
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const cardRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(cardRef.current, 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); 
    setError(''); 
    setSuccess('');
    const res = await dispatch(updateProfile(form));
    if (!res.error) { 
      setSuccess('Profile updated successfully!'); 
      setTimeout(() => setSuccess(''), 3000); 
    } else setError(res.payload);
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Breadcrumb />
      
      {/* Header - matching Dashboard style */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white mb-1">My Profile</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Manage your personal information and account settings</p>
      </div>

      <div 
        ref={cardRef} 
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm"
      >
        {/* User Info Header - simplified without avatar upload */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20 flex items-center justify-center overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={28} className="text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-white text-lg">
              {user?.full_name || user?.login_id}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                <Mail size={12} />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                <AtSign size={12} />
                <span>@{user?.login_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 rounded-lg px-4 py-3 mb-5 text-sm text-emerald-700 dark:text-emerald-400">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-3 mb-5 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Full Name"
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Login ID
              </label>
              <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-sm font-mono">
                {user?.login_id}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Login ID cannot be changed</p>
            </div>

            <InputField
              label="Email Address"
              type="email"
              placeholder="your.email@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="md:col-span-2"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}