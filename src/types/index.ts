export type UserRole = 'student' | 'rep' | 'admin';

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
  createdAt?: string;
  updatedAt?: string;
}

export type SotDepartmentName =
  | 'Agricultural Technology'
  | 'Computer Technology'
  | 'Food Technology'
  | 'Hospitality Management'
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

export interface CourseItem {
  id: string;
  department: string;
  code: string;
  title: string;
  level: string; // 'ND I' | 'ND II' | 'HND I' | 'HND II'
  semester: string; // '1st Semester' | '2nd Semester'
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

