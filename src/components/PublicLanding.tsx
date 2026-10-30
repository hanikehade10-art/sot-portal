import React from 'react';
import {
  Cpu,
  FlaskConical,
  Hotel,
  Compass,
  Activity,
  Layers,
  ArrowRight,
  CheckCircle2,
  Users,
  Building2,
  Sparkles,
  BookOpen,
  MessageSquare,
  HelpCircle,
  FileText
} from 'lucide-react';
import { DEPARTMENTS } from '../data/departments';
import { DepartmentItem } from '../types';
import { SITE_CONFIG } from '../config/site';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { WhatsAppChannelButton } from './WhatsAppChannelButton';

interface PublicLandingProps {
  openSignUp: () => void;
  openLogin: () => void;
  onSelectDepartment: (dept: DepartmentItem) => void;
  onNavigateContact: () => void;
  onNavigateFaq: () => void;
}

export const DepartmentIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-6 h-6' }) => {
  switch (name) {
    case 'Cpu':
      return <Cpu className={className} />;
    case 'FlaskConical':
      return <FlaskConical className={className} />;
    case 'Hotel':
      return <Hotel className={className} />;
    case 'Compass':
      return <Compass className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    case 'Layers':
      return <Layers className={className} />;
    default:
      return <BookOpen className={className} />;
  }
};

