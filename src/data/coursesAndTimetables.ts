import { CourseItem, TimetableEntry } from '../types';

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

export const INITIAL_COURSES: CourseItem[] = [
  // 1. Computer Technology
  {
    id: 'c-com-111',
    department: 'Computer Technology',
    code: 'COM 111',
    title: 'Introduction to Computing & Digital Systems',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Foundational concepts of computing, computer architecture, number systems, logic gates, and software engineering principles.',
    materials: [
      { id: 'm-com-111-1', title: 'Unit 1-4 Complete Lecture Notes (PDF)', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-111-2', title: '2022-2024 Exam Past Questions Compilation', url: 'https://drive.google.com', category: 'Past Question' },
      { id: 'm-com-111-3', title: 'Digital Logic Gates Video Crash Course', url: 'https://youtube.com', category: 'Video' }
    ]
  },
  {
    id: 'c-com-112',
    department: 'Computer Technology',
    code: 'COM 112',
    title: 'Introduction to Logic & Assembly Programming',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Boolean algebra, digital circuit reduction, register architectures, memory hierarchy, and fundamentals of 8086 assembly programming.',
    materials: [
      { id: 'm-com-112-1', title: 'Assembly Syntax & Instruction Set Guide', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-112-2', title: 'Past Semester Midterm & Final Solved Papers', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-121',
    department: 'Computer Technology',
    code: 'COM 121',
    title: 'Structured Programming in C++',
    level: 'ND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Procedural programming, control structures, functions, pointers, arrays, memory management, and stream I/O using C++.',
    materials: [
      { id: 'm-com-121-1', title: 'C++ Programming Lab Manual & Exercises', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-121-2', title: 'Past Questions with Model Solutions', url: 'https://drive.google.com', category: 'Past Question' },
      { id: 'm-com-121-3', title: 'Pointers and Memory Walkthrough Tutorial', url: 'https://youtube.com', category: 'Video' }
    ]
  },
  {
    id: 'c-com-124',
    department: 'Computer Technology',
    code: 'COM 124',
    title: 'Data Structures & Algorithms',
    level: 'ND1',
    semester: 'Second Semester',
    units: 4,
    type: 'Core',
    description: 'Linear and non-linear data structures: Linked lists, stacks, queues, trees, graphs, sorting and searching algorithms, Big-O time complexity.',
    materials: [
      { id: 'm-com-124-1', title: 'Comprehensive Handout on Trees and Graphs', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-124-2', title: 'Department Past Exam Questions (5 Years)', url: 'https://drive.google.com', category: 'Past Question' },
      { id: 'm-com-124-3', title: 'Visualizing Sorting Algorithms & Heaps', url: 'https://youtube.com', category: 'Video' }
    ]
  },
  {
    id: 'c-com-211',
    department: 'Computer Technology',
    code: 'COM 211',
    title: 'Object-Oriented Programming (Java)',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Classes, objects, encapsulation, inheritance, polymorphism, abstract classes, interfaces, exception handling, and Java Collections framework.',
    materials: [
      { id: 'm-com-211-1', title: 'Java OOP Class Slides & Code Repository', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-211-2', title: 'OOP Past Questions & Marking Scheme', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-212',
    department: 'Computer Technology',
    code: 'COM 212',
    title: 'Database Management Systems (SQL)',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Relational database model, entity-relationship diagrams (ERD), normal forms (1NF, 2NF, 3NF, BCNF), and ANSI SQL query authoring.',
    materials: [
      { id: 'm-com-212-1', title: 'Relational Algebra & Normalization Handout', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-212-2', title: 'SQL Practical Past Lab Examination Papers', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-221',
    department: 'Computer Technology',
    code: 'COM 221',
    title: 'Web Application Development',
    level: 'ND2',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Modern front-end and back-end web development with HTML5, CSS3, JavaScript, REST APIs, and database connectivity.',
    materials: [
      { id: 'm-com-221-1', title: 'Full-Stack Web Development Course Slides', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-221-2', title: 'Past Web Development Practical Questions', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-224',
    department: 'Computer Technology',
    code: 'COM 224',
    title: 'Computer Networks & Cybersecurity Fundamentals',
    level: 'ND2',
    semester: 'Second Semester',
    units: 3,
    type: 'Elective',
    description: 'OSI and TCP/IP stack, IP addressing, subnetting, routing protocols, cryptography, firewalls, and network security policies.',
    materials: [
      { id: 'm-com-224-1', title: 'Subnetting Cheat Sheet & Routing Protocol Notes', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-224-2', title: 'Past Questions on Packet Inspection & Security', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-311',
    department: 'Computer Technology',
    code: 'COM 311',
    title: 'Advanced Database Systems & NoSQL',
    level: 'HND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Distributed query optimization, concurrency control, ACID properties, indexing techniques, document-oriented and key-value NoSQL databases.',
    materials: [
      { id: 'm-com-311-1', title: 'Advanced DBMS Theory & Query Planning', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-311-2', title: 'HND1 Comprehensive Past Questions', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-321',
    department: 'Computer Technology',
    code: 'COM 321',
    title: 'Cloud Architecture & Distributed Systems',
    level: 'HND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Virtualization, microservices architecture, serverless computing, cloud storage, container orchestration with Docker and Kubernetes.',
    materials: [
      { id: 'm-com-321-1', title: 'Distributed Systems & Microservices Architecture Note', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-com-411',
    department: 'Computer Technology',
    code: 'COM 411',
    title: 'Artificial Intelligence & Machine Learning',
    level: 'HND2',
    semester: 'First Semester',
    units: 4,
    type: 'Core',
    description: 'Heuristic search algorithms, expert systems, supervised and unsupervised machine learning models, neural networks, and NLP fundamentals.',
    materials: [
      { id: 'm-com-411-1', title: 'Machine Learning Math and Python Notebooks', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-com-411-2', title: 'HND2 AI Past Examination Papers', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-com-421',
    department: 'Computer Technology',
    code: 'COM 421',
    title: 'Capstone Software Engineering Project',
    level: 'HND2',
    semester: 'Second Semester',
    units: 6,
    type: 'Core',
    description: 'Supervised development and defense of an end-to-end software product solving real-world polytechnic or industrial problems.',
    materials: [
      { id: 'm-com-421-1', title: 'Capstone Project Proposal and Documentation Template', url: 'https://drive.google.com', category: 'Other' }
    ]
  },

  // 2. Food Science and Technology
  {
    id: 'c-fst-111',
    department: 'Food Science and Technology',
    code: 'FST 111',
    title: 'Introduction to Food Science & Technology',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Overview of food composition, causes of food spoilage, fundamental preservation methods, and industrial food processing operations.',
    materials: [
      { id: 'm-fst-111-1', title: 'Food Science Fundamentals (Lecture Handout)', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-fst-111-2', title: 'FST 111 3-Year Past Questions', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-fst-122',
    department: 'Food Science and Technology',
    code: 'FST 122',
    title: 'Food Chemistry & Biochemistry',
    level: 'ND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Chemical structure and functional properties of carbohydrates, proteins, lipids, enzymes, water activity, and browning reactions in foods.',
    materials: [
      { id: 'm-fst-122-1', title: 'Enzymatic Reactions in Food Systems', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-fst-211',
    department: 'Food Science and Technology',
    code: 'FST 211',
    title: 'Thermal Processing & Preservation Technology',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Pasteurization, sterilization, blanching, canning principles, lethality calculations (D, z, and F values), and aseptic packaging.',
    materials: [
      { id: 'm-fst-211-1', title: 'Thermal Death Kinetics and Calculations', url: 'https://drive.google.com', category: 'Lecture Note' },
      { id: 'm-fst-211-2', title: 'Thermal Processing Solved Past Questions', url: 'https://drive.google.com', category: 'Past Question' }
    ]
  },
  {
    id: 'c-fst-224',
    department: 'Food Science and Technology',
    code: 'FST 224',
    title: 'Food Quality Assurance & HACCP Protocols',
    level: 'ND2',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Statistical quality control, sensory evaluation, GMP, ISO standards, and implementation of Hazard Analysis Critical Control Point (HACCP).',
    materials: [
      { id: 'm-fst-224-1', title: 'HACCP Plan Guidelines and Worksheets', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-fst-311',
    department: 'Food Science and Technology',
    code: 'FST 311',
    title: 'Cereal, Grain & Bakery Processing Technology',
    level: 'HND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Milling technology, flour fortification, dough rheology, bread making, extrusion, and snack foods manufacturing.',
    materials: [
      { id: 'm-fst-311-1', title: 'Cereal Milling & Bakery Formulations', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-fst-411',
    department: 'Food Science and Technology',
    code: 'FST 411',
    title: 'Industrial Food Plant Sanitation & Packaging',
    level: 'HND2',
    semester: 'First Semester',
    units: 3,
    type: 'Elective',
    description: 'Clean-in-place (CIP) systems, biodegradable polymers in packaging, modified atmosphere packaging (MAP), and plant effluent treatment.',
    materials: [
      { id: 'm-fst-411-1', title: 'Packaging Materials and Barrier Properties', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },

  // 3. Hospitality Management
  {
    id: 'c-hpm-111',
    department: 'Hospitality Management',
    code: 'HPM 111',
    title: 'Introduction to Hospitality Operations',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Structure of the lodging and food service industries, hospitality organizational hierarchy, guest experience lifecycle, and service standards.',
    materials: [
      { id: 'm-hpm-111-1', title: 'Hospitality Industry Foundations Lecture Note', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-hpm-121',
    department: 'Hospitality Management',
    code: 'HPM 121',
    title: 'Front Office Operations & Guest Relations',
    level: 'ND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Reservations, registration, room assignment, property management systems (PMS), billing, credit policies, and complaint resolution.',
    materials: [
      { id: 'm-hpm-121-1', title: 'Front Desk Procedures Manual & PMS Guide', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-hpm-211',
    department: 'Hospitality Management',
    code: 'HPM 211',
    title: 'Food & Beverage Service Leadership',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Restaurant layout, table settings, menu engineering, banquet service techniques, beverage management, and cost control.',
    materials: [
      { id: 'm-hpm-211-1', title: 'Food & Beverage Service Manual & Standards', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-hpm-221',
    department: 'Hospitality Management',
    code: 'HPM 221',
    title: 'Culinary Arts & Commercial Kitchen Hygiene',
    level: 'ND2',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Classical culinary techniques, kitchen brigade system, knife skills, food safety sanitation standards, and international cuisines.',
    materials: [
      { id: 'm-hpm-221-1', title: 'Commercial Culinary Techniques Handbook', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-hpm-311',
    department: 'Hospitality Management',
    code: 'HPM 311',
    title: 'Banquet & Event Catering Logistics',
    level: 'HND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Planning, budgeting, staffing, and execution of large-scale corporate conferences, banquets, and social events.',
    materials: [
      { id: 'm-hpm-311-1', title: 'Event Production & Catering Contracts Guide', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-hpm-411',
    department: 'Hospitality Management',
    code: 'HPM 411',
    title: 'Hotel Asset Management & Hospitality Law',
    level: 'HND2',
    semester: 'First Semester',
    units: 3,
    type: 'Elective',
    description: 'Legal liabilities in innkeeping, guest privacy, employment contracts, hotel revenue management (RevPAR, ADR), and real estate assets.',
    materials: [
      { id: 'm-hpm-411-1', title: 'Hospitality Jurisprudence & RevPAR Analytics', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },

  // 4. Tourism Management
  {
    id: 'c-trm-111',
    department: 'Tourism Management',
    code: 'TRM 111',
    title: 'Foundations of Travel & Tourism Industry',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Tourism systems, destination attraction typologies, economic impact of tourism, tourist motivations, and travel sector trends.',
    materials: [
      { id: 'm-trm-111-1', title: 'Tourism Sector Fundamentals & Case Studies', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-trm-121',
    department: 'Tourism Management',
    code: 'TRM 121',
    title: 'Eco-Tourism & Cultural Heritage Sites',
    level: 'ND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Conservation principles, indigenous heritage preservation, national parks management, and community-based eco-tourism projects.',
    materials: [
      { id: 'm-trm-121-1', title: 'Heritage Tourism & Biodiversity Preservation', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-trm-211',
    department: 'Tourism Management',
    code: 'TRM 211',
    title: 'Recreation Facility Planning & Operations',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Design, programming, safety audits, and operational management of theme parks, sports clubs, resorts, and civic recreational facilities.',
    materials: [
      { id: 'm-trm-211-1', title: 'Recreation Facility Safety & Operations Plan', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-trm-221',
    department: 'Tourism Management',
    code: 'TRM 221',
    title: 'Tour Packaging, Itinerary & Guiding Skills',
    level: 'ND2',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Tour costing, itinerary construction, negotiation with airlines and hotels, group dynamics, cross-cultural communication, and tour guiding.',
    materials: [
      { id: 'm-trm-221-1', title: 'Tour Operator Itinerary Handbook', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-trm-311',
    department: 'Tourism Management',
    code: 'TRM 311',
    title: 'Aviation & Global Ticketing Systems',
    level: 'HND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Global Distribution Systems (GDS: Amadeus/Sabre), IATA regulations, fare construction, routing codes, and electronic airline ticketing.',
    materials: [
      { id: 'm-trm-311-1', title: 'Amadeus GDS Commands & Fare Calculation Guide', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-trm-411',
    department: 'Tourism Management',
    code: 'TRM 411',
    title: 'Destination Marketing & Sustainable Tourism Policy',
    level: 'HND2',
    semester: 'First Semester',
    units: 3,
    type: 'Elective',
    description: 'Branding regions and nations, public policy in tourism, carrying capacity calculations, crisis communication, and digital marketing.',
    materials: [
      { id: 'm-trm-411-1', title: 'National Tourism Masterplan Case Studies', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },

  // 5. Nutrition and Dietetics
  {
    id: 'c-ntd-111',
    department: 'Nutrition and Dietetics',
    code: 'NTD 111',
    title: 'Human Nutrition Principles & Physiology',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Energy metabolism, digestion and absorption of macronutrients and micronutrients, dietary guidelines, and nutrient deficiency diseases.',
    materials: [
      { id: 'm-ntd-111-1', title: 'Human Physiology & Nutrient Transport Notes', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ntd-121',
    department: 'Nutrition and Dietetics',
    code: 'NTD 121',
    title: 'Food Chemistry & Nutrient Composition',
    level: 'ND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Nutritional analysis of local foods, bioavailability of minerals and vitamins, food processing effects on nutritional values.',
    materials: [
      { id: 'm-ntd-121-1', title: 'Food Composition Tables & Nutrient Calculations', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ntd-211',
    department: 'Nutrition and Dietetics',
    code: 'NTD 211',
    title: 'Community Nutrition & Dietary Assessment',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Anthropometric, biochemical, clinical and dietary (ABCD) assessment methods, public health nutrition surveys, and malnutrition interventions.',
    materials: [
      { id: 'm-ntd-211-1', title: 'ABCD Assessment Fieldwork Protocols', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ntd-221',
    department: 'Nutrition and Dietetics',
    code: 'NTD 221',
    title: 'Clinical Dietetics & Medical Nutrition Therapy',
    level: 'ND2',
    semester: 'Second Semester',
    units: 4,
    type: 'Core',
    description: 'Pathophysiology and diet management for diabetes, hypertension, cardiovascular disorders, renal disease, and gastrointestinal conditions.',
    materials: [
      { id: 'm-ntd-221-1', title: 'Medical Nutrition Therapy Prescription Notes', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ntd-311',
    department: 'Nutrition and Dietetics',
    code: 'NTD 311',
    title: 'Maternal & Child Nutrition Intervention',
    level: 'HND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Nutritional demands during preconception, pregnancy, lactation, infancy, complementary feeding practices, and growth monitoring.',
    materials: [
      { id: 'm-ntd-311-1', title: 'Maternal & Paediatric Nutrition Guide', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ntd-411',
    department: 'Nutrition and Dietetics',
    code: 'NTD 411',
    title: 'Nutritional Biochemistry & Public Health Policy',
    level: 'HND2',
    semester: 'First Semester',
    units: 3,
    type: 'Elective',
    description: 'Metabolic pathways in health and disease, molecular nutrition, fortification programs, food security metrics, and health policy planning.',
    materials: [
      { id: 'm-ntd-411-1', title: 'Nutritional Biochemistry Pathways Map', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },

  // 6. Polymer and Textile Management
  {
    id: 'c-ptm-111',
    department: 'Polymer and Textile Management',
    code: 'PTM 111',
    title: 'Introduction to Polymer Science & Fibres',
    level: 'ND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Classification of natural and synthetic polymers, polymerization mechanisms, molecular weight determination, and physical properties of textile fibers.',
    materials: [
      { id: 'm-ptm-111-1', title: 'Polymerization Chemistry Lecture Handout', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ptm-121',
    department: 'Polymer and Textile Management',
    code: 'PTM 121',
    title: 'Yarn Manufacture & Spinning Technology',
    level: 'ND1',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Opening, carding, drawing, roving, ring and rotor spinning, yarn twist mechanics, count systems, and yarn quality testing.',
    materials: [
      { id: 'm-ptm-121-1', title: 'Spinning Technology & Yarn Count Formulas', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ptm-211',
    department: 'Polymer and Textile Management',
    code: 'PTM 211',
    title: 'Weaving Mechanisms & Fabric Fabrication',
    level: 'ND2',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Loom operations, shedding, picking, beat-up mechanisms, fabric weave structures (plain, twill, satin), and knitting machines.',
    materials: [
      { id: 'm-ptm-211-1', title: 'Fabric Weave Structures & Draft Plans', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ptm-221',
    department: 'Polymer and Textile Management',
    code: 'PTM 221',
    title: 'Textile Coloration, Dyeing & Finishing',
    level: 'ND2',
    semester: 'Second Semester',
    units: 3,
    type: 'Core',
    description: 'Scouring, bleaching, dyeing with direct, reactive, vat and disperse dyes, screen printing, functional finishes (waterproof, flame retardant).',
    materials: [
      { id: 'm-ptm-221-1', title: 'Textile Wet Processing & Dyeing Recipes', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ptm-311',
    department: 'Polymer and Textile Management',
    code: 'PTM 311',
    title: 'Advanced Polymer Synthesis & Plastics Moulding',
    level: 'HND1',
    semester: 'First Semester',
    units: 3,
    type: 'Core',
    description: 'Injection moulding, blow moulding, extrusion, polymer rheology, elastomers, thermosets, and plastics recycling technologies.',
    materials: [
      { id: 'm-ptm-311-1', title: 'Plastics Moulding Parameters & Rheology Guide', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
  },
  {
    id: 'c-ptm-411',
    department: 'Polymer and Textile Management',
    code: 'PTM 411',
    title: 'Quality Testing of Industrial Composites & Technical Textiles',
    level: 'HND2',
    semester: 'First Semester',
    units: 3,
    type: 'Elective',
    description: 'Tensile, tear, bursting strength testing, fiber reinforced polymers (FRP), geotextiles, medical textiles, and ASTM/ISO standard testing methods.',
    materials: [
      { id: 'm-ptm-411-1', title: 'ASTM Standards for Technical Textiles Manual', url: 'https://drive.google.com', category: 'Lecture Note' }
    ]
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

  // Food Science and Technology
  {
    id: 't-fst-1',
    department: 'Food Science and Technology',
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
    department: 'Food Science and Technology',
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
    department: 'Food Science and Technology',
    level: 'ND I',
    day: 'Thursday',
    startTime: '09:00 AM',
    endTime: '12:00 PM',
    courseCode: 'FST 111 (Practical Exam)',
    venue: 'Pilot Plant A',
    type: 'exam',
    date: '2026-11-18'
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

  // Tourism Management
  {
    id: 't-trm-1',
    department: 'Tourism Management',
    level: 'ND I',
    day: 'Tuesday',
    startTime: '10:00 AM',
    endTime: '12:00 PM',
    courseCode: 'TRM 111',
    venue: 'Tourism Resource Room',
    type: 'class'
  },
  {
    id: 't-trm-2',
    department: 'Tourism Management',
    level: 'ND I',
    day: 'Thursday',
    startTime: '01:00 PM',
    endTime: '03:00 PM',
    courseCode: 'TRM 121',
    venue: 'Seminar Hall 3',
    type: 'class'
  },

  // Nutrition and Dietetics
  {
    id: 't-ntd-1',
    department: 'Nutrition and Dietetics',
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
    department: 'Nutrition and Dietetics',
    level: 'ND I',
    day: 'Wednesday',
    startTime: '08:30 AM',
    endTime: '10:30 AM',
    courseCode: 'NTD 121',
    venue: 'Biochemistry Lab 1',
    type: 'class'
  },

  // Polymer and Textile Management
  {
    id: 't-ptm-1',
    department: 'Polymer and Textile Management',
    level: 'ND I',
    day: 'Tuesday',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    courseCode: 'PTM 111',
    venue: 'Weaving Workshop',
    type: 'class'
  },
  {
    id: 't-ptm-2',
    department: 'Polymer and Textile Management',
    level: 'ND I',
    day: 'Thursday',
    startTime: '11:00 AM',
    endTime: '01:00 PM',
    courseCode: 'PTM 121',
    venue: 'Spinning & Polymer Lab',
    type: 'class'
  }
];
