import { CourseItem, TimetableEntry } from '../types';

export const INITIAL_COURSES: CourseItem[] = [
  // Computer Technology
  {
    id: 'c-com-111',
    department: 'Computer Technology',
    code: 'COM 111',
    title: 'Introduction to Computing & Digital Systems',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-com-112',
    department: 'Computer Technology',
    code: 'COM 112',
    title: 'Introduction to Logic & Assembly Programming',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-com-121',
    department: 'Computer Technology',
    code: 'COM 121',
    title: 'Structured Programming in C++',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-com-124',
    department: 'Computer Technology',
    code: 'COM 124',
    title: 'Data Structures & Algorithms',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-com-211',
    department: 'Computer Technology',
    code: 'COM 211',
    title: 'Object-Oriented Programming (Java)',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-com-212',
    department: 'Computer Technology',
    code: 'COM 212',
    title: 'Database Management Systems (SQL)',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-com-221',
    department: 'Computer Technology',
    code: 'COM 221',
    title: 'Web Application Development',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-com-224',
    department: 'Computer Technology',
    code: 'COM 224',
    title: 'Computer Networks & Cybersecurity Fundamentals',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-com-311',
    department: 'Computer Technology',
    code: 'COM 311',
    title: 'Advanced Database Systems & NoSQL',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-com-321',
    department: 'Computer Technology',
    code: 'COM 321',
    title: 'Cloud Architecture & Distributed Systems',
    level: 'HND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-com-411',
    department: 'Computer Technology',
    code: 'COM 411',
    title: 'Artificial Intelligence & Machine Learning',
    level: 'HND II',
    semester: '1st Semester'
  },
  {
    id: 'c-com-421',
    department: 'Computer Technology',
    code: 'COM 421',
    title: 'Capstone Software Engineering Project',
    level: 'HND II',
    semester: '2nd Semester'
  },

  // Food Technology
  {
    id: 'c-fst-111',
    department: 'Food Technology',
    code: 'FST 111',
    title: 'Introduction to Food Science & Technology',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-fst-122',
    department: 'Food Technology',
    code: 'FST 122',
    title: 'Food Chemistry & Biochemistry',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-fst-211',
    department: 'Food Technology',
    code: 'FST 211',
    title: 'Thermal Processing & Preservation Technology',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-fst-224',
    department: 'Food Technology',
    code: 'FST 224',
    title: 'Food Quality Assurance & HACCP Protocols',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-fst-311',
    department: 'Food Technology',
    code: 'FST 311',
    title: 'Cereal, Grain & Bakery Processing Technology',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-fst-411',
    department: 'Food Technology',
    code: 'FST 411',
    title: 'Industrial Food Plant Sanitation & Packaging',
    level: 'HND II',
    semester: '1st Semester'
  },

  // Agricultural Technology
  {
    id: 'c-agt-111',
    department: 'Agricultural Technology',
    code: 'AGT 111',
    title: 'Principles of Crop Production & Agronomy',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-agt-121',
    department: 'Agricultural Technology',
    code: 'AGT 121',
    title: 'Soil Science & Sustainable Land Management',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-agt-211',
    department: 'Agricultural Technology',
    code: 'AGT 211',
    title: 'Agricultural Mechanization & Irrigation Systems',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-agt-221',
    department: 'Agricultural Technology',
    code: 'AGT 221',
    title: 'Farm Management, Post-Harvest & Agribusiness',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-agt-311',
    department: 'Agricultural Technology',
    code: 'AGT 311',
    title: 'Horticulture & Greenhousing Management',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-agt-411',
    department: 'Agricultural Technology',
    code: 'AGT 411',
    title: 'Livestock Science & Animal Nutrition',
    level: 'HND II',
    semester: '1st Semester'
  },

  // Hospitality Management
  {
    id: 'c-hpm-111',
    department: 'Hospitality Management',
    code: 'HPM 111',
    title: 'Introduction to Hospitality Operations',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-hpm-121',
    department: 'Hospitality Management',
    code: 'HPM 121',
    title: 'Front Office Operations & Guest Relations',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-hpm-211',
    department: 'Hospitality Management',
    code: 'HPM 211',
    title: 'Food & Beverage Service Leadership',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-hpm-221',
    department: 'Hospitality Management',
    code: 'HPM 221',
    title: 'Culinary Arts & Commercial Kitchen Hygiene',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-hpm-311',
    department: 'Hospitality Management',
    code: 'HPM 311',
    title: 'Banquet & Event Catering Logistics',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-hpm-411',
    department: 'Hospitality Management',
    code: 'HPM 411',
    title: 'Hotel Asset Management & Hospitality Law',
    level: 'HND II',
    semester: '1st Semester'
  },

  // Leisure & Tourism Management
  {
    id: 'c-ltm-111',
    department: 'Leisure & Tourism Management',
    code: 'LTM 111',
    title: 'Foundations of Travel & Tourism Industry',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-ltm-121',
    department: 'Leisure & Tourism Management',
    code: 'LTM 121',
    title: 'Eco-Tourism & Cultural Heritage Sites',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-ltm-211',
    department: 'Leisure & Tourism Management',
    code: 'LTM 211',
    title: 'Recreation Facility Planning & Operations',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-ltm-221',
    department: 'Leisure & Tourism Management',
    code: 'LTM 221',
    title: 'Tour Packaging, Itinerary & Guiding Skills',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-ltm-311',
    department: 'Leisure & Tourism Management',
    code: 'LTM 311',
    title: 'Aviation & Global Ticketing Systems',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-ltm-411',
    department: 'Leisure & Tourism Management',
    code: 'LTM 411',
    title: 'Destination Marketing & Sustainable Tourism Policy',
    level: 'HND II',
    semester: '1st Semester'
  },

  // Nutrition & Dietetics
  {
    id: 'c-ntd-111',
    department: 'Nutrition & Dietetics',
    code: 'NTD 111',
    title: 'Human Nutrition Principles & Physiology',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-ntd-121',
    department: 'Nutrition & Dietetics',
    code: 'NTD 121',
    title: 'Food Chemistry & Nutrient Composition',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-ntd-211',
    department: 'Nutrition & Dietetics',
    code: 'NTD 211',
    title: 'Community Nutrition & Dietary Assessment',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-ntd-221',
    department: 'Nutrition & Dietetics',
    code: 'NTD 221',
    title: 'Clinical Dietetics & Medical Nutrition Therapy',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-ntd-311',
    department: 'Nutrition & Dietetics',
    code: 'NTD 311',
    title: 'Maternal & Child Nutrition Intervention',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-ntd-411',
    department: 'Nutrition & Dietetics',
    code: 'NTD 411',
    title: 'Nutritional Biochemistry & Public Health Policy',
    level: 'HND II',
    semester: '1st Semester'
  },

  // Polymer & Textile Technology
  {
    id: 'c-ptt-111',
    department: 'Polymer & Textile Technology',
    code: 'PTT 111',
    title: 'Introduction to Polymer Science & Fibres',
    level: 'ND I',
    semester: '1st Semester'
  },
  {
    id: 'c-ptt-121',
    department: 'Polymer & Textile Technology',
    code: 'PTT 121',
    title: 'Yarn Manufacture & Spinning Technology',
    level: 'ND I',
    semester: '2nd Semester'
  },
  {
    id: 'c-ptt-211',
    department: 'Polymer & Textile Technology',
    code: 'PTT 211',
    title: 'Weaving Mechanisms & Fabric Fabrication',
    level: 'ND II',
    semester: '1st Semester'
  },
  {
    id: 'c-ptt-221',
    department: 'Polymer & Textile Technology',
    code: 'PTT 221',
    title: 'Textile Coloration, Dyeing & Finishing',
    level: 'ND II',
    semester: '2nd Semester'
  },
  {
    id: 'c-ptt-311',
    department: 'Polymer & Textile Technology',
    code: 'PTT 311',
    title: 'Advanced Polymer Synthesis & Plastics Moulding',
    level: 'HND I',
    semester: '1st Semester'
  },
  {
    id: 'c-ptt-411',
    department: 'Polymer & Textile Technology',
    code: 'PTT 411',
    title: 'Quality Testing of Industrial Composites & Technical Textiles',
    level: 'HND II',
    semester: '1st Semester'
  }
];

