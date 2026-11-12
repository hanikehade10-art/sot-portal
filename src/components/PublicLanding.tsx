import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  FlaskConical,
  Hotel,
  Compass,
  Activity,
  Layers,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Sparkles,
  ChevronDown,
  UserPlus,
  GraduationCap,
  Trophy,
  Check,
  ExternalLink
} from 'lucide-react';
import { DEPARTMENTS } from '../data/departments';
import { DepartmentItem } from '../types';
import { SITE_CONFIG } from '../config/site';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { WhatsAppChannelButton } from './WhatsAppChannelButton';
import { WhatsAppIcon } from './WhatsAppIcon';

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

// Scroll-linked text statement words
const STATEMENT_TEXT =
  "Designed by students, for students. SOT Portal brings course outlines, CBT quiz practice, peer lecture notes, and academic schedules across our six specialized technology departments together into one fast, modern learning space.";
const STATEMENT_WORDS = STATEMENT_TEXT.split(' ');

// Timeline steps data
const TIMELINE_STEPS = [
  {
    number: 1,
    title: 'Sign Up in Seconds',
    description:
      'Register with your matriculation or JAMB registration number. Select your department and academic level to instantly verify your profile.',
    icon: UserPlus
  },
  {
    number: 2,
    title: 'Access Curated Materials',
    description:
      'Explore structured departmental outlines, peer study notes, past questions, and lecture timetables updated regularly by course reps.',
    icon: BookOpen
  },
  {
    number: 3,
    title: 'Practice CBT Quizzes',
    description:
      'Sharpen your understanding with timed mock CBT exams, fill-in-the-gaps challenges with shared word banks, and instant answer rationales.',
    icon: Sparkles
  },
  {
    number: 4,
    title: 'Ace Your Semester Exams',
    description:
      'Track your study streaks, earn achievement badges, review missed questions, and walk into the examination hall with total confidence.',
    icon: Trophy
  }
];

// FAQs data
const FAQS_DATA = [
  {
    q: 'Who can register and use the SOT Portal?',
    a: 'Any student admitted into any of the six academic departments in the School of Technology (Computer Science, Science Laboratory Technology, Hospitality Management, Tourism Management, Nutrition & Dietetics, and Polymer & Textile Technology) across ND1, ND2, HND1, and HND2.'
  },
  {
    q: 'How does student identity verification work?',
    a: 'We use a simple 2-step verification. Step 1 creates your secure login with email and password. Step 2 links your official matriculation number or JAMB registration number with your department, preventing duplicate registrations and securing student records.'
  },
  {
    q: 'Is the SOT Portal free for students?',
    a: 'Yes, 100% free. This platform is independently organized and sustained by students for students. All curriculum resources, peer notes, CBT quizzes, and study planners are freely accessible.'
  },
  {
    q: 'How do CBT practice quizzes work?',
    a: 'Course reps and faculty contributors publish timed quizzes for each course. You can practice multiple choice questions, true/false checks, and fill-in-the-gaps questions with shared word banks. After submitting, you get a full score breakdown and written explanations.'
  },
  {
    q: 'Can I install this portal as an app on my phone?',
    a: 'Yes! The SOT Portal is an offline-ready Progressive Web App (PWA). You can tap "Install App" or "Add to Home Screen" in your browser (Chrome or Safari) to use it just like a native mobile app.'
  }
];

