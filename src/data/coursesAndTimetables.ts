import { CourseItem, TimetableEntry, CourseSheetLevel, CourseSheetSemester } from '../types';

export function normalizeCourseLevel(level?: string): 'ND1' | 'ND2' | 'HND1' | 'HND2' {
  if (!level) return 'ND1';
  const clean = level.toUpperCase().replace(/\s+/g, '');
  if (clean === 'ND1' || clean === 'NDI' || clean === 'ND-1') return 'ND1';
  if (clean === 'ND2' || clean === 'NDII' || clean === 'ND-2') return 'ND2';
  if (clean === 'HND1' || clean === 'HNDI' || clean === 'HND-1') return 'HND1';
  if (clean === 'HND2' || clean === 'HNDII' || clean === 'HND-2') return 'HND2';
  return 'ND1';
}

export function normalizeCourseSemester(sem?: string): 'First Semester' | 'Second Semester' {
  if (!sem) return 'First Semester';
  const s = sem.toLowerCase();
  if (s.includes('1') || s.includes('first')) return 'First Semester';
  if (s.includes('2') || s.includes('second')) return 'Second Semester';
  return 'First Semester';
}

export function normalizeCourseSheetSemester(sem?: string): CourseSheetSemester {
  if (!sem) return 'First';
  const s = sem.toLowerCase();
  if (s.includes('2') || s.includes('second')) return 'Second';
  return 'First';
}

/**
 * Standard document ID for course sheets: department_level_semester
 * For instance: "Computer Technology_ND1_First"
 */
export function getCourseSheetDocId(
  department: string,
  level: CourseSheetLevel | string,
  semester: CourseSheetSemester | string
): string {
  const normLevel = normalizeCourseLevel(level);
  const normSem = normalizeCourseSheetSemester(semester);
  return `${department.trim()}_${normLevel}_${normSem}`;
}

/**
 * Converts Google Drive "view" links into embedded "preview" links so they render inside the app
 */
export function formatPdfUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // Pattern: https://drive.google.com/file/d/FILE_ID/view...
  const fileDMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/file/d/${fileDMatch[1]}/preview`;
  }

  // Pattern: drive.google.com/open?id=FILE_ID or id=FILE_ID
  const idMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }

  return trimmed;
}

/**
 * Direct download link if available for Google Drive or direct file URL
 */
export function getPdfDownloadUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  const fileDMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileDMatch[1]}`;
  }

  const idMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  }

  return trimmed;
}

// All hardcoded mock courses and timetables removed.
// In accordance with requirements, courses and timetables come ONLY from Firestore.
export const INITIAL_COURSES: CourseItem[] = [];
export const INITIAL_TIMETABLES: TimetableEntry[] = [];
