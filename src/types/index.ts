export type UserRole = 'student' | 'rep' | 'admin';

export interface BookmarkItem {
  id: string; // unique id (or target id)
  type: 'course' | 'material' | 'announcement';
  title: string;
  link?: string;
  code?: string;
  category?: string;
  department?: string;
  createdAt: string;
}

export interface GradingScaleEntry {
  grade: string;
  minScore: number;
  maxScore: number;
  points: number;
}

export interface GpaCourseEntry {
  id: string;
  code: string;
  title: string;
  units: number;
  grade: string;
  points: number;
}

export interface SemesterGpaRecord {
  semesterId: string;
  semesterName: string;
  courses: GpaCourseEntry[];
  totalUnits: number;
  totalQualityPoints: number;
  gpa: number;
  updatedAt?: string;
}

export interface StudyPlannerTask {
  id: string;
  title: string;
  courseCode?: string;
  dueDate?: string;
  priority?: 'normal' | 'high';
  done: boolean;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName?: string;
  department?: string;
  matricNumber?: string;
  profileComplete: boolean;
  role: UserRole;
  disabled?: boolean;
  lastSeenAnnouncements?: string;
  bookmarks?: BookmarkItem[];
  streakCount?: number;
  longestStreak?: number;
  lastActiveDate?: string; // YYYY-MM-DD formatted in Africa/Lagos
  level?: 'ND1' | 'ND2' | 'HND1' | 'HND2' | string;
  gpaRecords?: Record<string, SemesterGpaRecord>;
  studyPlanner?: StudyPlannerTask[];
  createdAt?: string;
  updatedAt?: string;
}

export type SotDepartmentName =
  | 'Computer Technology'
  | 'Food Science and Technology'
  | 'Hospitality Management'
  | 'Tourism Management'
  | 'Polymer and Textile Management'
  | 'Nutrition and Dietetics'
  // Legacy aliases for backward compatibility with existing Firestore documents
  | 'Food Technology'
  | 'Leisure & Tourism Management'
  | 'Nutrition & Dietetics'
  | 'Polymer & Textile Technology';

export interface DepartmentItem {
  id: string;
  name: SotDepartmentName;
  shortCode: string;
  iconName: string;
  oneLiner: string;
  description: string;
  programFocus: string[];
  careerProspects: string[];
  facilityNotice: string;
}

export type MessageType = 'Complaint' | 'Review' | 'Enquiry';
export type MessageStatus = 'New' | 'Read' | 'Resolved';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  type: MessageType;
  message: string;
  status: MessageStatus;
  userId?: string;
  uid?: string;
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AcademicLevel = 'ND1' | 'ND2' | 'HND1' | 'HND2' | 'ND I' | 'ND II' | 'HND I' | 'HND II';

export type CourseMaterialCategory = 'Lecture Note' | 'Past Question' | 'Video' | 'Other';
export type ResourceCategory = 'Lecture Note' | 'Past Question' | 'Video' | 'Assignment' | 'Other';

export interface CourseMaterial {
  id?: string;
  title: string;
  url: string;
  category: CourseMaterialCategory;
}

export interface ResourceItem {
  id: string;
  department: string;
  level: string; // 'ND1' | 'ND2' | 'HND1' | 'HND2'
  semester: string; // 'First Semester' | 'Second Semester'
  courseCode: string;
  title: string;
  category: ResourceCategory;
  url: string;
  description?: string;
  uploadedBy: string; // uid
  uploadedByEmail: string;
  uploadedByRole?: string; // 'Course Rep' | 'admin' | string
  createdAt: string;
  updatedAt?: string;
}

export interface CourseItem {
  id: string;
  department: string;
  code: string;
  title: string;
  level: string; // 'ND1' | 'ND2' | 'HND1' | 'HND2' (or 'ND I' | 'ND II' | 'HND I' | 'HND II')
  semester: string; // 'First Semester' | 'Second Semester' (or '1st Semester' | '2nd Semester')
  units: number;
  type: 'Core' | 'Elective';
  description?: string;
  materials?: CourseMaterial[];
  createdAt?: string;
  updatedAt?: string;
}

export type TimetableType = 'class' | 'exam';

export interface TimetableEntry {
  id: string;
  department: string;
  level: string; // 'ND I' | 'ND II' | 'HND I' | 'HND II'
  day: string; // 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  startTime: string; // e.g. "08:00 AM"
  endTime: string; // e.g. "10:00 AM"
  courseCode: string;
  venue: string;
  type: TimetableType;
  date?: string; // Optional specific date for exams
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  category: 'Academic' | 'Student Notice' | 'Department' | 'General';
  department: string; // 'All' or specific department
  urgent?: boolean;
  createdAt: string;
  author?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AiChatMode = 'portal' | 'study';

export interface ChatMessage {
  id: string;
  sender: 'student' | 'assistant';
  text: string;
  timestamp: number;
  mode?: AiChatMode;
}

