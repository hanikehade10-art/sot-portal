import React, { useState, useEffect } from 'react';
import { DepartmentItem, CourseItem } from '../types';
import { DepartmentIcon } from './PublicLanding';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { INITIAL_COURSES, normalizeCourseLevel } from '../data/coursesAndTimetables';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Layers,
  Clock
} from 'lucide-react';

interface DepartmentDetailPageProps {
  department: DepartmentItem;
  onBack: () => void;
  onJoinDepartment: (deptName: string) => void;
}

const ACADEMIC_LEVELS = ['ND1', 'ND2', 'HND1', 'HND2'];

export const DepartmentDetailPage: React.FC<DepartmentDetailPageProps> = ({
  department,
  onBack,
  onJoinDepartment
}) => {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>('All');

  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const q = query(collection(db, 'courses'), where('department', '==', department.name));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: CourseItem[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as CourseItem);
          });
          setCourses(list);
        } else {
          setCourses([]);
        }
      } catch (err) {
        console.warn('Courses fetch notice:', err);
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [department.name]);

  // Group courses by level
  const coursesByLevel = ACADEMIC_LEVELS.reduce((acc, lvl) => {
    acc[lvl] = courses.filter(c => normalizeCourseLevel(c.level) === lvl);
    return acc;
  }, {} as Record<string, CourseItem[]>);

  const displayedLevels = selectedLevel === 'All' ? ACADEMIC_LEVELS : [selectedLevel];

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
              <span className=" text-xs font-bold px-3 py-1 rounded-full bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
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

        {/* DEPARTMENT COURSES BY LEVEL */}
        <div className="p-7 sm:p-8 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-6 shadow-[0_0_30px_rgba(47,82,255,0.06)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#24315A] pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#0A1224] border border-[#24315A] text-[11px] font-semibold text-[#FFC700] mb-1">
                <Layers className="w-3 h-3 text-[#FFC700]" />
                <span>Department Syllabus</span>
              </div>
              <h3 className="font-display font-bold text-xl sm:text-2xl text-[#E6ECFA]">
                Department Courses by Academic Level
              </h3>
              <p className="text-xs text-[#9AA8C7]">
                Approved curriculum units for National Diploma (ND) and Higher National Diploma (HND) programmes
              </p>
            </div>

            {/* Level Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
              <button
                onClick={() => setSelectedLevel('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedLevel === 'All'
                    ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                    : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                }`}
              >
                All Levels
              </button>
              {ACADEMIC_LEVELS.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedLevel === lvl
                      ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                      : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {loadingCourses ? (
            <div className="p-12 text-center text-xs text-[#9AA8C7] animate-pulse">
              Loading department curriculum...
            </div>
          ) : (
            <div className="space-y-6">
              {displayedLevels.map(lvl => {
                const lvlCourses = coursesByLevel[lvl] || [];
                return (
                  <div key={lvl} className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFC700]" />
                      <h4 className="font-display font-bold text-sm tracking-wide text-[#E6ECFA]">
                        {lvl} Curriculum ({lvlCourses.length} {lvlCourses.length === 1 ? 'course' : 'courses'})
                      </h4>
                    </div>

                    {lvlCourses.length === 0 ? (
                      <div className="p-5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] italic">
                        No courses recorded yet for {lvl} in {department.name}.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {lvlCourses.map(course => (
                          <div
                            key={course.id}
                            className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#2F52FF]/60 transition-all flex flex-col justify-between gap-3 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className=" text-xs font-extrabold px-2.5 py-1 rounded-md bg-[#121C36] text-[#FFC700] border border-[#24315A] group-hover:border-[#FFC700]/50 transition-colors">
                                {course.code}
                              </span>
                              <span className="text-[11px] font-semibold text-[#9AA8C7] px-2 py-0.5 rounded bg-[#121C36] border border-[#24315A]">
                                {course.semester}
                              </span>
                            </div>

                            <div>
                              <h5 className="font-semibold text-sm text-[#E6ECFA] group-hover:text-white transition-colors">
                                {course.title}
                              </h5>
                              <p className="text-[11px] text-[#9AA8C7] mt-0.5">
                                Level: <strong className="text-[#FFC700]">{course.level}</strong>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onJoinDepartment(department.name)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] cursor-pointer shadow-[0_0_15px_rgba(255,199,0,0.25)]"
            >
              Sign up to Enroll in {department.name}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
