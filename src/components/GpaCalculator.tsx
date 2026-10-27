import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { GpaCourseEntry, SemesterGpaRecord } from '../types';
import { useGradingScale } from '../hooks/useGradingScale';
import { getClassOfDegree, SEMESTER_OPTIONS } from '../config/gradingScale';
import { INITIAL_COURSES, normalizeCourseLevel, normalizeCourseSemester } from '../data/coursesAndTimetables';
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Award,
  Sparkles,
  BookOpen,
  Info,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export const GpaCalculator: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { scale } = useGradingScale();

  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(SEMESTER_OPTIONS[0].id);
  const [courses, setCourses] = useState<GpaCourseEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New course input row state
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUnits, setNewUnits] = useState<number>(3);
  const [newGrade, setNewGrade] = useState<string>('A');

  const selectedSemester = SEMESTER_OPTIONS.find(s => s.id === selectedSemesterId) || SEMESTER_OPTIONS[0];

  // Load existing records for the selected semester from profile.gpaRecords
  useEffect(() => {
    const existingSem = profile?.gpaRecords?.[selectedSemesterId];
    if (existingSem && existingSem.courses && existingSem.courses.length > 0) {
      setCourses(existingSem.courses);
    } else {
      // If none saved, try pre-filling from department curriculum if available
      const dept = profile?.department;
      if (dept) {
        const defaults = INITIAL_COURSES.filter(c =>
          c.department === dept &&
          normalizeCourseLevel(c.level) === selectedSemester.level &&
          normalizeCourseSemester(c.semester) === selectedSemester.semester
        );

        if (defaults.length > 0) {
          const defaultEntries: GpaCourseEntry[] = defaults.map(c => ({
            id: `init-${c.id}`,
            code: c.code,
            title: c.title,
            units: c.units || 3,
            grade: 'A',
            points: getPointsForGrade('A')
          }));
          setCourses(defaultEntries);
          return;
        }
      }

      // Fallback empty sample
      setCourses([
        { id: '1', code: 'GNS 101', title: 'Use of English', units: 2, grade: 'A', points: 4.0 },
        { id: '2', code: 'MTH 111', title: 'Logic & Algebra', units: 3, grade: 'AB', points: 3.5 }
      ]);
    }
  }, [selectedSemesterId, profile?.gpaRecords]);

  function getPointsForGrade(grade: string): number {
    const found = scale.find(s => s.grade === grade);
    return found ? found.points : 0;
  }

  // Update grade for a course
  const handleGradeChange = (id: string, newGradeVal: string) => {
    const pts = getPointsForGrade(newGradeVal);
    setCourses(prev =>
      prev.map(c => (c.id === id ? { ...c, grade: newGradeVal, points: pts } : c))
    );
  };

  // Update units for a course
  const handleUnitsChange = (id: string, newUnitVal: number) => {
    setCourses(prev =>
      prev.map(c => (c.id === id ? { ...c, units: Math.max(1, newUnitVal) } : c))
    );
  };

  // Remove a course
  const handleRemoveCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  // Add course
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const pts = getPointsForGrade(newGrade);
    const newEntry: GpaCourseEntry = {
      id: `c-${Date.now()}`,
      code: newCode.trim().toUpperCase(),
      title: newTitle.trim() || newCode.trim().toUpperCase(),
      units: Number(newUnits) || 3,
      grade: newGrade,
      points: pts
    };
    setCourses(prev => [...prev, newEntry]);
    setNewCode('');
    setNewTitle('');
    setNewUnits(3);
    setNewGrade('A');
  };

  // Load department courses
  const handleLoadDeptCourses = () => {
    const dept = profile?.department;
    if (!dept) return;

    const deptCourses = INITIAL_COURSES.filter(c =>
      c.department === dept &&
      normalizeCourseLevel(c.level) === selectedSemester.level &&
      normalizeCourseSemester(c.semester) === selectedSemester.semester
    );

    if (deptCourses.length === 0) {
      alert(`No curriculum courses found for ${dept} in ${selectedSemester.name}. You can add custom courses manually.`);
      return;
    }

    const newEntries: GpaCourseEntry[] = deptCourses.map(c => ({
      id: `dept-${c.id}-${Date.now()}`,
      code: c.code,
      title: c.title,
      units: c.units || 3,
      grade: 'A',
      points: getPointsForGrade('A')
    }));

    setCourses(newEntries);
  };

  // Calculations for current semester
  const totalUnits = courses.reduce((sum, c) => sum + (c.units || 0), 0);
  const totalQualityPoints = courses.reduce((sum, c) => sum + (c.units || 0) * (c.points || 0), 0);
  const semesterGpa = totalUnits > 0 ? totalQualityPoints / totalUnits : 0;

  // Running CGPA across all recorded semesters in user profile (merged with current work-in-progress semester)
  const allSemesterRecords: Record<string, SemesterGpaRecord> = {
    ...(profile?.gpaRecords || {}),
    [selectedSemesterId]: {
      semesterId: selectedSemesterId,
      semesterName: selectedSemester.name,
      courses,
      totalUnits,
      totalQualityPoints,
      gpa: semesterGpa,
      updatedAt: new Date().toISOString()
    }
  };

  let cumulativeUnits = 0;
  let cumulativeQP = 0;
  Object.values(allSemesterRecords).forEach(sem => {
    if (sem.totalUnits > 0) {
      cumulativeUnits += sem.totalUnits;
      cumulativeQP += sem.totalQualityPoints;
    }
  });

  const cumulativeCgpa = cumulativeUnits > 0 ? cumulativeQP / cumulativeUnits : semesterGpa;
  const degreeClass = getClassOfDegree(cumulativeCgpa);

  // Save to student user document
  const handleSaveToProfile = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const semRecord: SemesterGpaRecord = {
        semesterId: selectedSemesterId,
        semesterName: selectedSemester.name,
        courses,
        totalUnits,
        totalQualityPoints,
        gpa: semesterGpa,
        updatedAt: new Date().toISOString()
      };

      const updatedRecords = {
        ...(profile?.gpaRecords || {}),
        [selectedSemesterId]: semRecord
      };

      await updateDoc(doc(db, 'users', user.uid), {
        gpaRecords: updatedRecords
      });

      await refreshProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving GPA record:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl text-[#E6ECFA] flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#FFC700]" />
            <span>GPA & CGPA Calculator</span>
          </h2>
          <p className="text-xs text-[#9AA8C7] mt-0.5">
            Calculate your semester Grade Point Average (GPA) and track your cumulative CGPA.
          </p>
        </div>

        {/* Save Status / Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved to your profile!</span>
            </span>
          )}
          <button
            onClick={handleSaveToProfile}
            disabled={saving || courses.length === 0}
            className="px-3.5 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(47,82,255,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Record</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row: Semester GPA | Running CGPA | Class of Degree */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Semester GPA */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A] space-y-1">
          <div className="text-[11px] font-semibold text-[#9AA8C7] uppercase tracking-wider">
            Semester GPA
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#FFC700]">
              {semesterGpa.toFixed(2)}
            </span>
            <span className="text-xs text-[#9AA8C7]">/ 4.00</span>
          </div>
          <div className="text-[11px] text-[#9AA8C7]">
            {totalUnits} Units • {totalQualityPoints.toFixed(1)} Quality Pts
          </div>
        </div>

        {/* Running CGPA */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A] space-y-1">
          <div className="text-[11px] font-semibold text-[#9AA8C7] uppercase tracking-wider">
            Running CGPA
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#2F52FF]">
              {cumulativeCgpa.toFixed(2)}
            </span>
            <span className="text-xs text-[#9AA8C7]">/ 4.00</span>
          </div>
          <div className="text-[11px] text-[#9AA8C7]">
            Across {cumulativeUnits} Total Cumulative Units
          </div>
        </div>

        {/* Class of Degree */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A] space-y-1">
          <div className="text-[11px] font-semibold text-[#9AA8C7] uppercase tracking-wider">
            Projected Standing
          </div>
          <div className="pt-0.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${degreeClass.badgeClass}`}>
              <Award className="w-3.5 h-3.5" />
              <span>{degreeClass.label}</span>
            </span>
          </div>
          <div className="text-[11px] text-[#9AA8C7] pt-0.5">
            Official Nigerian Polytechnic Standard
          </div>
        </div>
      </div>

      {/* Semester Selector Pill Bar */}
      <div className="p-2 rounded-xl bg-[#121C36] border border-[#24315A] flex items-center gap-1.5 overflow-x-auto">
        {SEMESTER_OPTIONS.map(sem => {
          const isSelected = sem.id === selectedSemesterId;
          const hasSaved = !!profile?.gpaRecords?.[sem.id];
          return (
            <button
              key={sem.id}
              onClick={() => setSelectedSemesterId(sem.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0A1224]'
              }`}
            >
              <span>{sem.name}</span>
              {hasSaved && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#FFC700]' : 'bg-emerald-400'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Course Table / Editor Card */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#24315A]">
          <div>
            <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
              {selectedSemester.name} Courses ({courses.length})
            </h3>
            <span className="text-[11px] text-[#9AA8C7]">
              Enter your course grades to see instant GPA calculation
            </span>
          </div>

          <button
            onClick={handleLoadDeptCourses}
            className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] hover:border-[#FFC700] text-[#FFC700] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Load {profile?.department ? 'Dept' : 'Standard'} Courses</span>
          </button>
        </div>

        {/* Table of Courses */}
        {courses.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#9AA8C7] space-y-2">
            <p>No courses added for this semester yet.</p>
            <button
              onClick={handleLoadDeptCourses}
              className="text-[#FFC700] font-semibold hover:underline"
            >
              Load curriculum courses automatically
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#24315A] text-[#9AA8C7] text-[11px]">
                  <th className="pb-2 font-semibold">Course Code</th>
                  <th className="pb-2 font-semibold">Course Title</th>
                  <th className="pb-2 font-semibold text-center w-20">Units</th>
                  <th className="pb-2 font-semibold text-center w-28">Grade</th>
                  <th className="pb-2 font-semibold text-center w-20">Points</th>
                  <th className="pb-2 font-semibold text-center w-24">Quality Pts</th>
                  <th className="pb-2 font-semibold text-right w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24315A]/60">
                {courses.map(course => {
                  const qp = (course.units || 0) * (course.points || 0);
                  return (
                    <tr key={course.id} className="hover:bg-[#0A1224]/40 transition-colors">
                      <td className="py-2 text-[#FFC700] font-bold">
                        {course.code}
                      </td>
                      <td className="py-2 text-[#E6ECFA] max-w-xs truncate pr-2">
                        {course.title}
                      </td>
                      <td className="py-2 text-center">
                        <select
                          value={course.units}
                          onChange={(e) => handleUnitsChange(course.id, Number(e.target.value))}
                          className="px-2 py-1 rounded bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                        >
                          {[1, 2, 3, 4, 5, 6].map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-center">
                        <select
                          value={course.grade}
                          onChange={(e) => handleGradeChange(course.id, e.target.value)}
                          className="px-2.5 py-1 rounded bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
                        >
                          {scale.map(s => (
                            <option key={s.grade} value={s.grade}>
                              {s.grade} ({s.points.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-center text-[#9AA8C7]">
                        {course.points.toFixed(2)}
                      </td>
                      <td className="py-2 text-center text-[#E6ECFA] font-bold">
                        {qp.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRemoveCourse(course.id)}
                          title="Remove course"
                          className="p-1 text-[#9AA8C7] hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Course Mini-Form */}
        <form onSubmit={handleAddCourse} className="pt-3 border-t border-[#24315A] flex flex-wrap items-center gap-2">
          <input
            type="text"
            required
            placeholder="Code (e.g. COM 111)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className="w-28 px-2.5 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#FFC700] font-bold focus:outline-none focus:border-[#2F52FF]"
          />
          <input
            type="text"
            placeholder="Title (Optional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#9AA8C7]">Units:</span>
            <select
              value={newUnits}
              onChange={(e) => setNewUnits(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
            >
              {[1, 2, 3, 4, 5, 6].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#9AA8C7]">Grade:</span>
            <select
              value={newGrade}
              onChange={(e) => setNewGrade(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
            >
              {scale.map(s => (
                <option key={s.grade} value={s.grade}>
                  {s.grade} ({s.points.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#2F52FF] text-[#60A5FA] hover:bg-[#2F52FF] hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course</span>
          </button>
        </form>
      </div>

      {/* Grading Scale Reference Info Card */}
      <div className="p-3 sm:p-4 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#FFC700] uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Active Grading Scale Reference (4.00 Max)</span>
          </span>
          <span className="text-[10px] text-[#9AA8C7]">Editable in Admin Settings</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 text-center">
          {scale.map(s => (
            <div key={s.grade} className="p-2 rounded-lg bg-[#121C36] border border-[#24315A]/70">
              <div className="text-xs font-extrabold text-[#FFC700]">{s.grade}</div>
              <div className="text-[10px] text-[#9AA8C7]">{s.minScore}-{s.maxScore}%</div>
              <div className="text-[11px] font-bold text-[#E6ECFA] mt-0.5">{s.points.toFixed(2)} pts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