export const INITIAL_TIMETABLES: TimetableEntry[] = [
  // Computer Technology - Class Schedule
  {
    id: 't-com-1',
    department: 'Computer Technology',
    level: 'ND I',
    day: 'Monday',
    startTime: '08:00 AM',
    endTime: '10:00 AM',
    courseCode: 'COM 111',
    venue: 'Hardware Lab 2',
    type: 'class'
  },
  {
    id: 't-com-2',
    department: 'Computer Technology',
    level: 'ND I',
    day: 'Monday',
    startTime: '10:30 AM',
    endTime: '12:30 PM',
    courseCode: 'COM 112',
    venue: 'Software Lab 1',
    type: 'class'
  },
  {
    id: 't-com-3',
    department: 'Computer Technology',
    level: 'ND I',
    day: 'Tuesday',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    courseCode: 'COM 124',
    venue: 'Lecture Theatre B',
    type: 'class'
  },
  {
    id: 't-com-4',
    department: 'Computer Technology',
    level: 'ND I',
    day: 'Wednesday',
    startTime: '01:00 PM',
    endTime: '03:00 PM',
    courseCode: 'COM 121',
    venue: 'Computer Center Room 4',
    type: 'class'
  },
  {
    id: 't-com-5',
    department: 'Computer Technology',
    level: 'ND II',
    day: 'Tuesday',
    startTime: '08:00 AM',
    endTime: '10:00 AM',
    courseCode: 'COM 211',
    venue: 'Software Lab 3',
    type: 'class'
  },
  {
    id: 't-com-6',
    department: 'Computer Technology',
    level: 'ND II',
    day: 'Thursday',
    startTime: '11:00 AM',
    endTime: '01:00 PM',
    courseCode: 'COM 212',
    venue: 'Database Studio',
    type: 'class'
  },
  {
    id: 't-com-7',
    department: 'Computer Technology',
    level: 'ND I',
    day: 'Friday',
    startTime: '09:00 AM',
    endTime: '12:00 PM',
    courseCode: 'COM 124 (Semester Exam)',
    venue: 'SOT Hall 1',
    type: 'exam',
    date: '2026-11-16'
  },
  {
    id: 't-com-8',
    department: 'Computer Technology',
    level: 'ND I',
    day: 'Monday',
    startTime: '01:00 PM',
    endTime: '04:00 PM',
    courseCode: 'COM 111 (Semester Exam)',
    venue: 'Main Auditorium',
    type: 'exam',
    date: '2026-11-19'
  },

  // Food Technology
  {
    id: 't-fst-1',
    department: 'Food Technology',
    level: 'ND I',
    day: 'Monday',
    startTime: '08:30 AM',
    endTime: '10:30 AM',
    courseCode: 'FST 111',
    venue: 'Pilot Plant A',
    type: 'class'
  },
  {
    id: 't-fst-2',
    department: 'Food Technology',
    level: 'ND I',
    day: 'Wednesday',
    startTime: '11:00 AM',
    endTime: '01:00 PM',
    courseCode: 'FST 122',
    venue: 'Food Chemistry Lab',
    type: 'class'
  },
  {
    id: 't-fst-3',
    department: 'Food Technology',
    level: 'ND I',
    day: 'Thursday',
    startTime: '09:00 AM',
    endTime: '12:00 PM',
    courseCode: 'FST 111 (Practical Exam)',
    venue: 'Pilot Plant A',
    type: 'exam',
    date: '2026-11-18'
  },

  // Agricultural Technology
  {
    id: 't-agt-1',
    department: 'Agricultural Technology',
    level: 'ND I',
    day: 'Tuesday',
    startTime: '08:00 AM',
    endTime: '10:00 AM',
    courseCode: 'AGT 111',
    venue: 'Demonstration Farm Plot',
    type: 'class'
  },
  {
    id: 't-agt-2',
    department: 'Agricultural Technology',
    level: 'ND I',
    day: 'Thursday',
    startTime: '02:00 PM',
    endTime: '04:00 PM',
    courseCode: 'AGT 121',
    venue: 'Agronomy Lecture Room',
    type: 'class'
  },

  // Hospitality Management
  {
    id: 't-hpm-1',
    department: 'Hospitality Management',
    level: 'ND I',
    day: 'Monday',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    courseCode: 'HPM 111',
    venue: 'Demo Hotel Front Desk',
    type: 'class'
  },
  {
    id: 't-hpm-2',
    department: 'Hospitality Management',
    level: 'ND I',
    day: 'Wednesday',
    startTime: '01:00 PM',
    endTime: '03:00 PM',
    courseCode: 'HPM 121',
    venue: 'Banquet Suite A',
    type: 'class'
  },

  // Leisure & Tourism Management
  {
    id: 't-ltm-1',
    department: 'Leisure & Tourism Management',
    level: 'ND I',
    day: 'Tuesday',
    startTime: '10:00 AM',
    endTime: '12:00 PM',
    courseCode: 'LTM 111',
    venue: 'Tourism Resource Room',
    type: 'class'
  },
  {
    id: 't-ltm-2',
    department: 'Leisure & Tourism Management',
    level: 'ND I',
    day: 'Thursday',
    startTime: '01:00 PM',
    endTime: '03:00 PM',
    courseCode: 'LTM 121',
    venue: 'Seminar Hall 3',
    type: 'class'
  },

  // Nutrition & Dietetics
  {
    id: 't-ntd-1',
    department: 'Nutrition & Dietetics',
    level: 'ND I',
    day: 'Monday',
    startTime: '10:00 AM',
    endTime: '12:00 PM',
    courseCode: 'NTD 111',
    venue: 'Dietetics Clinic Room',
    type: 'class'
  },
  {
    id: 't-ntd-2',
    department: 'Nutrition & Dietetics',
    level: 'ND I',
    day: 'Wednesday',
    startTime: '08:30 AM',
    endTime: '10:30 AM',
    courseCode: 'NTD 121',
    venue: 'Biochemistry Lab 1',
    type: 'class'
  },

  // Polymer & Textile Technology
  {
    id: 't-ptt-1',
    department: 'Polymer & Textile Technology',
    level: 'ND I',
    day: 'Tuesday',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    courseCode: 'PTT 111',
    venue: 'Weaving Workshop',
    type: 'class'
  },
  {
    id: 't-ptt-2',
    department: 'Polymer & Textile Technology',
    level: 'ND I',
    day: 'Thursday',
    startTime: '11:00 AM',
    endTime: '01:00 PM',
    courseCode: 'PTT 121',
    venue: 'Spinning & Polymer Lab',
    type: 'class'
  }
];
