import React from 'react';
import { GraduationCap, Mail, Phone, MapPin, ShieldAlert, Heart } from 'lucide-react';
import { DEPARTMENTS } from '../data/departments';
import { SITE_CONFIG } from '../config/site';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { WhatsAppChannelButton } from './WhatsAppChannelButton';

interface FooterProps {
  onDepartmentClick: (deptId: string) => void;
  openSignUp: () => void;
  onNavigateContact: () => void;
  onNavigateFaq: () => void;
  onNavigatePrivacy: () => void;
  onNavigateTerms: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onDepartmentClick,
  openSignUp,
  onNavigateContact,
  onNavigateFaq,
  onNavigatePrivacy,
  onNavigateTerms
}) => {
  const { settings } = useSiteSettings();

  return (
    <footer className="bg-[#0A1224] border-t border-[#24315A] text-[#9AA8C7] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#24315A]/60">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700]">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-display font-extrabold text-2xl text-[#E6ECFA]">
                School of Technology<span className="text-[#FFC700]">.</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#9AA8C7] max-w-sm">
              {SITE_CONFIG.description}
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs text-[#E6ECFA]">
              <Heart className="w-4 h-4 text-[#FFC700]" />
              <span>{SITE_CONFIG.tagline}</span>
            </div>

            {/* WhatsApp channel button in footer if configured */}
            {settings.whatsappChannelUrl && (
              <div className="pt-2">
                <WhatsAppChannelButton
                  url={settings.whatsappChannelUrl}
                  variant="outline"
                />
              </div>
            )}
          </div>

          {/* Departments Col */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-[#E6ECFA]">
              Departments
            </h4>
            <ul className="space-y-2 text-xs">
              {DEPARTMENTS.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => onDepartmentClick(d.id)}
                    className="hover:text-[#FFC700] transition-colors text-left cursor-pointer"
                  >
                    {d.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* More Departments */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-[#E6ECFA]">
              Specializations
            </h4>
            <ul className="space-y-2 text-xs">
              {DEPARTMENTS.slice(3, 6).map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => onDepartmentClick(d.id)}
                    className="hover:text-[#FFC700] transition-colors text-left cursor-pointer"
                  >
                    {d.name}
                  </button>
                </li>
              ))}
              <li className="pt-2">
                <button
                  onClick={openSignUp}
                  className="text-xs font-semibold text-[#FFC700] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Student Portal Sign Up &rarr;
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Details from site config */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-[#E6ECFA]">
              Student Representative
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="text-[#E6ECFA] font-semibold">
                {SITE_CONFIG.contact.representativeName}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#FFC700] shrink-0" />
                <a href={`tel:${SITE_CONFIG.contact.phone}`} className="hover:text-[#E6ECFA]">
                  {SITE_CONFIG.contact.phone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FFC700] shrink-0" />
                <a href={`mailto:${SITE_CONFIG.contact.email}`} className="hover:text-[#E6ECFA]">
                  {SITE_CONFIG.contact.email}
                </a>
              </div>
              <div className="pt-2">
                <button
                  onClick={onNavigateContact}
                  className="text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer"
                >
                  Contact Desk Form &rarr;
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9AA8C7]">
          <p>© {new Date().getFullYear()} SOT Student Portal. {SITE_CONFIG.tagline}.</p>
          <div className="flex flex-wrap items-center gap-6">
            <button onClick={onNavigateFaq} className="hover:text-[#E6ECFA] transition-colors cursor-pointer">
              FAQs
            </button>
            <button onClick={onNavigatePrivacy} className="hover:text-[#E6ECFA] transition-colors cursor-pointer">
              Privacy Policy
            </button>
            <button onClick={onNavigateTerms} className="hover:text-[#E6ECFA] transition-colors cursor-pointer">
              Terms of Use
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
