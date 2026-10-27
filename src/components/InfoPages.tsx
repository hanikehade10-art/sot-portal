import React from 'react';
import { SITE_CONFIG } from '../config/site';
import { FAQS } from '../data/departments';
import { HelpCircle, Shield, FileText, ArrowLeft, Home } from 'lucide-react';

export const FAQPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  return (
    <div className="py-16 md:py-24 bg-[#0A1224] text-[#E6ECFA]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <button
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
            Student Help & Portal Guidelines
          </h1>
          <p className="text-sm text-[#9AA8C7]">
            Answers to common questions regarding account setup, matriculation validation, and portal usage.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-2">
              <h3 className="font-display font-bold text-base text-[#E6ECFA]">
                {faq.q}
              </h3>
              <p className="text-sm text-[#9AA8C7] leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PrivacyPolicyPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  return (
    <div className="py-16 md:py-24 bg-[#0A1224] text-[#E6ECFA]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <button
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
            Student Data Protection Policy
          </h1>
        </div>

        <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-5 text-sm text-[#9AA8C7] leading-relaxed">
          <h3 className="font-bold text-[#E6ECFA] text-base">1. Information We Collect</h3>
          <p>
            When you register for an account on the SOT Student Portal, we collect your email address, full name, chosen department, and unique matriculation number. This information is used strictly to identify your student account and display relevant announcements.
          </p>

          <h3 className="font-bold text-[#E6ECFA] text-base">2. Storage and Security</h3>
          <p>
            Student authentication is securely managed via Firebase Authentication with encrypted token sessions. Profiles are stored in cloud database documents protected by strict security rules: students can only read and modify their own records, and designated student administrators can manage the community directory.
          </p>

          <h3 className="font-bold text-[#E6ECFA] text-base">3. Non-Commercial Use</h3>
          <p>
            Your data is never sold, rented, or distributed to any third parties or advertisers. The portal is operated purely for student communication and mutual academic support.
          </p>
        </div>
      </div>
    </div>
  );
};

export const TermsPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  return (
    <div className="py-16 md:py-24 bg-[#0A1224] text-[#E6ECFA]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <button
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
            Portal Code of Conduct & Terms
          </h1>
        </div>

        <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-5 text-sm text-[#9AA8C7] leading-relaxed">
          <h3 className="font-bold text-[#E6ECFA] text-base">1. Acceptance of Terms</h3>
          <p>
            By accessing or registering on the School of Technology Student Portal, you agree to abide by these terms. This portal is a peer-operated utility meant to foster collaboration among students across our six departments.
          </p>

          <h3 className="font-bold text-[#E6ECFA] text-base">2. Accurate Matriculation Number</h3>
          <p>
            Each registered student is required to submit their genuine matriculation number. Registering false or impersonated matric numbers is strictly prohibited and accounts in violation may be disabled by student portal administrators.
          </p>

          <h3 className="font-bold text-[#E6ECFA] text-base">3. Disclaimer</h3>
          <p>
            This portal is maintained independently by students of the School of Technology. It does not replace official university administrative channels, bursary portals, or official transcripts.
          </p>
        </div>
      </div>
    </div>
  );
};

export const NotFoundPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  return (
    <div className="min-h-[75vh] bg-[#0A1224] text-[#E6ECFA] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] text-3xl font-extrabold  mb-4 shadow-[0_0_30px_rgba(47,82,255,0.2)]">
        404
      </div>
      <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA] mb-2">
        Page Not Found
      </h1>
      <p className="text-sm text-[#9AA8C7] max-w-md mb-8">
        The page you are looking for does not exist on the SOT Student Portal or may have been moved.
      </p>
      <button
        onClick={onNavigateHome}
        className="px-6 py-3 rounded-xl bg-[#FFC700] text-[#0A1224] font-bold text-xs hover:bg-[#ffd233] shadow-[0_0_20px_rgba(255,199,0,0.3)] flex items-center gap-2 cursor-pointer"
      >
        <Home className="w-4 h-4" />
        <span>Return to SOT Home</span>
      </button>
    </div>
  );
};
