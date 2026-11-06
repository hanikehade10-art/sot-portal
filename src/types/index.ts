export type UserRole = 'student' | 'rep' | 'admin';

export interface BookmarkItem {
  id: string; // unique id (or target id)
  type: 'course' | 'topic' | 'material' | 'resource' | 'announcement' | 'quiz-question';
  title: string;
  link?: string;
  url?: string;
  code?: string;
  category?: string;
  department?: string;
  courseId?: string;
  topicId?: string;
  itemType?: string;
  questionText?: string;
  options?: string[];
  correctAnswerText?: string;
  explanation?: string;
  whyNotNotes?: Record<string, string>;
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
  idType?: 'matric' | 'jamb';
  jambNumber?: string;
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
  privacyAcceptedAt?: string;
  lastLoginAt?: string;
  loginCount?: number;
  lastActiveAt?: string; // Updated at most once every 10 minutes while app is open
  lastDevice?: 'Android' | 'iPhone' | 'Desktop';
  completedTopics?: string[]; // IDs of completed syllabus topics
  lastTopic?: {
    topicId: string;
    courseId: string;
    courseCode?: string;
    courseTitle?: string;
    topicTitle?: string;
    updatedAt: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type StudentActivityType =
  | 'login'
  | 'logout'
  | 'lesson opened'
  | 'topic completed'
  | 'quiz started'
  | 'quiz submitted'
  | 'past question opened';

export interface StudentActivityItem {
  id?: string;
  uid: string;
  name: string;
  department: string;
  level: string;
  type: StudentActivityType;
  title: string;
  createdAt: string;
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

export type ResourceType = 'Video' | 'Note' | 'Past Question' | 'Solution' | 'Other';
export type CourseMaterialCategory = 'Lecture Note' | 'Past Question' | 'Video' | 'Other';
export type ResourceCategory = 'Course Outline' | 'Lecture Note' | 'Past Question' | 'Solution' | 'Video' | 'Assignment' | 'Other';

export type CourseAccentColor = 'Teal' | 'Emerald' | 'Indigo' | 'Sky' | 'Amber' | 'Rose';

export type TopicLevelTag = 'Beginner' | 'Intermediate' | 'Advanced';

export interface FurtherReadingItem {
  title: string;
  url: string;
}

export interface TopicItem {
  id: string;
  courseId: string;
  department: string;
  level: string; // 'ND1' | 'ND2' | 'HND1' | 'HND2'
  semester: string; // 'First Semester' | 'Second Semester'
  title: string;
  order: number;
  levelTag?: TopicLevelTag; // 'Beginner' | 'Intermediate' | 'Advanced'
  whatYoullLearn?: string[]; // Bulleted objectives: "What you'll learn"
  beforeYouBegin?: string; // Optional prerequisites or instructions
  estimatedMinutes?: number; // Estimated reading/learning time in minutes
  videoUrl?: string; // YouTube or direct video link (embeddable)
  notes?: string; // Notes with numbered section headings, bold, bullets, tables, callouts
  notesPdfUrl?: string; // Optional Google Drive link or direct PDF URL for handouts
  summary?: string; // Highlighted summary box / key takeaways
  furtherReading?: FurtherReadingItem[]; // List of reference links
  linkedQuizId?: string; // Document ID of linked quiz
  requireQuizToComplete?: boolean; // Admin setting: Require passing the quiz to complete this topic (off by default)
  createdAt: string;
  updatedAt?: string;
}

export interface CourseMaterial {
  id?: string;
  title: string;
  url: string;
  category: CourseMaterialCategory;
}

export interface ResourceItem {
  id: string;
  courseId?: string;
  topicId?: string;
  type?: ResourceType;
  department: string;
  level: string; // 'ND1' | 'ND2' | 'HND1' | 'HND2'
  semester: string; // 'First Semester' | 'Second Semester'
  courseCode?: string;
  title: string;
  category?: ResourceCategory;
  session?: string;
  year?: string;
  url: string;
  description?: string;
  pastQuestionId?: string;
  solutionType?: 'text' | 'link';
  content?: string; // For typed solutions
  uploadedBy: string; // uid
  uploadedByEmail?: string;
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
  accentColor?: CourseAccentColor; // Teal (default), Emerald, Indigo, Sky, Amber, Rose
  coverImageUrl?: string; // Optional image link for original course cover
  about?: string; // 'About this course' overview
  description?: string;
  materials?: CourseMaterial[];
  createdAt?: string;
  updatedAt?: string;
}

export type CourseSheetLevel = 'ND1' | 'ND2' | 'HND1' | 'HND2';
export type CourseSheetSemester = 'First' | 'Second';

export interface CourseSheetItem {
  id: string; // document id: department_level_semester
  department: string;
  level: CourseSheetLevel;
  semester: CourseSheetSemester;
  title: string;
  url: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
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
  pinned?: boolean;
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

export type LinkCategory = 'WhatsApp Groups' | 'Registration' | 'Associations' | 'Other';

export interface LinkItem {
  id: string;
  name: string;
  description: string;
  category: LinkCategory;
  url: string;
  buttonText: string;
  audience: string; // 'All' or specific department name
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SiteSettings {
  whatsappChannelUrl?: string;
  aiDailyLimit?: number; // Daily quota per student (default 60)
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

export type QuizQuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'theory-best'
  | 'theory-select-all'
  | 'theory-self-check';

export interface QuizQuestion {
  id: string;
  text: string;
  type?: QuizQuestionType;
  options: string[]; // Options for MC, True/False, Theory (best answer), Theory (select all)
  modelAnswer?: string; // Model answer for Theory (self-check)
}

export interface QuizKeyItem {
  questionId: string;
  correctOptionIndex?: number; // 0 for A (or True), 1 for B (or False), etc.
  correctOptionIndices?: number[]; // For select-all questions: [0, 2]
  modelAnswer?: string; // Model answer for Theory (self-check)
  explanation: string;
  whyNotNotes?: Record<string, string>; // e.g. { 'A': '...', 'B': '...' }
}

export interface QuizItem {
  id: string;
  department: string;
  level: 'ND1' | 'ND2' | 'HND1' | 'HND2' | string;
  semester: 'First Semester' | 'Second Semester' | string;
  courseCode: string;
  scope?: 'general' | 'course' | 'topic'; // 'general' (no link), 'course', or 'topic'
  courseId?: string; // empty string when not used
  topicId?: string; // empty string when not used
  unlockAfterTopicsComplete?: boolean; // For course quizzes: unlock only after all topics are completed (default true)
  title: string;
  instructions?: string;
  dueDate?: string; // Optional due date string YYYY-MM-DD or ISO string for upcoming quizzes
  timeLimit?: number; // In minutes (0 or undefined for no limit)
  passingScore?: number; // Percentage needed to pass (e.g. 70, default 70)
  attemptsAllowed?: number; // Allowed attempts (0 or undefined for unlimited)
  pointsPerQuestion?: number; // Points per question (default 1)
  allowPartialCredit?: boolean; // Setting: allow partial credit for select-all questions
  shuffle?: boolean;
  published: boolean;
  questionCount: number;
  questions: QuizQuestion[]; // Questions with options only, NO correct answers
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QuizKeyDoc {
  id: string; // quizId
  quizId: string;
  department: string;
  keys: QuizKeyItem[];
  updatedAt?: string;
}

export interface QuizAttempt {
  id: string; // `${uid}_${quizId}`
  uid: string;
  quizId: string;
  department: string;
  studentName?: string;
  matricNumber?: string;
  answers: Record<string, any>; // questionId -> selectedOptionIndex (number) | selectedIndices (number[]) | selfCheckRating ('knew' | 'partly' | 'not-yet')
  questionScores?: Record<string, number>; // questionId -> points scored
  score: number;
  total: number;
  attempts: number;
  bestScore: number;
  passed?: boolean; // True if percentage >= passingScore
  percentage?: number; // Calculated score percentage
  aiExplanations?: Record<string, string>; // questionId -> cached AI generated explanation
  submittedAt: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id?: string;
  uid: string;
  email: string;
  role: string;
  action: 'Created' | 'Updated' | 'Deleted' | string;
  itemType: 'Course' | 'Topic' | 'Resource' | 'Past Question' | 'Quiz' | 'Announcement' | 'Link' | 'Solution' | string;
  title: string;
  createdAt: string;
}


