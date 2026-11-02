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

export const PrivacyPolicyPage: React.FC<{ onNavigateHome: () => void; onNavigateContact?: () => void }> = ({
  onNavigateHome,
  onNavigateContact
}) => {
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
            <span>Privacy Policy & Data Protection</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
            Student Privacy & Data Notice
          </h1>
          <p className="text-sm text-[#9AA8C7] leading-relaxed">
            The School of Technology (SOT) portal is dedicated to keeping your academic information private, transparent, and secure.
          </p>
        </div>

        {/* Highlight Callout */}
        <div className="p-4 rounded-xl bg-[#0F1E36] border-l-4 border-[#FFC700] border-y border-r border-[#1E2E52] space-y-1.5">
          <div className="text-xs font-bold text-[#FFC700] uppercase tracking-wider">
            Official Privacy Guarantee
          </div>
          <p className="text-sm text-[#E6ECFA] font-medium leading-relaxed">
            SOT Portal stores your email, name, department and matric or JAMB number to run the portal. Only admins can see your ID number. We never sell your data.
          </p>
        </div>

        <div className="p-6 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-6 text-sm text-[#9AA8C7] leading-relaxed">
          <div>
            <h3 className="font-display font-bold text-[#E6ECFA] text-base mb-2">1. Who Can See What</h3>
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-1">
                <span className="text-xs font-bold text-[#FFC700] block">Portal Administrators</span>
                <p className="text-xs text-[#9AA8C7]">
                  Admins can see your full name, email, department, academic level, and your Matric or JAMB ID number. This clearance is strictly for verifying student eligibility, assigning course representatives, and resolving timetable or registration issues.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-1">
                <span className="text-xs font-bold text-[#2F52FF] block">Course Representatives</span>
                <p className="text-xs text-[#9AA8C7]">
                  Course Reps can post bulletins, upload past questions and solutions, and view student lists strictly within their own department. They cannot see your passwords or private credentials.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-1">
                <span className="text-xs font-bold text-emerald-400 block">Fellow Students & Public Visitors</span>
                <p className="text-xs text-[#9AA8C7]">
                  Other students cannot view your ID number, email address, password, or individual quiz attempts. Only aggregate averages and public resources are visible.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-display font-bold text-[#E6ECFA] text-base mb-2">2. Data Security & Storage</h3>
            <p className="text-xs text-[#9AA8C7]">
              Student authentication is managed securely via Firebase Authentication with encrypted token sessions. Data is persisted in Firestore protected by server-side security rules enforcing role-based clearances.
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-[#E6ECFA] text-base mb-2">3. How to Request Account Deletion</h3>
            <p className="text-xs text-[#9AA8C7] mb-3">
              You have the right to request full deletion of your account and personal details at any time. To request deletion:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#9AA8C7] mb-4">
              <li>Navigate to the <strong className="text-[#E6ECFA]">Contact</strong> desk page in the portal navigation or footer.</li>
              <li>Select <strong className="text-[#E6ECFA]">Enquiry</strong> or <strong className="text-[#E6ECFA]">Complaint</strong> as the message category.</li>
              <li>Provide your registered email and student name, and type <strong className="text-[#FFC700]">"Account Deletion Request"</strong> in the message box.</li>
              <li>An administrator will review and purge your account record, releasing your Matric or JAMB ID number from the registry within 48 hours.</li>
            </ol>
            {onNavigateContact && (
              <button
                type="button"
                onClick={onNavigateContact}
                className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Go to Contact Page to Request Deletion &rarr;
              </button>
            )}
          </div>
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
