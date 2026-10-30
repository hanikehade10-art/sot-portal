import { DepartmentItem, SotDepartmentName, AnnouncementItem } from '../types';
import { SOT_DEPARTMENTS_CONFIG, DEPARTMENT_COUNT } from '../config/site';

export const DEPARTMENTS: DepartmentItem[] = [
  {
    id: 'comp-tech',
    name: 'Computer Technology',
    shortCode: 'CPT',
    iconName: 'Cpu',
    oneLiner: 'Software development, networking, database administration, web technologies, and systems engineering.',
    description: 'Providing comprehensive technological training covering computer hardware maintenance, software programming, web architecture, network administration, and information systems management.',
    programFocus: [
      'Software Development & Web Technologies',
      'Computer Networking & Systems Support',
      'Database Administration & Data Management',
      'Information Security & System Administration'
    ],
    careerProspects: [
      'Software Developer',
      'Network Administrator',
      'Systems Support Specialist',
      'Web & Mobile Developer'
    ],
    facilityNotice: 'Computing Facilities: Coming soon'
  },
  {
    id: 'food-tech',
    name: 'Food Science and Technology',
    shortCode: 'FST',
    iconName: 'FlaskConical',
    oneLiner: 'Industrial food processing, quality control, preservation techniques, and food safety standards.',
    description: 'Equipping students to process raw harvests into hygienic consumer products through food microbiology, industrial processing operations, quality testing, and shelf-life preservation techniques.',
    programFocus: [
      'Food Processing & Preservation Operations',
      'Food Microbiology & Sanitation Standards',
      'Quality Control & Product Inspection',
      'Food Packaging & Storage Methods'
    ],
    careerProspects: [
      'Food Quality Control Analyst',
      'Food Processing Supervisor',
      'Production Technologist',
      'Packaging & Preservation Specialist'
    ],
    facilityNotice: 'Processing Facilities: Coming soon'
  },
  {
    id: 'hosp-mgmt',
    name: 'Hospitality Management',
    shortCode: 'HSM',
    iconName: 'Hotel',
    oneLiner: 'Hotel and resort operations, culinary supervision, event coordination, and guest services.',
    description: 'Covering lodging management, culinary techniques, customer service excellence, beverage management, and event planning for the hospitality and guest services industry.',
    programFocus: [
      'Hotel & Lodging Operations',
      'Food & Beverage Production',
      'Front Office & Accommodation Studies',
      'Event Planning & Banquet Coordination'
    ],
    careerProspects: [
      'Hotel Front Office Supervisor',
      'Food & Beverage Manager',
      'Events & Banquet Coordinator',
      'Guest Relations Officer'
    ],
    facilityNotice: 'Demonstration Units: Coming soon'
  },
  {
    id: 'tourism-mgmt',
    name: 'Tourism Management',
    shortCode: 'TRM',
    iconName: 'Compass',
    oneLiner: 'Tourism destination operations, travel booking services, leisure recreation, and heritage management.',
    description: 'Focused on travel services, tour packaging, recreation facility management, cultural tourism preservation, and modern booking systems.',
    programFocus: [
      'Tourism Destination Development',
      'Travel Agency & Ticketing Operations',
      'Recreation Parks & Leisure Governance',
      'Cultural & Heritage Tourism Studies'
    ],
    careerProspects: [
      'Tourism Operations Officer',
      'Travel Consultant & Tour Operator',
      'Recreational Facility Coordinator',
      'Cultural Heritage Guide & Planner'
    ],
    facilityNotice: 'Simulation Studios: Coming soon'
  },
  {
    id: 'polymer-textile',
    name: 'Polymer and Textile Management',
    shortCode: 'PTM',
    iconName: 'Layers',
    oneLiner: 'Fibre science, fabric manufacture, polymer processing, dye chemistry, and textile testing.',
    description: 'Focusing on textile yarn manufacturing, weaving, polymer compounding, fabric dyeing and printing, and materials quality control.',
    programFocus: [
      'Textile Fibre & Yarn Production',
      'Polymer Materials & Processing',
      'Textile Coloration & Chemical Finishing',
      'Quality Testing & Fabric Inspection'
    ],
    careerProspects: [
      'Textile Production Supervisor',
      'Polymer Processing Specialist',
      'Dyeing & Finishing Technologist',
      'Quality Assurance Inspector'
    ],
    facilityNotice: 'Textile Workrooms: Coming soon'
  },
  {
    id: 'nutr-dietetics',
    name: 'Nutrition and Dietetics',
    shortCode: 'NTD',
    iconName: 'Activity',
    oneLiner: 'Dietary planning, community wellness nutrition, therapeutic meal preparation, and public health food.',
    description: 'Dedicated to community health promotion, balanced meal planning, dietary requirements across life stages, and nutrition assessment for healthy living.',
    programFocus: [
      'Human Nutrition & Meal Management',
      'Community Health Nutrition',
      'Therapeutic Diet Planning',
      'Food Chemistry & Nutrient Analysis'
    ],
    careerProspects: [
      'Nutrition Assistant',
      'Dietary Planner & Consultant',
      'Community Nutrition Coordinator',
      'Food Service Nutrition Specialist'
    ],
    facilityNotice: 'Dietary Laboratories: Coming soon'
  }
];

