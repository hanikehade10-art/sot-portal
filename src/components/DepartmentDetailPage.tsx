import React from 'react';
import { DepartmentItem } from '../types';
import { DepartmentIcon } from './PublicLanding';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  GraduationCap
} from 'lucide-react';

interface DepartmentDetailPageProps {
  department: DepartmentItem;
  onBack: () => void;
  onJoinDepartment: (deptName: string) => void;
}

export const DepartmentDetailPage: React.FC<DepartmentDetailPageProps> = ({
  department,
  onBack,
  onJoinDepartment
}) => {
  return (
    <div className="py-12 md:py-20 bg-[#0A1224] text-[#E6ECFA] min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Navigation Breadcrumb */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#2F52FF] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Departments</span>
        </button>

        {/* Hero Banner for Department */}
        <div className="relative p-7 sm:p-10 rounded-3xl bg-[#121C36] border border-[#24315A] shadow-[0_0_40px_rgba(47,82,255,0.1)] overflow-hidden">
          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-16 h-16 rounded-2xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] shadow-[0_0_20px_rgba(255,199,0,0.2)]">
                <DepartmentIcon name={department.iconName} className="w-8 h-8" />
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                CODE: {department.shortCode}
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-[#FFC700] tracking-wider uppercase block">
                Department Programme
              </span>
              <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-[#E6ECFA] mt-1">
                {department.name}
              </h1>
            </div>

            <p className="text-base sm:text-lg text-[#E6ECFA] leading-relaxed max-w-3xl">
              {department.oneLiner}
            </p>

            <p className="text-sm text-[#9AA8C7] leading-relaxed max-w-3xl">
              {department.description}
            </p>

            <div className="pt-2">
              <button
                onClick={() => onJoinDepartment(department.name)}
                className="px-7 py-3.5 rounded-xl text-sm font-extrabold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_25px_rgba(255,199,0,0.35)] hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
              >
                <span>Join this Department</span>
                <ArrowRight className="w-4 h-4 text-[#0A1224]" />
              </button>
            </div>
          </div>
        </div>

        {/* Programme Focus & Career Prospects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="p-7 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
            <h3 className="font-display font-bold text-lg text-[#E6ECFA] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#FFC700]" />
              <span>Core Programme Highlights</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-[#E6ECFA]">
              {department.programFocus.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
                  <span className="w-5 h-5 rounded-md bg-[#121C36] text-[#FFC700] font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {idx + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-7 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
            <h3 className="font-display font-bold text-lg text-[#E6ECFA] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2F52FF]" />
              <span>Vocational Career Pathways</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-[#E6ECFA]">
              {department.careerProspects.map((cp, idx) => (
                <li key={idx} className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0A1224] border border-[#24315A]">
                  <CheckCircle2 className="w-4 h-4 text-[#2F52FF] shrink-0" />
                  <span>{cp}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Courses Offered (Placeholder as requested) */}
        <div className="p-7 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
          <div className="flex items-center justify-between border-b border-[#24315A] pb-3">
            <div>
              <h3 className="font-display font-bold text-lg text-[#E6ECFA]">
                Semester Course Catalog
              </h3>
              <p className="text-xs text-[#9AA8C7]">Approved student syllabus breakdown</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
              Under Review
            </span>
          </div>

          <div className="p-8 rounded-xl bg-[#0A1224] border border-[#24315A] text-center space-y-2">
            <BookOpen className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
            <div className="text-sm font-semibold text-[#E6ECFA]">
              Detailed Course Syllabi & Lecture Modules: <span className="text-[#FFC700]">Coming soon</span>
            </div>
            <p className="text-xs text-[#9AA8C7] max-w-md mx-auto">
              The student committee is currently digitizing the complete course guides and booklists for this department. Registered students will receive course access directly in their portal.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onJoinDepartment(department.name)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] cursor-pointer"
            >
              Sign up to Enroll in {department.name}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
