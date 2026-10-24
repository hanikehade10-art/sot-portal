export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  fullName?: string;
  department?: string;
  matricNumber?: string;
  profileComplete: boolean;
  role: UserRole;
  disabled?: boolean;
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
  createdAt: string;
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