export const SOT_DEPARTMENTS_LIST: SotDepartmentName[] = [
  ...SOT_DEPARTMENTS_CONFIG
];

/**
 * Normalizes any legacy or variant department name into the official canonical name.
 */
export function normalizeDepartmentName(name?: string): SotDepartmentName {
  if (!name) return 'Computer Technology';
  const trimmed = name.trim();
  if (trimmed === 'Food Technology') return 'Food Science and Technology';
  if (trimmed === 'Leisure & Tourism Management' || trimmed === 'Leisure and Tourism Management') return 'Tourism Management';
  if (trimmed === 'Nutrition & Dietetics') return 'Nutrition and Dietetics';
  if (trimmed === 'Polymer & Textile Technology' || trimmed === 'Polymer & Textile Management') return 'Polymer and Textile Management';
  if (trimmed.startsWith('Agric')) return 'Computer Technology';
  return trimmed as SotDepartmentName;
}

export const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    title: 'First Semester Course Registration Guide',
    content: 'Student portal registrations for the first semester are currently active. Ensure your matric number or JAMB registration number and department are correctly updated before joining study groups.',
    category: 'Academic',
    department: 'All',
    urgent: true,
    createdAt: '2026-10-20T10:00:00Z',
    author: 'Student Editorial Desk'
  },
  {
    id: 'ann-2',
    title: 'Student Peer Tutoring & Workshop Schedule',
    content: 'Weekly student-led tutorial sessions in programming, food processing, and nutritional science meet every Wednesday in the student hall.',
    category: 'Student Notice',
    department: 'All',
    createdAt: '2026-10-22T14:30:00Z',
    author: 'Student Association'
  },
  {
    id: 'ann-3',
    title: 'Inter-Department Tech & Cultural Exhibition',
    content: 'All six departments will participate in the annual student innovation display. Project submissions open next week.',
    category: 'General',
    department: 'All',
    createdAt: '2026-10-23T09:15:00Z',
    author: 'SOT Student Committee'
  }
];

export const FAQS = [
  {
    q: 'Is this an official university portal?',
    a: 'No. This is a student-run portal built and maintained by students of the School of Technology for students. It is not an official university administration website.'
  },
  {
    q: 'How does student registration work?',
    a: 'Sign-up is a straightforward 2-step flow: in Step 1 you create your account with your email and password, and in Step 2 you select your department and unique matric number or JAMB registration number to immediately access your dashboard.'
  },
  {
    q: 'Can I change my matric number or JAMB registration number after completing registration?',
    a: 'Matric numbers are unique and permanently locked once saved. If you registered with a JAMB registration number, you can upgrade to your official matric number in Profile settings as soon as you receive it.'
  },
  {
    q: 'Who can access the Admin Dashboard?',
    a: 'The Admin Dashboard is strictly restricted to designated student portal administrators. Regular student accounts and Course Reps cannot access admin routes.'
  },
  {
    q: 'Why was my login locked?',
    a: 'As a security precaution to protect student accounts, five consecutive incorrect password attempts will lock login on that device for 15 minutes.'
  }
];
