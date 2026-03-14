import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowLeft, Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import api from '../../configs/api';
import { Btn, InputField } from '../../components/ui';

const STEPS = { EMAIL: 'email', OTP: 'otp', DONE: 'done' };

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/auth/forgot-password', { email });
      setStep(STEPS.OTP);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/api/auth/verify-otp', { email, otp, new_password: newPassword });
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP or password requirements not met');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Package size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            Core<span className="text-indigo-600">Inventory</span>
          </h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
          {step === STEPS.EMAIL && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Mail size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-white">Reset Password</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enter your email to receive an OTP</p>
                </div>
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 mb-4">{error}</p>}
              <form onSubmit={sendOtp} className="flex flex-col gap-4">
                <InputField label="Email Address" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                <Btn type="submit" disabled={loading} className="w-full justify-center" size="lg">
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Btn>
              </form>
            </>
          )}

          {step === STEPS.OTP && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <KeyRound size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-white">Enter OTP</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sent to {email}</p>
                </div>
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 mb-4">{error}</p>}
              <form onSubmit={verifyOtp} className="flex flex-col gap-4">
                <InputField label="OTP Code" placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} required maxLength={6} />
                <InputField label="New Password" type="password" placeholder="New strong password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                <Btn type="submit" disabled={loading} className="w-full justify-center" size="lg">
                  {loading ? 'Verifying...' : 'Reset Password'}
                </Btn>
                <button type="button" onClick={() => setStep(STEPS.EMAIL)} className="text-xs text-slate-400 hover:text-slate-600 text-center">Resend OTP</button>
              </form>
            </>
          )}

          {step === STEPS.DONE && (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
              <h2 className="font-bold text-slate-800 dark:text-white text-lg">Password Reset!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your password has been updated successfully.</p>
              <Link to="/login">
                <Btn className="mt-6 w-full justify-center" size="lg">Go to Login</Btn>
              </Link>
            </div>
          )}

          {step !== STEPS.DONE && (
            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mt-5 transition-colors">
              <ArrowLeft size={14} /> Back to Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
