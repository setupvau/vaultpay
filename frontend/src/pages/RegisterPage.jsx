import { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CaptchaWidget from '../components/ui/CaptchaWidget';

const PRIVACY_POLICY = `Privacy Policy

This application respects and protects the personal privacy of all users. In order to provide you with more accurate and personalized services, this application will use and disclose your personal information in accordance with this Privacy Policy.

1. Scope of application
We collect information you provide when registering, including your phone number and name. We also collect usage data such as IP address, browser type, and access times.

2. Information use
We will not sell, rent, or share your personal information with unrelated third parties without your consent. Your information is used solely to provide and improve our services.

3. Information disclosure
We may disclose your information only: with your consent, as required by law, or to provide services you have requested.

4. Information security
We protect your data using encrypted passwords and industry-standard security measures. However, no system is completely secure.

5. Cookies
We use cookies to improve your experience. You may disable cookies in your browser settings, though some features may not function properly.

6. Changes to this policy
We reserve the right to update this Privacy Policy. Significant changes will be communicated through the app.

By registering, you agree to these terms and our commitment to protecting your privacy.`;

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const recaptchaRef = useRef();

  const [form, setForm] = useState({ full_name: '', phone: '+91', password: '', referral_code: searchParams.get('ref') || '' });
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [captchaDone, setCaptchaDone] = useState(false);
  const [agreed, setAgreed]           = useState(false);
  const [showPolicy, setShowPolicy]   = useState(false);

  
  

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const canSubmit = agreed && captchaDone && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { toast.error('Please agree to the Privacy Policy'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    const payload = { ...form };
    if (recaptchaRef.current?.getValue) {
      payload.captcha_token = recaptchaRef.current.getValue();
    }

    setLoading(true);
    try {
      const { data } = await authAPI.register(payload);
      login(data.data.user, data.data.access_token, data.data.refresh_token);
      toast.success('Welcome to VaultPay! 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
      if (recaptchaRef.current?.reset) recaptchaRef.current.reset();
      setCaptchaDone(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* Left branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-emerald-950/20 to-gray-950" />
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl mb-8 shadow-2xl shadow-emerald-900/50">
            <span className="text-5xl">💰</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4">VaultPay</h1>
          <p className="text-gray-400 text-xl max-w-xs mx-auto leading-relaxed">
            Join thousands of users growing their money every day.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 bg-gray-950 overflow-y-auto">
        <div className="w-full max-w-md">

          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-4">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-3xl font-black text-white">VaultPay</h1>
          </div>

          <h2 className="text-3xl font-black text-white mb-2">Create account</h2>
          <p className="text-gray-500 mb-6">Start your investment journey today</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Full Name</label>
              <input type="text" className="input" placeholder="Your full name"
                value={form.full_name} onChange={set('full_name')} required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Phone Number</label>
              <input type="tel" className="input" placeholder="+91XXXXXXXXXX"
                value={form.phone} onChange={set('phone')} required />
              <p className="text-xs text-gray-600 mt-1">Include country code, e.g. +91 for India</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-20"
                  placeholder="Minimum 8 characters"
                  value={form.password} onChange={set('password')} required />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs font-semibold uppercase">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-xs text-red-400 mt-1">Need {8 - form.password.length} more characters</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Referral Code <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <input type="text" className="input" placeholder="Enter referral code"
                value={form.referral_code} onChange={set('referral_code')} />
            </div>

            {/* Captcha — math fallback when no Google key set */}
            <CaptchaWidget ref={recaptchaRef} onSuccess={(ok) => setCaptchaDone(ok)} />

            {/* Privacy policy agreement */}
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
                <span className="text-sm text-gray-400">
                  I agree to the{' '}
                  <button type="button" onClick={() => setShowPolicy(true)}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2">
                    User Privacy Agreement
                  </button>
                </span>
              </label>
            </div>

            <button type="submit" disabled={!canSubmit}
              className="btn-primary w-full py-4 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create Account →'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-bold">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Privacy policy modal */}
      {showPolicy && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPolicy(false)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-xl border border-gray-700 overflow-hidden max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <h2 className="font-black text-white">User Privacy Agreement</h2>
              <button onClick={() => setShowPolicy(false)}
                className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center">✕</button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{PRIVACY_POLICY}</pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 shrink-0">
              <button onClick={() => { setAgreed(true); setShowPolicy(false); }}
                className="btn-primary w-full py-3">
                I Agree ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
