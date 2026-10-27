import { GradingScaleEntry } from '../types';

export const DEFAULT_GRADING_SCALE: GradingScaleEntry[] = [
  { grade: 'A', minScore: 75, maxScore: 100, points: 4.00 },
  { grade: 'AB', minScore: 70, maxScore: 74, points: 3.50 },
  { grade: 'B', minScore: 65, maxScore: 69, points: 3.25 },
  { grade: 'BC', minScore: 60, maxScore: 64, points: 3.00 },
  { grade: 'C', minScore: 55, maxScore: 59, points: 2.75 },
  { grade: 'CD', minScore: 50, maxScore: 54, points: 2.50 },
  { grade: 'D', minScore: 45, maxScore: 49, points: 2.25 },
  { grade: 'E', minScore: 40, maxScore: 44, points: 2.00 },
  { grade: 'F', minScore: 0, maxScore: 39, points: 0.00 }
];

export function getClassOfDegree(cgpa: number): { label: string; color: string; badgeClass: string } {
  if (cgpa >= 3.50) {
    return {
      label: 'Distinction',
      color: '#FFC700',
      badgeClass: 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/40'
    };
  }
  if (cgpa >= 3.00) {
    return {
      label: 'Upper Credit',
      color: '#2F52FF',
      badgeClass: 'bg-[#2F52FF]/20 text-[#60A5FA] border-[#2F52FF]/40'
    };
  }
  if (cgpa >= 2.50) {
    return {
      label: 'Lower Credit',
      color: '#10B981',
      badgeClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
    };
  }
  if (cgpa >= 2.00) {
    return {
      label: 'Pass',
      color: '#F59E0B',
      badgeClass: 'bg-amber-950/60 text-amber-400 border-amber-500/40'
    };
  }
  return {
    label: 'Fail / Probation',
    color: '#EF4444',
    badgeClass: 'bg-rose-950/60 text-rose-400 border-rose-500/40'
  };
}

export const SEMESTER_OPTIONS = [
  { id: 'nd1-sem1', name: 'ND I - 1st Semester', level: 'ND1', semester: 'First Semester' },
  { id: 'nd1-sem2', name: 'ND I - 2nd Semester', level: 'ND1', semester: 'Second Semester' },
  { id: 'nd2-sem1', name: 'ND II - 1st Semester', level: 'ND2', semester: 'First Semester' },
  { id: 'nd2-sem2', name: 'ND II - 2nd Semester', level: 'ND2', semester: 'Second Semester' },
  { id: 'hnd1-sem1', name: 'HND I - 1st Semester', level: 'HND1', semester: 'First Semester' },
  { id: 'hnd1-sem2', name: 'HND I - 2nd Semester', level: 'HND1', semester: 'Second Semester' },
  { id: 'hnd2-sem1', name: 'HND II - 1st Semester', level: 'HND2', semester: 'First Semester' },
  { id: 'hnd2-sem2', name: 'HND II - 2nd Semester', level: 'HND2', semester: 'Second Semester' }
];