export const PublicLanding: React.FC<PublicLandingProps> = ({
  openSignUp,
  openLogin,
  onSelectDepartment,
  onNavigateContact,
  onNavigateFaq
}) => {
  const { settings } = useSiteSettings();

  return (
    <div className="flex flex-col bg-[#070D1A] text-[#E6ECFA]">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#2F52FF]/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-[#FFC700]/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            {/* Tagline pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA]">
              <span className="w-2 h-2 rounded-full bg-[#FFC700] animate-pulse" />
              <span>{SITE_CONFIG.tagline} • 6 Academic Departments</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-tight text-[#E6ECFA] leading-[1.1]">
              School of Technology
            </h1>

            {/* School Description */}
            <p className="text-base sm:text-xl text-[#9AA8C7] leading-relaxed max-w-2xl mx-auto font-normal">
              {SITE_CONFIG.description}
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={openSignUp}
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-extrabold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_25px_rgba(255,199,0,0.35)] hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>Sign up</span>
                <ArrowRight className="w-5 h-5 text-[#0A1224]" />
              </button>

              <button
                onClick={openLogin}
                className="w-full sm:w-auto px-7 py-4 rounded-xl text-base font-semibold bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] hover:text-white transition-all shadow-[0_0_15px_rgba(47,82,255,0.1)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Student Login</span>
              </button>

              {/* WhatsApp Channel Button */}
              {settings.whatsappChannelUrl && (
                <WhatsAppChannelButton
                  url={settings.whatsappChannelUrl}
                  variant="solid"
                  className="w-full sm:w-auto py-4"
                />
              )}
            </div>

            {/* Stats: 6 Departments */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="p-4 rounded-xl bg-[#121C36]/70 border border-[#24315A]">
                <div className="text-2xl font-display font-extrabold text-[#FFC700]">6</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-1">Departments</div>
              </div>
              <div className="p-4 rounded-xl bg-[#121C36]/70 border border-[#24315A]">
                <div className="text-sm font-display font-bold text-[#9AA8C7]">Coming soon</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-1">Student Tutoring</div>
              </div>
              <div className="p-4 rounded-xl bg-[#121C36]/70 border border-[#24315A]">
                <div className="text-sm font-display font-bold text-[#9AA8C7]">Coming soon</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-1">Past Questions Hub</div>
              </div>
              <div className="p-4 rounded-xl bg-[#121C36]/70 border border-[#24315A]">
                <div className="text-sm font-display font-bold text-[#9AA8C7]">Coming soon</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-1">Project Sandbox</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DEPARTMENTS SECTION */}
      <section id="departments" className="py-20 md:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
              Academic Departments
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
              Six Specialized Departments
            </h2>
            <p className="text-sm sm:text-base text-[#9AA8C7]">
              Select your department to view curriculum highlights, course placeholders, and register with your matric number or JAMB registration number.
            </p>
          </div>

          {/* Department Cards Grid: 6 cards in 3x2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.id}
                onClick={() => onSelectDepartment(dept)}
                className="group relative p-7 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-all duration-300 hover:shadow-[0_0_25px_rgba(47,82,255,0.2)] cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-13 h-13 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:text-white group-hover:bg-[#2F52FF] group-hover:border-[#2F52FF] transition-all duration-300">
                      <DepartmentIcon name={dept.iconName} className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      {dept.shortCode}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-xl text-[#E6ECFA] group-hover:text-white mb-2 transition-colors">
                    {dept.name}
                  </h3>

                  <p className="text-sm text-[#9AA8C7] leading-relaxed mb-6">
                    {dept.oneLiner}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#24315A]/70 flex items-center justify-between text-xs text-[#9AA8C7]">
                  <span className="text-[#FFC700] font-medium">{dept.facilityNotice}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#FFC700] group-hover:text-[#2F52FF] transition-colors">
                    Explore &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="py-20 md:py-28 bg-[#0A1224] border-t border-b border-[#24315A]/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
                About Our Initiative
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA] leading-tight">
                Built by Students, for Students
              </h2>
              <p className="text-sm sm:text-base text-[#9AA8C7] leading-relaxed">
                This student-operated portal was initiated to provide classmates across our six departments with a clean, centralized digital space. We help each other keep track of student schedules, share peer learning resources, and organize student-led exhibitions.
              </p>
              <p className="text-sm text-[#9AA8C7] leading-relaxed">
                Whether you are studying computer hardware and software, food processing, hospitality operations, tourism management, dietary planning, or polymer and textile sciences, this space belongs to all of us.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-sm text-[#E6ECFA]">
                  <CheckCircle2 className="w-5 h-5 text-[#FFC700] shrink-0" />
                  <span>Student-run community announcements and departmental bulletins</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#E6ECFA]">
                  <CheckCircle2 className="w-5 h-5 text-[#FFC700] shrink-0" />
                  <span>Direct peer feedback desk for reviews, enquiries, and complaints</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#E6ECFA]">
                  <CheckCircle2 className="w-5 h-5 text-[#FFC700] shrink-0" />
                  <span>Secure matriculation or JAMB registration verification preventing duplicate entries</span>
                </div>
              </div>
            </div>

            {/* Right Card */}
            <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-[0_0_30px_rgba(47,82,255,0.1)] space-y-6">
              <div className="border-b border-[#24315A] pb-4">
                <div className="text-xs font-bold text-[#FFC700] uppercase tracking-wider">
                  Important Information
                </div>
                <h3 className="font-heading font-bold text-xl text-[#E6ECFA] mt-1">
                  Student Academic Portal
                </h3>
                <p className="text-xs text-[#9AA8C7] mt-1">
                  Built by students, for students.
                </p>
              </div>

              <div className="space-y-4 text-xs text-[#9AA8C7]">
                <p>
                  This platform is created and sustained independently by students enrolled in the School of Technology.
                </p>
                <p>
                  Official administrative records, tuition bursaries, and exam results remain on the official university portal.
                </p>
              </div>

              {settings.whatsappChannelUrl && (
                <div className="pt-2">
                  <WhatsAppChannelButton
                    url={settings.whatsappChannelUrl}
                    variant="banner"
                  />
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onNavigateContact}
                  className="px-5 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#E6ECFA] hover:border-[#2F52FF] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-[#FFC700]" />
                  <span>Contact Student Rep Desk</span>
                </button>
                <button
                  onClick={onNavigateFaq}
                  className="px-5 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#E6ECFA] hover:border-[#2F52FF] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-[#FFC700]" />
                  <span>Portal FAQs</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
