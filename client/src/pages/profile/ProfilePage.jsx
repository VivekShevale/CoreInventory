import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { gsap } from 'gsap';
import { useEffect } from 'react';
import { User, Camera, Save } from 'lucide-react';
import { updateProfile } from '../../store/slices/authSlice';
import { Btn, InputField } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { uploadToCloudinary } from '../../lib/cloudinary';

export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);
  const [form, setForm] = useState({ full_name: user?.full_name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const cardRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(cardRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
  }, []);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      await dispatch(updateProfile({ avatar_url: url }));
    } catch { setError('Failed to upload image'); }
    finally { setUploading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    const res = await dispatch(updateProfile(form));
    if (!res.error) { setSuccess('Profile updated successfully!'); setTimeout(() => setSuccess(''), 3000); }
    else setError(res.payload);
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <Breadcrumb />
      <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-6">My Profile</h1>

      <div ref={cardRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : <User size={32} className="text-indigo-600 dark:text-indigo-400" />
              }
            </div>
            <label className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center cursor-pointer shadow-sm hover:bg-indigo-700 transition-colors ${uploading ? 'opacity-60' : ''}`}>
              <Camera size={13} className="text-white" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={uploading} />
            </label>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">{user?.full_name || user?.login_id}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">@{user?.login_id}</p>
          </div>
        </div>

        {success && <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 mb-5 text-sm text-emerald-700 dark:text-emerald-400">{success}</div>}
        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-5 text-sm text-red-600 dark:text-red-400">{error}</div>}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Full Name"
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Login ID</label>
              <div className="px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-mono">
                {user?.login_id}
              </div>
              <p className="text-xs text-slate-400 mt-1">Login ID cannot be changed</p>
            </div>
            <InputField
              label="Email Address"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="md:col-span-2"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <Btn type="submit" disabled={saving}>
              <Save size={15} />
              {saving ? 'Saving...' : 'Save Changes'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
