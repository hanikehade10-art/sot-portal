import React from 'react';
import {
  Sprout,
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

interface PublicLandingProps {
  openSignUp: () => void;
  openLogin: () => void;
  onSelectDepartment: (dept: DepartmentItem) => void;
  onNavigateContact: () => void;
  onNavigateFaq: () => void;
}

export const DepartmentIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-6 h-6' }) => {
  switch (name) {
    case 'Sprout':
      return <Sprout className={className} />;
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
      return <Building2 className={className} />;
  }
};

export const PublicLanding: React.FC<PublicLandingProps> = ({
  openSignUp,
  openLogin,
  onSelectDepartment,
  onNavigateContact,
  onNavigateFaq
}) => {
  return (
    <div className="w-full bg-[#0A1224] text-[#E6ECFA] overflow-hidden">
      
      {/* HERO SECTION */}
      <section id="hero" className="relative pt-24 pb-20 md:pt-32 md:pb-28 border-b border-[#24315A]/60">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#2F52FF]/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-12 right-12 w-[300px] h-[300px] bg-[#FFC700]/5 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            
            {/* Student Tagline & Notice */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121C36] border border-[#FFC700]/40 text-xs font-bold text-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.15)]">
                <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
                <span>{SITE_CONFIG.tagline}</span>
              </div>
              <p className="text-xs text-[#9AA8C7] font-medium tracking-wide">
                {SITE_CONFIG.disclaimer}
              </p>
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-[#E6ECFA] leading-[1.08]">
              School of Technology
            </h1>

            {/* School Description: technology, agriculture, food, hospitality, tourism, nutrition and textile programmes */}
            <p className="text-base sm:text-xl text-[#9AA8C7] leading-relaxed max-w-2xl mx-auto font-normal">
              A student-powered platform for the School of Technology, offering technology, agriculture, food, hospitality, tourism, nutrition and textile programmes.
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
            </div>

            {/* Stats: Kept ONLY 7 Departments and Coming soon for others */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="p-4 rounded-xl bg-[#121C36]/70 border border-[#24315A]">
                <div className="text-2xl font-display font-extrabold text-[#FFC700]">7</div>
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
              Seven Specialized Departments
            </h2>
            <p className="text-sm sm:text-base text-[#9AA8C7]">
              Select your department to view curriculum highlights, course placeholders, and register with your matric number.
            </p>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEPARTMENTS.map((dept, index) => (
              <div
                key={dept.id}
                onClick={() => onSelectDepartment(dept)}
                className={`group relative p-7 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-all duration-300 hover:shadow-[0_0_25px_rgba(47,82,255,0.2)] cursor-pointer flex flex-col justify-between ${
                  index === 6 ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-13 h-13 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:text-white group-hover:bg-[#2F52FF] group-hover:border-[#2F52FF] transition-all duration-300">
                      <DepartmentIcon name={dept.iconName} className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      {dept.shortCode}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-xl text-[#E6ECFA] group-hover:text-white mb-2 transition-colors">
                    {dept.name}
                  </h3>

                  <p className="text-sm text-[#9AA8C7] leading-relaxed mb-6">
                    {dept.oneLiner}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#24315A]/70 flex items-center justify-between text-xs text-[#9AA8C7]">
                  <span className="text-[#FFC700] font-mono">{dept.facilityNotice}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#FFC700] group-hover:text-[#2F52FF] transition-colors">
                    Explore &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ABOUT SECTION (Student Run, No faculty leadership/dean/professors) */}
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
                This student-operated portal was initiated to provide classmates across our seven departments with a clean, centralized digital space. We help each other keep track of student schedules, share peer learning resources, and organize student-led exhibitions.
              </p>
              <p className="text-sm text-[#9AA8C7] leading-relaxed">
                Whether you are studying agricultural methods, computer hardware and programming, food processing, hospitality operations, tourism management, dietary planning, or polymer and textile sciences, this space belongs to all of us.
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
                  <span>Secure matriculation verification preventing duplicate entries</span>
                </div>
              </div>
            </div>

            {/* Right Card */}
            <div className="p-8 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-[0_0_30px_rgba(47,82,255,0.1)] space-y-6">
              <div className="border-b border-[#24315A] pb-4">
                <div className="text-xs font-bold text-[#FFC700] uppercase tracking-wider">
                  Important Information
                </div>
                <h3 className="font-display font-bold text-xl text-[#E6ECFA] mt-1">
                  Independent Student Portal
                </h3>
                <p className="text-xs text-[#9AA8C7] mt-1">
                  {SITE_CONFIG.disclaimer}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
                <p className="text-xs font-semibold text-[#FFC700] uppercase tracking-wider">
                  Representative Desk
                </p>
                <p className="text-xs text-[#E6ECFA] leading-relaxed">
                  Coordinator: <strong>{SITE_CONFIG.contact.representativeName}</strong>
                </p>
                <p className="text-xs text-[#9AA8C7]">
                  Telephone: {SITE_CONFIG.contact.phone} | Email: {SITE_CONFIG.contact.email}
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onNavigateContact}
                  className="px-5 py-2.5 rounded-xl bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Submit an Inquiry or Complaint</span>
                </button>
                <button
                  onClick={onNavigateFaq}
                  className="px-5 py-2.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] text-xs font-semibold hover:border-[#FFC700] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-[#FFC700]" />
                  <span>Read FAQs</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