export const PublicLanding: React.FC<PublicLandingProps> = ({
  openSignUp,
  openLogin,
  onSelectDepartment,
  onNavigateContact,
  onNavigateFaq
}) => {
  const { settings } = useSiteSettings();

  // 1. Accessibility & Performance Detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(motionQuery.matches);

      const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      motionQuery.addEventListener('change', handleMotionChange);

      // Low-end phone heuristic: 4 CPU cores or fewer
      if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
        setIsLowEndDevice(navigator.hardwareConcurrency <= 4);
      }

      return () => motionQuery.removeEventListener('change', handleMotionChange);
    }
  }, []);

  // 2. OPENING ANIMATION (Thin yellow line expands, then wipes to reveal page. 1s total, skippable, once per visit)
  const [showOpening, setShowOpening] = useState(() => {
    if (typeof window === 'undefined') return false;
    const seen = sessionStorage.getItem('sot_intro_seen');
    return !seen;
  });
  const [openingPhase, setOpeningPhase] = useState<'expanding' | 'wiping' | 'done'>('expanding');

  const skipOpening = () => {
    setShowOpening(false);
    setOpeningPhase('done');
    sessionStorage.setItem('sot_intro_seen', 'true');
  };

  useEffect(() => {
    if (!showOpening || prefersReducedMotion) {
      skipOpening();
      return;
    }

    // Step 1: Thin yellow line expands across (450ms)
    const timer1 = setTimeout(() => {
      setOpeningPhase('wiping');
    }, 450);

    // Step 2: Overlay wipes to reveal page (350ms)
    const timer2 = setTimeout(() => {
      skipOpening();
    }, 850);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [showOpening, prefersReducedMotion]);

  // 3. HERO ENTRANCE (line by line slide-up and fade-in)
  const [heroMounted, setHeroMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // 4. TEXT REVEAL (Scroll-linked statement section)
  const textRevealRef = useRef<HTMLDivElement>(null);
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (textRevealRef.current) {
            const rect = textRevealRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            // Progress from when top enters 85% of screen to when center reaches 40% of screen
            const start = windowHeight * 0.85;
            const end = windowHeight * 0.35;
            const current = rect.top;
            const p = Math.max(0, Math.min(1, (start - current) / (start - end)));
            setRevealProgress(p);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  // 5. DEPARTMENT CARDS (IntersectionObserver: fade, slide, and sharpen from blur)
  const deptSectionRef = useRef<HTMLDivElement>(null);
  const [deptCardsVisible, setDeptCardsVisible] = useState(false);

  useEffect(() => {
    const el = deptSectionRef.current;
    if (!el) return;

    if (prefersReducedMotion) {
      setDeptCardsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setDeptCardsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // 6. HOW IT WORKS (Vertical timeline filling with cobalt as you scroll)
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineProgress, setTimelineProgress] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setTimelineProgress(1);
      return;
    }

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const totalHeight = rect.height;
            // Calculate progress through timeline
            const startY = windowHeight * 0.75;
            const progressY = startY - rect.top;
            const frac = Math.max(0, Math.min(1, progressY / (totalHeight * 0.85)));
            setTimelineProgress(frac);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  // 7. GROWING CTA (Scales up to full width as it reaches middle of screen)
  const growingCtaRef = useRef<HTMLDivElement>(null);
  const [ctaScale, setCtaScale] = useState(0.92);

  useEffect(() => {
    if (prefersReducedMotion) {
      setCtaScale(1);
      return;
    }

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (growingCtaRef.current) {
            const rect = growingCtaRef.current.getBoundingClientRect();
            const viewportCenter = window.innerHeight / 2;
            const cardCenter = rect.top + rect.height / 2;
            const distance = Math.abs(viewportCenter - cardCenter);
            const maxDistance = window.innerHeight * 0.6;
            // Scale between 0.92 and 1.0
            const normalized = Math.max(0, Math.min(1, 1 - distance / maxDistance));
            setCtaScale(0.92 + normalized * 0.08);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  // 8. FAQ ACCORDION (Smooth toggle with rotating arrow)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="flex flex-col bg-[#070D1A] text-[#E6ECFA] selection:bg-[#2F52FF] selection:text-white relative overflow-hidden">

      {/* 1. OPENING INTRO OVERLAY */}
      {showOpening && (
        <div
          onClick={skipOpening}
          className={`fixed inset-0 z-50 bg-[#070D1A] flex flex-col items-center justify-center cursor-pointer transition-all duration-350 ease-out ${
            openingPhase === 'wiping'
              ? 'opacity-0 -translate-y-full pointer-events-none'
              : 'opacity-100 translate-y-0'
          }`}
          style={{ willChange: 'transform, opacity' }}
          role="dialog"
          aria-label="Welcome intro"
        >
          {/* Subtle background glow */}
          <div className="absolute w-[500px] h-[500px] bg-[#2F52FF]/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Logo Mark during expansion */}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] shadow-[0_0_25px_rgba(255,199,0,0.3)]">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <span className="font-display font-extrabold text-2xl tracking-tight text-[#E6ECFA]">
                SOT<span className="text-[#FFC700]">.</span>
              </span>
              <span className="block text-[10px] font-bold tracking-widest uppercase text-[#FFC700]">
                School of Technology
              </span>
            </div>
          </div>

          {/* Expanding Thin Yellow Line */}
          <div className="w-64 sm:w-96 h-[2px] bg-[#121C36] rounded-full overflow-hidden relative shadow-[0_0_15px_rgba(47,82,255,0.4)]">
            <div
              className={`h-full bg-gradient-to-r from-[#2F52FF] via-[#FFC700] to-[#2F52FF] shadow-[0_0_16px_rgba(255,199,0,0.8)] transition-transform duration-450 ease-out origin-left ${
                openingPhase === 'expanding' || openingPhase === 'wiping' ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </div>

          {/* Tap to skip hint */}
          <span className="absolute bottom-10 text-[11px] text-[#9AA8C7]/60 tracking-wider uppercase font-medium">
            Tap anywhere to skip
          </span>
        </div>
      )}

      {/* 3. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-24 md:pb-28">
        {/* Soft Background Radial Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#2F52FF]/12 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-[#FFC700]/10 blur-[110px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">

            {/* Tagline kicker */}
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121C36]/90 border border-[#24315A] text-xs text-[#E6ECFA] transition-all duration-500 ease-out ${
                heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#FFC700]" />
              <span className="font-medium">{SITE_CONFIG.tagline} · 6 Academic Departments</span>
            </div>

            {/* Headline slides up and fades in line by line */}
            <div className="space-y-1 sm:space-y-2">
              {/* Line 1 */}
              <h1
                className={`font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-tight text-[#E6ECFA] leading-[1.15] transition-all duration-500 ease-out ${
                  heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: prefersReducedMotion ? '0ms' : '100ms' }}
              >
                Study smarter at the
              </h1>

              {/* Line 2 with key phrase in yellow */}
              <h1
                className={`font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-tight text-[#FFC700] leading-[1.15] transition-all duration-500 ease-out drop-shadow-[0_0_30px_rgba(255,199,0,0.25)] ${
                  heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: prefersReducedMotion ? '0ms' : '220ms' }}
              >
                School of Technology.
              </h1>
            </div>

            {/* School Description */}
            <p
              className={`text-base sm:text-xl text-[#9AA8C7] leading-relaxed max-w-2xl mx-auto font-normal transition-all duration-500 ease-out ${
                heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: prefersReducedMotion ? '0ms' : '340ms' }}
            >
              The centralized student portal for curriculum outlines, CBT quiz practice, peer lecture notes, and academic schedules across all technology departments.
            </p>

            {/* Hero Action: Soft outlined 'See how it works' button + WhatsApp Channel button */}
            <div
              className={`pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5 transition-all duration-500 ease-out ${
                heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: prefersReducedMotion ? '0ms' : '460ms' }}
            >
              <button
                onClick={() => {
                  const el = textRevealRef.current || document.getElementById('departments');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-semibold bg-[#121C36]/80 hover:bg-[#1A2E63] text-[#E6ECFA] hover:text-white border border-[#2F52FF]/40 hover:border-[#2F52FF] transition-all shadow-[0_0_15px_rgba(47,82,255,0.15)] hover:shadow-[0_0_20px_rgba(47,82,255,0.25)] flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span>See how it works</span>
                <ChevronDown className="w-4 h-4 text-[#FFC700] group-hover:translate-y-0.5 transition-transform" />
              </button>

              {/* WhatsApp Channel Button */}
              {settings.whatsappChannelUrl && (
                <WhatsAppChannelButton
                  url={settings.whatsappChannelUrl}
                  variant="solid"
                  className="w-full sm:w-auto py-3"
                />
              )}
            </div>

            {/* Gentle bouncing scroll cue */}
            <div
              onClick={() => {
                const el = textRevealRef.current || document.getElementById('departments');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`pt-1 flex flex-col items-center justify-center gap-1.5 text-[#9AA8C7]/70 hover:text-[#FFC700] transition-all duration-500 ease-out cursor-pointer group select-none ${
                heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: prefersReducedMotion ? '0ms' : '520ms' }}
            >
              <span className="text-[10px] font-bold tracking-widest uppercase">Scroll to explore</span>
              <div className="w-5 h-8 rounded-full border border-[#24315A] group-hover:border-[#FFC700]/60 flex items-start justify-center p-1 transition-colors">
                <div className="w-1.5 h-2 rounded-full bg-[#FFC700] animate-bounce" />
              </div>
            </div>

            {/* Key Faculty Highlights Pill Strip */}
            <div
              className={`pt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left transition-all duration-500 ease-out ${
                heroMounted || prefersReducedMotion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: prefersReducedMotion ? '0ms' : '560ms' }}
            >
              <div className="p-4 rounded-xl bg-[#121C36]/80 border border-[#24315A]">
                <div className="text-2xl font-display font-extrabold text-[#FFC700]">6</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-0.5">Academic Departments</div>
              </div>
              <div className="p-4 rounded-xl bg-[#121C36]/80 border border-[#24315A]">
                <div className="text-2xl font-display font-extrabold text-[#2F52FF]">CBT</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-0.5">Timed Quiz Engine</div>
              </div>
              <div className="p-4 rounded-xl bg-[#121C36]/80 border border-[#24315A]">
                <div className="text-2xl font-display font-extrabold text-[#FFC700]">100%</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-0.5">Free Peer Platform</div>
              </div>
              <div className="p-4 rounded-xl bg-[#121C36]/80 border border-[#24315A]">
                <div className="text-2xl font-display font-extrabold text-[#2F52FF]">PWA</div>
                <div className="text-xs text-[#9AA8C7] font-medium mt-0.5">Offline-Ready Mobile</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. TEXT REVEAL: Statement section where words change from muted grey to bright white as student scrolls */}
      <section
        ref={textRevealRef}
        className="py-20 sm:py-28 bg-[#0A1224] border-y border-[#24315A]/60 relative"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FFC700] block">
            Our Mission Statement
          </span>

          <p className="text-2xl sm:text-3xl md:text-4xl font-display font-bold leading-relaxed tracking-tight flex flex-wrap justify-center gap-x-2 gap-y-1.5">
            {STATEMENT_WORDS.map((word, wIdx) => {
              const wordThreshold = wIdx / STATEMENT_WORDS.length;
              const isLit = prefersReducedMotion || revealProgress >= wordThreshold;

              return (
                <span
                  key={wIdx}
                  className={`transition-colors duration-150 ${
                    isLit
                      ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                      : 'text-[#334155]'
                  }`}
                  style={{ willChange: 'color' }}
                >
                  {word}
                </span>
              );
            })}
          </p>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#9AA8C7]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2F52FF]" />
            <span>Scroll down to explore your department & resources</span>
          </div>
        </div>
      </section>

      {/* 5. DEPARTMENT CARDS (Fade and slide in one after another, sharpen from slight blur) */}
      <section id="departments" ref={deptSectionRef} className="py-20 sm:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FFC700] block">
              Academic Curricula
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
              Six Specialized Departments
            </h2>
            <p className="text-sm sm:text-base text-[#9AA8C7]">
              Select your department to view curriculum highlights, course materials, past question hubs, and student timetable announcements.
            </p>
          </div>

          {/* Department Cards Grid: 6 cards in 3x2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEPARTMENTS.map((dept, index) => {
              const delayMs = index * 75; // Staggered entry under 500ms
              const isAnimated = deptCardsVisible || prefersReducedMotion;

              return (
                <div
                  key={dept.id}
                  onClick={() => onSelectDepartment(dept)}
                  className="group relative p-7 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,82,255,0.25)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
                  style={{
                    opacity: isAnimated ? 1 : 0,
                    transform: isAnimated ? 'translateY(0)' : 'translateY(24px)',
                    filter: isAnimated || isLowEndDevice || prefersReducedMotion ? 'none' : 'blur(8px)',
                    transition: prefersReducedMotion
                      ? 'none'
                      : 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1), filter 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: prefersReducedMotion ? '0ms' : `${delayMs}ms`,
                    willChange: 'transform, opacity, filter'
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:text-white group-hover:bg-[#2F52FF] group-hover:border-[#2F52FF] transition-all duration-300">
                        <DepartmentIcon name={dept.iconName} className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
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
                    <span className="inline-flex items-center gap-1 font-bold text-[#FFC700] group-hover:text-[#2F52FF] transition-colors">
                      Explore Curriculum &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 6. HOW IT WORKS: Vertical timeline filling with cobalt as you scroll */}
      <section
        id="how-it-works"
        ref={timelineRef}
        className="py-20 sm:py-28 bg-[#0A1224] border-y border-[#24315A]/60 relative"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FFC700] block">
              Step-by-Step Guide
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
              How the SOT Portal Works
            </h2>
            <p className="text-sm sm:text-base text-[#9AA8C7]">
              Follow four simple steps to prepare for your lectures, test your skills, and excel in every semester examination.
            </p>
          </div>

          {/* Vertical Timeline Container */}
          <div className="relative pl-8 sm:pl-12">
            
            {/* Background Timeline Track */}
            <div className="absolute left-[15px] sm:left-[23px] top-4 bottom-4 w-[3px] bg-[#1E293B] rounded-full" />

            {/* Filled Progress Line (Cobalt) */}
            <div
              className="absolute left-[15px] sm:left-[23px] top-4 w-[3px] bg-[#2F52FF] rounded-full shadow-[0_0_12px_rgba(47,82,255,0.7)] transition-all duration-200 ease-out"
              style={{
                height: `${Math.min(100, Math.max(0, timelineProgress * 100))}%`,
                willChange: 'height'
              }}
            />

            {/* Steps List */}
            <div className="space-y-12">
              {TIMELINE_STEPS.map((step, sIdx) => {
                const stepThreshold = sIdx / (TIMELINE_STEPS.length - 1);
                const isStepReached = prefersReducedMotion || timelineProgress >= stepThreshold - 0.05;
                const IconComponent = step.icon;

                return (
                  <div key={step.number} className="relative flex items-start gap-4 sm:gap-6 group">
                    
                    {/* Step Circle Indicator */}
                    <div
                      className={`absolute -left-[30px] sm:-left-[42px] top-1 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center font-display font-extrabold text-xs sm:text-sm transition-all duration-300 ${
                        isStepReached
                          ? 'bg-[#2F52FF] text-[#FFC700] border-[#FFC700] shadow-[0_0_20px_rgba(47,82,255,0.8)] scale-110'
                          : 'bg-[#0A1224] text-[#64748B] border-[#24315A] scale-100'
                      }`}
                      style={{ willChange: 'transform, background-color, border-color' }}
                    >
                      {step.number}
                    </div>

                    {/* Step Card Content */}
                    <div
                      className={`flex-1 p-5 sm:p-6 rounded-2xl border transition-all duration-300 ${
                        isStepReached
                          ? 'bg-[#121C36] border-[#2F52FF]/50 shadow-[0_8px_25px_rgba(47,82,255,0.15)]'
                          : 'bg-[#121C36]/50 border-[#24315A]/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#FFC700] font-mono uppercase">
                            Step 0{step.number}
                          </span>
                        </div>
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isStepReached
                              ? 'bg-[#2F52FF]/20 text-[#60A5FA]'
                              : 'bg-[#0A1224] text-[#64748B]'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                      </div>

                      <h3 className="font-heading font-bold text-lg sm:text-xl text-[#E6ECFA] mb-1.5">
                        {step.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#9AA8C7] leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </section>

      {/* 7. GROWING CTA: Large cobalt card that scales up to full width as it reaches middle of screen */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
          
          <div
            ref={growingCtaRef}
            className="w-full max-w-5xl rounded-3xl p-8 sm:p-14 bg-gradient-to-br from-[#122254] via-[#2F52FF] to-[#1E3A8A] border border-[#60A5FA]/40 shadow-[0_20px_60px_rgba(47,82,255,0.35)] text-center relative overflow-hidden transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${ctaScale})`,
              willChange: 'transform'
            }}
          >
            {/* Subtle light mesh in background */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#FFC700]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-5">
              <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-sm border border-white/20">
                School of Technology Community
              </span>

              <h2 className="font-heading font-extrabold text-3xl sm:text-5xl text-white tracking-tight leading-tight">
                Join SOT Portal
              </h2>

              <p className="text-sm sm:text-lg text-white/90 leading-relaxed max-w-xl mx-auto">
                Connect with classmates across your department, access shared lecture materials, and practice CBT quizzes tailored to your exams.
              </p>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <button
                  onClick={openSignUp}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-extrabold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_25px_rgba(255,199,0,0.35)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Create Free Account</span>
                  <ArrowRight className="w-5 h-5 text-[#0A1224]" />
                </button>

                <button
                  onClick={openLogin}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-base font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
                >
                  <span>Student Login</span>
                </button>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-white/80">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#FFC700]" /> 100% Free
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#FFC700]" /> Instant Verification
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#FFC700]" /> 6 Departments
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. FAQ ACCORDION: Smooth accordion with rotating arrow */}
      <section id="faq" className="py-20 sm:py-28 bg-[#0A1224] border-t border-[#24315A]/60 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FFC700] block">
              Got Questions?
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-[#9AA8C7]">
              Everything you need to know about registering, accessing departmental resources, and taking CBT quizzes.
            </p>
          </div>

          {/* Accordion List */}
          <div className="space-y-3.5">
            {FAQS_DATA.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? 'bg-[#121C36] border-[#2F52FF]/60 shadow-[0_8px_25px_rgba(47,82,255,0.12)]'
                      : 'bg-[#121C36]/60 border-[#24315A] hover:border-[#2F52FF]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <span className="font-heading font-bold text-base sm:text-lg text-[#E6ECFA]">
                      {faq.q}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 ease-out ${
                        isOpen
                          ? 'rotate-180 bg-[#2F52FF] text-white'
                          : 'rotate-0 bg-[#0A1224] text-[#9AA8C7]'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Smooth height expansion via CSS grid */}
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-xs sm:text-sm text-[#9AA8C7] leading-relaxed border-t border-[#24315A]/50 pt-4">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={onNavigateFaq}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFC700] hover:text-[#ffd233] transition-colors cursor-pointer"
            >
              <span>View full knowledge base & FAQs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </section>

      {/* 9. CONTACT CARDS: WhatsApp channel and Contact page in small rounded cards */}
      <section id="contact" className="py-20 sm:py-28 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FFC700] block">
              Direct Support & Updates
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#E6ECFA]">
              Stay Connected With Your Faculty
            </h2>
            <p className="text-sm sm:text-base text-[#9AA8C7]">
              Join our official WhatsApp channel for urgent notices or send a direct enquiry to your department course reps.
            </p>
          </div>

          {/* 2 Small Rounded Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* WhatsApp Card */}
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-emerald-500/50 transition-all duration-300 flex flex-col justify-between space-y-5 shadow-lg group">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/40 transition-colors">
                  <WhatsAppIcon className="w-6 h-6 fill-current text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#E6ECFA] mb-1">
                    WhatsApp Announcements
                  </h3>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">
                    Get instant timetable releases, lecture venue shifts, and semester exam reminders right on WhatsApp.
                  </p>
                </div>
              </div>

              <div>
                {settings.whatsappChannelUrl ? (
                  <a
                    href={settings.whatsappChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
                  >
                    <span>Join Official Channel</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <span>Channel Link Coming Soon</span>
                  </button>
                )}
              </div>
            </div>

            {/* Contact Page Card */}
            <div className="p-6 rounded-2xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] transition-all duration-300 flex flex-col justify-between space-y-5 shadow-lg group">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] group-hover:bg-[#2F52FF]/10 group-hover:border-[#2F52FF]/40 group-hover:text-white transition-colors">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#E6ECFA] mb-1">
                    Contact Student Rep Desk
                  </h3>
                  <p className="text-xs text-[#9AA8C7] leading-relaxed">
                    Have questions about course registration, timetables, or feedback? Send a direct enquiry to your department reps.
                  </p>
                </div>
              </div>

              <div>
                <button
                  onClick={onNavigateContact}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#121C36] hover:bg-[#2F52FF] text-[#E6ECFA] hover:text-white border border-[#24315A] hover:border-[#2F52FF] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>Open Contact Desk</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FFC700] group-hover:text-white" />
                </button>
              </div>
            </div>

          </div>

          {/* Secondary Sign Up & Login: Smaller copy at the very end of the page, under the FAQ */}
          <div className="mt-14 pt-8 border-t border-[#24315A]/60 text-center space-y-3">
            <p className="text-xs text-[#9AA8C7]">
              Ready to explore your department materials and practice CBT quizzes?
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={openSignUp}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_15px_rgba(255,199,0,0.3)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4 text-[#0A1224]" />
              </button>

              <button
                onClick={openLogin}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#121C36] text-[#E6ECFA] border border-[#24315A] hover:border-[#2F52FF] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Student Login</span>
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
