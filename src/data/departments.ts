import { DepartmentItem, SotDepartmentName, AnnouncementItem } from '../types';

export const DEPARTMENTS: DepartmentItem[] = [
  {
    id: 'agric-tech',
    name: 'Agricultural Technology',
    shortCode: 'AGT',
    iconName: 'Sprout',
    oneLiner: 'Modern mechanized agronomy, greenhouse crop production, and sustainable farm resource systems.',
    description: 'The Department of Agricultural Technology focuses on sustainable farming practices, farm automation, post-harvest techniques, and contemporary bio-resource management for modern agriculture.',
    programFocus: [
      'Crop Production & Agronomy Techniques',
      'Post-Harvest Processing & Preservation',
      'Farm Mechanization & Irrigation Systems',
      'Soil Management & Bio-Fertilizers'
    ],
    careerProspects: [
      'Agricultural Production Specialist',
      'Farm Operations Supervisor',
      'Agro-Enterprise Technologist',
      'Post-Harvest Storage Officer'
    ],
    facilityNotice: 'Department Workstations: Coming soon'
  },
  {
    id: 'comp-tech',
    name: 'Computer Technology',
    shortCode: 'CPT',
    iconName: 'Cpu',
    oneLiner: 'Software development, networking, database administration, web technologies, and system support.',
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
    name: 'Food Technology',
    shortCode: 'FDT',
    iconName: 'FlaskConical',
    oneLiner: 'Industrial food processing, quality control, preservation techniques, and food packaging.',
    description: 'Equipping students to process agricultural harvests into hygienic consumer products through food microbiology, processing operations, quality testing, and shelf-life preservation techniques.',
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
    id: 'leisure-tourism',
    name: 'Leisure & Tourism Management',
    shortCode: 'LTM',
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
    id: 'nutr-dietetics',
    name: 'Nutrition & Dietetics',
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
  },
  {
    id: 'polymer-textile',
    name: 'Polymer & Textile Technology',
    shortCode: 'PTT',
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
  }
];

export const SOT_DEPARTMENTS_LIST: SotDepartmentName[] = [
  'Agricultural Technology',
  'Computer Technology',
  'Food Technology',
  'Hospitality Management',
  'Leisure & Tourism Management',
  'Nutrition & Dietetics',
  'Polymer & Textile Technology'
];

export const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    title: 'First Semester Course Registration Guide',
    content: 'Student portal registrations for the first semester are currently active. Ensure your matric number and department are correctly updated before joining study groups.',
    category: 'Academic',
    department: 'All',
    urgent: true,
    createdAt: '2026-10-20T10:00:00Z',
    author: 'Student Editorial Desk'
  },
  {
    id: 'ann-2',
    title: 'Student Peer Tutoring & Workshop Schedule',
    content: 'Weekly student-led tutorial sessions in programming, agronomy basics, and food chemistry meet every Wednesday in the student hall.',
    category: 'Student Notice',
    department: 'All',
    createdAt: '2026-10-22T14:30:00Z',
    author: 'Student Association'
  },
  {
    id: 'ann-3',
    title: 'Inter-Department Tech & Cultural Exhibition',
    content: 'All seven departments will participate in the annual student innovation display. Project submissions open next week.',
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
    a: 'Sign-up is a straightforward 2-step flow: in Step 1 you create your account with your email and password, and in Step 2 you select your department and unique matric number to immediately access your dashboard.'
  },
  {
    q: 'Can I change my matriculation number after completing registration?',
    a: 'No. For security and record integrity, matriculation numbers are unique and permanently locked once registered. If you made an error, submit a message through the Contact page.'
  },
  {
    q: 'Who can access the Admin Dashboard?',
    a: 'The Admin Dashboard is strictly restricted to designated student portal administrators. Regular student accounts cannot access admin routes.'
  },
  {
    q: 'Why was my login locked?',
    a: 'As a security precaution to protect student accounts, five consecutive incorrect password attempts will lock login on that device for 15 minutes.'
  }
];
