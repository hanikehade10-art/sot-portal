import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, checkIsAdminRole, checkIsRepRole } from '../context/AuthContext';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import { SotDepartmentName } from '../types';
import { SITE_CONFIG } from '../config/site';
import {
  GraduationCap,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  Building2,
  FileBadge2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  LogOut,
  LogIn,
  User as UserIcon,
  Clock
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'signup' | 'step2' | 'forgot';
  onSuccessRedirect: (role?: string) => void;
  initialDepartment?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  onSuccessRedirect,
  initialDepartment
}) => {
  const {
    user,
    profile,
    loginLockoutMinutesRemaining,
    registerStep1,
    completeStep2,
    login,
    sendPasswordReset,
    logout
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'step2' | 'forgot'>(initialMode);

  // Sync mode based on user auth status
  useEffect(() => {
    if (user) {
      if (!profile?.profileComplete) {
        setMode('step2');
      } else {
        setMode(initialMode === 'step2' ? 'login' : initialMode);
      }
    } else {
      setMode(initialMode);
    }
  }, [initialMode, user, profile, isOpen]);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  // Step 2 details
  const [selectedDept, setSelectedDept] = useState<SotDepartmentName | ''>(
    (initialDepartment as SotDepartmentName) || ''
  );
  const [idType, setIdType] = useState<'matric' | 'jamb'>('matric');
  const [matricNumber, setMatricNumber] = useState('');

  // Status & error tracking
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailConflict, setEmailConflict] = useState(false);
  const [matricConflict, setMatricConflict] = useState<string | null>(null);

  const resetForm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmailConflict(false);
    setMatricConflict(null);
    setPrivacyAgreed(false);
  };

  // Password strength hint
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, text: 'Required (min 8 chars)', color: 'bg-zinc-700' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, text: 'Weak (min 8 chars required)', color: 'bg-rose-500' };
    if (score <= 3) return { score: 2, text: 'Moderate', color: 'bg-[#FFC700]' };
    return { score: 3, text: 'Strong', color: 'bg-emerald-500' };
  }, [password]);

  // Forced step 2 mode if logged in without complete profile (admins are exempt)
  const isUserAdminCurrent = checkIsAdminRole(profile?.role) ||
    (user?.email && user.email.toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase());
  const isForcedStep2 = Boolean(user && !isUserAdminCurrent && (!profile || !profile.profileComplete));

  if (!isOpen) return null;

  // STEP 1 SIGN UP
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Please enter a valid academic or personal email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter carefully.');
      return;
    }

    if (!privacyAgreed) {
      setErrorMsg('You must agree to the privacy notice to create an account.');
      return;
    }

    setLoading(true);
    try {
      await registerStep1(email, password, fullName);
      setSuccessMsg('Account created! Now enter your department and matric number to complete registration.');
      setMode('step2');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setEmailConflict(true);
        setErrorMsg('An account with this email address already exists. Please log in instead or use another email.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password is too weak. Please use at least 8 characters with numbers and letters.');
      } else {
        console.warn('Step 1 registration notice:', err?.message || err);
        setErrorMsg(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 STUDENT DETAILS
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    if (!selectedDept) {
      setErrorMsg('Please select your enrolled department from the list.');
      return;
    }

    const cleanNumber = matricNumber.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanNumber) {
      setErrorMsg(idType === 'matric' ? 'Matric number is required.' : 'JAMB registration number is required.');
      return;
    }

    if (idType === 'matric') {
      const matricFormat = /^[A-Z0-9_\-\/]{4,25}$/;
      if (!matricFormat.test(cleanNumber)) {
        setErrorMsg('Matric number format must be 4 to 25 characters (e.g. F/ND/25/3210001).');
        return;
      }
    } else {
      const jambFormat = /^[A-Z0-9]{8,15}$/;
      if (!jambFormat.test(cleanNumber)) {
        setErrorMsg('JAMB registration number must be letters and digits only, 8 to 15 characters long (e.g. 2025123456AB).');
        return;
      }
    }

    setLoading(true);
    try {
      await completeStep2(selectedDept as SotDepartmentName, cleanNumber, idType);
      setSuccessMsg('Sign-up complete! Directing you straight to the dashboard...');
      setTimeout(() => {
        onSuccessRedirect();
        onClose();
      }, 1000);
    } catch (err: any) {
      if (err.message && err.message.includes('already been claimed')) {
        setMatricConflict(cleanNumber);
        setErrorMsg(err.message);
      } else {
        console.warn('Step 2 completion notice:', err?.message || err);
        setErrorMsg(err.message || 'Failed to complete registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  // LOGIN
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    if (loginLockoutMinutesRemaining) {
      setErrorMsg(`Login is locked. Please wait ${loginLockoutMinutesRemaining} minute(s) before trying again.`);
      return;
    }

    if (!email || !password) {
      setErrorMsg('Email and password are both required.');
      return;
    }

    setLoading(true);
    try {
      const userProfile = await login(email, password);
      const isUserAdmin = checkIsAdminRole(userProfile?.role) ||
        (userProfile?.email && userProfile.email.toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase()) ||
        (userProfile as any)?.isAdmin === true;
      const isUserRep = !isUserAdmin && checkIsRepRole(userProfile?.role);

      // If user is not admin and profile is incomplete, send to Step 2
      if (!isUserAdmin && (!userProfile || !userProfile.profileComplete)) {
        setSuccessMsg('Login successful. Please complete Step 2 (Department & matric number or JAMB registration number).');
        setMode('step2');
      } else {
        setSuccessMsg(
          isUserAdmin
            ? 'Welcome Administrator! Directing to Admin Dashboard...'
            : isUserRep
            ? 'Welcome Course Rep! Directing to Rep Dashboard...'
            : 'Welcome back! Directing straight to dashboard...'
        );
        setTimeout(() => {
          onSuccessRedirect(isUserAdmin ? 'admin' : (userProfile?.role || 'student'));
          onClose();
        }, 500);
      }
    } catch (err: any) {
      console.warn('Login attempt notice:', err?.message || err);
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetForm();

    if (!email) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSuccessMsg(`A password reset link has been dispatched to ${email}. Please check your inbox and spam folder.`);
    } catch (err: any) {
      console.warn('Reset password attempt notice:', err?.message || err);
      if (err.code === 'auth/user-not-found') {
        setErrorMsg('No registered account was found with this email address.');
      } else {
        setErrorMsg(err.message || 'Could not send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A1224]/85 backdrop-blur-md overflow-y-auto">
      
      {/* Modal Card (NO white backgrounds anywhere) */}
      <div className="relative w-full max-w-lg bg-[#121C36] border border-[#24315A] rounded-2xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] my-8">
        
        {/* Dismiss or Logout */}
        {!isForcedStep2 ? (
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="absolute top-5 right-5 p-2 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#2F52FF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => logout()}
            className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-rose-400 hover:border-rose-500 transition-colors cursor-pointer"
            title="Log out and return later"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.15)]">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-[#E6ECFA]">
              {mode === 'signup' && 'Student Portal Registration'}
              {mode === 'step2' && 'Student Details (Step 2)'}
              {mode === 'login' && 'Student Portal Login'}
              {mode === 'forgot' && 'Reset Portal Password'}
            </h2>
            <p className="text-xs text-[#9AA8C7]">
              {SITE_CONFIG.tagline}
            </p>
          </div>
        </div>

        {/* Progress indicator for sign-up */}
        {(mode === 'signup' || mode === 'step2') && (
          <div className="mb-6 p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A]">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-[#FFC700] flex items-center gap-1.5">
                <FileBadge2 className="w-4 h-4" />
                {mode === 'signup' ? 'Step 1 of 2: Account Creation' : 'Step 2 of 2: Department & Matric or JAMB Number'}
              </span>
              <span className="text-[#9AA8C7]">
                {mode === 'signup' ? 'Step 1 of 2' : 'Final Step'}
              </span>
            </div>
            
            <div className="w-full h-2 rounded-full bg-[#121C36] overflow-hidden flex">
              <div
                className={`h-full transition-all duration-500 ${
                  mode === 'signup' ? 'w-1/2 bg-[#2F52FF]' : 'w-full bg-[#FFC700]'
                }`}
              />
            </div>
          </div>
        )}

        {/* Lockout Warning Banner */}
        {loginLockoutMinutesRemaining && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-500 flex items-start gap-2.5 text-xs text-rose-200">
            <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Account Locked:</strong> Five consecutive failed login attempts detected. Login is locked on this device for {loginLockoutMinutesRemaining} more minute(s). You can use "Forgot password" to reset your password.
            </div>
          </div>
        )}

        {/* Alert / Feedback Messages */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed flex-1">
                <div>{errorMsg}</div>
                {emailConflict && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setMode('login');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Log in to your account</span>
                    </button>
                  </div>
                )}
                {matricConflict && (
                  <div className="mt-2 text-[11px] text-rose-300">
                    Each matriculation number must be unique. If you made a typographical error, please correct it below. If someone else claimed your matric number, please reach out via the Contact page.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-start gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMsg}</div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: ACCOUNT REGISTRATION                             */}
        {/* ======================================================== */}
        {mode === 'signup' && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Oluwaseun Adeleke"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <UserIcon className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Student Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <Mail className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Account Password * (Minimum 8 characters)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create strong password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <Lock className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#9AA8C7]">Strength hint:</span>
                    <span className="font-semibold text-[#E6ECFA]">{passwordStrength.text}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#0A1224] overflow-hidden flex gap-1">
                    <div className={`h-full flex-1 rounded ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 rounded ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 rounded ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'}`} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <Lock className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 p-1 text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Privacy Notice Card */}
            <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
              <p className="text-[11px] text-[#9AA8C7] leading-relaxed">
                SOT Portal stores your email, name, department and matric or JAMB number to run the portal. Only admins can see your ID number. We never sell your data.
              </p>
              <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  required
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="rounded bg-[#121C36] border-[#24315A] text-[#FFC700] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#E6ECFA]">I agree</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl text-sm font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_20px_rgba(255,199,0,0.3)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0A1224]" />
                  <span>Processing Step 1...</span>
                </>
              ) : (
                <>
                  <span>Continue to Step 2 (Student Details)</span>
                  <ArrowRight className="w-4 h-4 text-[#0A1224]" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[#9AA8C7]">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { resetForm(); setMode('login'); }}
                className="text-[#FFC700] font-semibold hover:underline cursor-pointer"
              >
                Log in to portal
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 2: STUDENT DETAILS (Department & Matric or JAMB)    */}
        {/* ======================================================== */}
        {mode === 'step2' && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            
            <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] leading-relaxed">
              <span className="font-semibold text-[#FFC700]">Final Step:</span>{' '}
              Select your department and enter your unique matric number or JAMB registration number. Once submitted, you will be taken straight to your student dashboard.
            </div>

            {/* Department Dropdown (contains all 6 departments) */}
            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Enrolled SOT Department *
              </label>
              <div className="relative">
                <select
                  required
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as SotDepartmentName)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                >
                  <option value="" disabled>-- Select one of the 6 Departments --</option>
                  {SOT_DEPARTMENTS_LIST.map((deptName) => (
                    <option key={deptName} value={deptName} className="bg-[#0A1224] text-[#E6ECFA]">
                      {deptName}
                    </option>
                  ))}
                </select>
                <Building2 className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Two-Option Switch: Matric vs JAMB */}
            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Identification Type *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-xl bg-[#0A1224] border border-[#24315A]">
                <button
                  type="button"
                  onClick={() => {
                    setIdType('matric');
                    if (matricConflict) setMatricConflict(null);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    idType === 'matric'
                      ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
                  }`}
                >
                  <span>I have a matric number</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdType('jamb');
                    if (matricConflict) setMatricConflict(null);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    idType === 'jamb'
                      ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_12px_rgba(255,199,0,0.35)]'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#121C36]'
                  }`}
                >
                  <span>I don't have one yet (use JAMB registration number)</span>
                </button>
              </div>
            </div>

            {/* Matric or JAMB Number Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#9AA8C7]">
                  {idType === 'matric' ? 'Matric number *' : 'JAMB registration number *'}
                </label>
                <span className="text-[11px] text-[#FFC700]">
                  {idType === 'matric' ? 'e.g. F/ND/25/3210001' : 'e.g. 2025123456AB'}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={matricNumber}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase().replace(/\s+/g, '');
                    setMatricNumber(clean);
                    if (matricConflict) setMatricConflict(null);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={idType === 'matric' ? 'F/ND/25/3210001' : '2025123456AB'}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A1224] border ${
                    matricConflict
                      ? 'border-rose-500 ring-1 ring-rose-500/50 focus:border-rose-500'
                      : 'border-[#24315A] focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)]'
                  } text-[#E6ECFA] uppercase placeholder-[#9AA8C7]/50 text-sm focus:outline-none transition-all tracking-wider`}
                />
                <FileBadge2 className={`w-4 h-4 ${matricConflict ? 'text-rose-400' : 'text-[#9AA8C7]'} absolute left-3.5 top-3`} />
              </div>
              {matricConflict ? (
                <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {idType === 'matric'
                      ? 'Matriculation number already claimed. Please verify your number.'
                      : 'JAMB registration number already claimed. Please verify your number.'}
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-[#9AA8C7] mt-1.5">
                  {idType === 'matric'
                    ? 'Matric numbers must be unique across all student accounts.'
                    : 'JAMB numbers must be letters and digits only (8-15 characters). You can add your matric number later.'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl text-sm font-extrabold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_25px_rgba(255,199,0,0.35)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0A1224]" />
                  <span>Verifying {idType === 'matric' ? 'Matric' : 'JAMB'} & Activating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-[#0A1224]" />
                  <span>Complete Registration & Go Straight to Dashboard</span>
                </>
              )}
            </button>

            {isForcedStep2 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-xs text-[#9AA8C7] hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Need to leave? Log out of this account
                </button>
              </div>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* LOGIN FORM                                               */}
        {/* ======================================================== */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Student Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <Mail className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#9AA8C7]">
                  Password *
                </label>
                <button
                  type="button"
                  onClick={() => { resetForm(); setMode('forgot'); }}
                  className="text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your account password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <Lock className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(loginLockoutMinutesRemaining)}
              className="w-full mt-2 py-3 rounded-xl text-sm font-semibold bg-[#2F52FF] text-white hover:bg-[#2645df] transition-all shadow-[0_0_20px_rgba(47,82,255,0.3)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Log in to Portal</span>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[#9AA8C7]">
              New student at SOT?{' '}
              <button
                type="button"
                onClick={() => { resetForm(); setMode('signup'); }}
                className="text-[#FFC700] font-semibold hover:underline cursor-pointer"
              >
                Sign up for an account
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* FORGOT PASSWORD FORM                                     */}
        {/* ======================================================== */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-xs text-[#9AA8C7] leading-relaxed">
              Enter your registered portal email address. We will transmit a secure password reset link to your email.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                Registered Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                />
                <Mail className="w-4 h-4 text-[#9AA8C7] absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-[#2F52FF] text-white hover:bg-[#2645df] transition-all shadow-[0_0_20px_rgba(47,82,255,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Dispatching Reset Link...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </button>

            <div className="pt-3 text-center text-xs text-[#9AA8C7]">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => { resetForm(); setMode('login'); }}
                className="text-[#FFC700] font-semibold hover:underline cursor-pointer"
              >
                Back to log in
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
