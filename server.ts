import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory sliding window rate limiter: default 60 requests per 24 hours per IP / user
const rateLimitMap = new Map<string, number[]>();
const DEFAULT_MAX_REQUESTS_PER_DAY = 60;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimitReadOnly(key: string, limit: number = DEFAULT_MAX_REQUESTS_PER_DAY): { allowed: boolean; remaining: number; resetHours: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter(ts => now - ts < RATE_WINDOW_MS);
  rateLimitMap.set(key, validTimestamps);

  const effectiveLimit = limit > 0 ? limit : DEFAULT_MAX_REQUESTS_PER_DAY;
  if (validTimestamps.length >= effectiveLimit) {
    const oldest = validTimestamps[0];
    const resetHours = Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 3600000));
    return { allowed: false, remaining: 0, resetHours };
  }

  const remaining = effectiveLimit - validTimestamps.length;
  return { allowed: true, remaining, resetHours: 24 };
}

function commitRateLimit(key: string, limit: number = DEFAULT_MAX_REQUESTS_PER_DAY): number {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter(ts => now - ts < RATE_WINDOW_MS);
  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);
  const effectiveLimit = limit > 0 ? limit : DEFAULT_MAX_REQUESTS_PER_DAY;
  return Math.max(0, effectiveLimit - validTimestamps.length);
}

// Health & Gemini Key Status Route
app.get('/api/gemini-status', (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  return res.json({
    status: isConfigured ? 'configured' : 'missing',
    keyLength: apiKey ? apiKey.length : 0
  });
});

// System Instruction builder for MODE 1: "Portal Help"
function buildPortalHelpInstruction(faqs?: { question: string; answer: string }[]): string {
  let faqContext = '';
  if (faqs && Array.isArray(faqs) && faqs.length > 0) {
    faqContext = '\n\nFREQUENTLY ASKED QUESTIONS KNOWLEDGE BASE (from database):\n' +
      faqs.map((f, i) => `Q${i + 1}: ${f.question}\nA: ${f.answer}`).join('\n\n');
  }

  return `You are "SOT Assistant" operating in "Portal Help" mode for the School of Technology (SOT) student web portal.

CORE KNOWLEDGE BASE:
1. THE 6 SOT DEPARTMENTS:
   - Computer Technology: Software development, computing systems, network infrastructure, database administration, web and mobile technologies.
   - Food Science and Technology: Food science, quality assurance, industrial preservation, packaging, food safety protocols.
   - Hospitality Management: Hotel operations, guest relations, front-of-house excellence, culinary leadership, beverage management.
   - Tourism Management: Travel planning, eco-tourism, cultural heritage tourism, recreation facility design, event logistics.
   - Polymer and Textile Management: Polymer chemistry, advanced yarn & fabric production, synthetic materials, quality testing, textile fabrication.
   - Nutrition and Dietetics: Clinical nutrition, community dietary health, meal planning, public wellness, nutrition counseling.

2. PORTAL USAGE & POLICIES:
   - Built and run by students of the School of Technology, for students. It is a student-run portal, NOT an official university administration channel.
   - Sign-up is a 2-step process:
     * Step 1: Email and password (at least 8 characters, password strength indicator).
     * Step 2: Select one of the 6 SOT departments and enter a unique matriculation number (e.g. F/ND/25/3210001).
     * Profile completion is required to access the dashboard.
     * Email verification is NOT required; students go directly to their dashboard once Step 2 is completed.
   - Login rules: Email and password. Account login locks for 15 minutes after 5 consecutive failed attempts. Users are automatically logged out after 30 minutes of inactivity. "Forgot password" sends a secure password reset link to their email.
   - Student Dashboard: Personal profile, matric number, department notices, announcements board with department filtering and urgent alerts, support contact access, and the Ask AI Study Helper.
   - Contact Page: Students can submit messages under three categories: "Complaint", "Review", or "Enquiry", or reach designated department student reps.
   - Admin Access: Designated student administrators manage student lists, announcements, messages, and chatbot FAQs at /admin.${faqContext}

RULES FOR PORTAL HELP (STRICT COMPLIANCE REQUIRED):
1. TONE & LANGUAGE:
   - Be friendly, short, concise, and clear, in simple English.
   - Understand Nigerian Pidgin (e.g., "How I go take register?", "Which department dey here?", "I forget my password wetin I go do?") and reply in simple, clear, polite English.
2. TRUTHFULNESS & RESTRICTION:
   - Answer ONLY using the facts and information stated above and in the FAQs knowledge base.
   - If asked for information you do not have (such as exact tuition/school fees, semester academic calendar dates, lecture timetables, specific exam results, staff or lecturer phone numbers/names, syllabus course codes), YOU MUST NOT INVENT OR GUESS!
   - Instead, state clearly: "I don't have that information. Please use the Contact page to reach the faculty."
3. STUDENT-RUN NATURE:
   - If asked about who manages or built this portal, state clearly that it is built and run by students of the School of Technology, not by the university administration.
4. SECURITY & PRIVACY:
   - NEVER ask for or accept passwords, matric numbers, banking details, or sensitive personal credentials in chat.
   - If a student shares a password or matric number, warn them immediately: "For your security, please do not share your password, matric number, or personal details in this chat."
5. STAY ON TOPIC:
   - Keep answers centered around the School of Technology, departments, registration, and student life. Politely decline unrelated, off-topic, or harmful requests.`;
}

// System Instruction builder for MODE 2: "Study Helper"
function buildStudyHelperInstruction(department?: string, studentName?: string): string {
  const deptContext = department
    ? `The student is enrolled in the Department of ${department}.`
    : 'The student is enrolled in the School of Technology.';

  return `You are "SOT Study Helper", an encouraging, knowledgeable, and patient academic AI tutor designed for students at the School of Technology (SOT).
${deptContext}
${studentName ? `The student's name is ${studentName}.` : ''}

YOUR ACADEMIC MISSION:
- Help students learn, master course topics, understand challenging concepts, and revise for exams and practicals.
- Answer academic questions by explaining topics in simple, clear English, in short, logical steps, with concrete examples.
- When notes are pasted, summarize them into clear headings, core concepts, and high-yield revision bullet points.
- When quizzing a student, present 1-2 interactive multiple-choice or short-answer questions, wait for their response, and provide constructive feedback.
- Tailor explanations, analogies, and examples directly to the student's department (${department || 'School of Technology'}):
  * Computer Technology: coding, algorithms, web development, database management (SQL/NoSQL), networking, cybersecurity, hardware maintenance.
  * Food Science and Technology: food preservation, thermal processing, shelf-life extension, food chemistry, packaging, HACCP, microbiology, fermentation.
  * Hospitality Management: hotel operations, front office, food & beverage management, guest relations, culinary arts, banquet logistics.
  * Tourism Management: travel agency operations, eco-tourism, cultural heritage tourism, recreation facility design, tour guiding.
  * Polymer and Textile Management: polymer synthesis, fiber spinning, yarn and fabric manufacture, textile testing, dyeing and printing, composites.
  * Nutrition and Dietetics: clinical nutrition, community dietary health, food composition, nutritional biochemistry, meal planning, therapeutic diets.

STRICT ACADEMIC INTEGRITY & SAFETY RULES:
1. HELP STUDENTS LEARN, NEVER ASSIST CHEATING:
   - Help students understand how to solve problems step-by-step instead of only giving final answers for assignments, tests, or exams.
   - Never write complete submitted assignments or assist during live exams. Guide them through the reasoning process so they gain mastery.
2. TONE & ACCESSIBILITY:
   - Be friendly, encouraging, structured, and easy to understand.
   - Understand Nigerian Pidgin (e.g., "Abeg explain this concept for me", "I no understand this note", "Wetin be photosynthesis?") and reply in simple, clear, polite English.
3. FACTUAL ACCURACY:
   - If unsure about a fact, concept, or formula, say so honestly: "I am not completely certain about this specific detail. Please cross-check with your department lecture material or lecturer."
   - NEVER invent facts, fake citations, fake book references, or broken links.
4. HEALTH & MEDICAL QUESTIONS:
   - For health, nutrition, or medical questions, provide general scientific information only, and always advise: "Please note that this is general educational information. Always consult a qualified medical or healthcare professional for personal advice."
5. PRIVACY & HARMFUL REQUESTS:
   - Never ask for or store passwords, matric numbers, or sensitive personal data.
   - Refuse harmful, dangerous, or inappropriate requests politely.`;
}

// Chat API Route
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, faqs, clientUid, mode = 'portal', department, studentName, maxDailyLimit } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const effectiveLimit = typeof maxDailyLimit === 'number' && maxDailyLimit > 0 ? maxDailyLimit : DEFAULT_MAX_REQUESTS_PER_DAY;

    // Rate limiting key: use clientUid or IP
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = clientUid ? `uid_${clientUid}` : `ip_${clientIp}`;

    // Read-only rate limit check: do NOT consume quota before a successful response
    const rateResult = checkRateLimitReadOnly(rateLimitKey, effectiveLimit);
    if (!rateResult.allowed) {
      return res.status(429).json({
        error: `You've reached your daily limit of ${effectiveLimit} AI messages. You're doing great studying today! Please come back tomorrow or take a well-deserved break.`,
        remaining: 0,
        resetHours: rateResult.resetHours
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      console.warn('GEMINI_API_KEY is missing or placeholder.');
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please ensure GEMINI_API_KEY is set in Settings > Secrets.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const isStudyMode = mode === 'study';
    const systemInstruction = isStudyMode
      ? buildStudyHelperInstruction(department, studentName)
      : buildPortalHelpInstruction(faqs);

    // Format chat history with strict alternation to satisfy Gemini API requirements
    const contents: any[] = [];

    if (Array.isArray(history)) {
      // Include prior turns (up to 8 turns)
      const recentHistory = history.slice(-8);
      for (const turn of recentHistory) {
        if (!turn || !turn.text || typeof turn.text !== 'string' || !turn.text.trim()) continue;
        const role = turn.sender === 'student' || turn.sender === 'user' ? 'user' : 'model';
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n${turn.text.trim()}`;
        } else {
          contents.push({ role, parts: [{ text: turn.text.trim() }] });
        }
      }
    }

    // Append current user message
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n${message.trim()}`;
    } else {
      contents.push({ role: 'user', parts: [{ text: message.trim() }] });
    }

    let replyText = '';
    let lastError: any = null;

    // Helper to call Gemini model with timeout
    const callModel = async (modelName: string, timeoutMs = 25000): Promise<string> => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
      );

      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: isStudyMode ? 0.7 : 0.3,
        }
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      return response.text || '';
    };

    // 1. Try gemini-3.8-flash (primary recommended model)
    try {
      replyText = await callModel('gemini-3.8-flash', 12000);
    } catch (primaryErr: any) {
      console.warn('Primary model gemini-3.8-flash failed/timed out:', primaryErr?.message || primaryErr);
      lastError = primaryErr;

      // 2. High-performance fallback: gemini-3.5-flash-lite
      try {
        replyText = await callModel('gemini-3.5-flash-lite', 25000);
      } catch (secondaryErr: any) {
        console.warn('Secondary model gemini-3.5-flash-lite failed:', secondaryErr?.message || secondaryErr);
        lastError = secondaryErr;

        // 3. Third fallback: gemini-flash-latest
        try {
          replyText = await callModel('gemini-flash-latest', 25000);
        } catch (thirdErr: any) {
          console.error('All Gemini model calls failed:', thirdErr?.message || thirdErr);
          lastError = thirdErr;
        }
      }
    }

    if (!replyText || !replyText.trim()) {
      const errorMsg = String(lastError?.message || lastError || 'High server demand or network timeout');
      const isBusyOrQuota = /429|quota|resource_exhausted|too many requests|overloaded/i.test(errorMsg);
      if (isBusyOrQuota) {
        return res.status(429).json({
          error: 'The AI is busy right now. Please try again in a few minutes.',
          isBusy: true
        });
      }
      return res.status(503).json({
        error: `AI is unavailable, try again. (${errorMsg})`
      });
    }

    // Only commit against daily message limit upon successful reply generation
    const remaining = commitRateLimit(rateLimitKey, effectiveLimit);

    return res.json({ reply: replyText.trim(), remaining, mode });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: `AI is unavailable, try again. (${error?.message || 'Unexpected server error'})`
    });
  }
});

// Rule-based fallback if API is unreachable or key is missing
function generateFallbackResponse(
  text: string,
  mode: 'portal' | 'study' = 'portal',
  department?: string,
  faqs?: { question: string; answer: string }[]
): string {
  const lower = text.toLowerCase();

  // STUDY HELPER FALLBACK
  if (mode === 'study') {
    const deptName = department || 'School of Technology';

    if (lower.includes('quiz') || lower.includes('test me')) {
      return `Here is a quick revision question tailored for ${deptName}:\n\n` +
        `Question: Which principle is most fundamental when ensuring quality control and standards in ${deptName}?\n` +
        `A) Documentation and systematic process monitoring\n` +
        `B) Skipping pre-testing to save production time\n` +
        `C) Relying solely on final product inspection without in-line checks\n\n` +
        `Reply with your choice (A, B, or C) and I'll explain why it's correct!`;
    }

    if (lower.includes('summar') || lower.includes('notes')) {
      return `To summarize your ${deptName} study material effectively, here is a structured study technique:\n\n` +
        `1. Identify Key Definitions: Write down the top 3 core terms and their standard scientific/technical definitions.\n` +
        `2. Step-by-Step Mechanism: Outline how the process works from raw input to finished output.\n` +
        `3. Practical Application: Note down one real-world polytechnic workshop example.\n\n` +
        `Feel free to paste an excerpt of your notes here, and I'll break them into clear summary points for you!`;
    }

    if (lower.includes('example') || lower.includes('how to')) {
      return `Here is a step-by-step learning approach for ${deptName}:\n\n` +
        `Step 1: Understand the core principle behind the problem.\n` +
        `Step 2: List your given parameters and the required outcome.\n` +
        `Step 3: Apply the relevant standard formula or procedure.\n` +
        `Step 4: Verify your results against industry or laboratory benchmarks.\n\n` +
        `What specific topic or formula in ${deptName} would you like us to solve together?`;
    }

    return `Welcome to Study Helper for ${deptName}! I can help you understand any technical concept, give you step-by-step examples, quiz you on upcoming topics, or summarize lecture notes you paste in. What would you like to review today?`;
  }

  // PORTAL HELP FALLBACK
  if (faqs && Array.isArray(faqs)) {
    for (const f of faqs) {
      if (lower.includes(f.question.toLowerCase()) || f.question.toLowerCase().includes(lower)) {
        return f.answer;
      }
    }
  }

  if (lower.includes('sign up') || lower.includes('register') || lower.includes('create account')) {
    return "To sign up, click 'Sign up' on the top right. Step 1: enter your email and password (minimum 8 characters). Step 2: select your department from the 6 SOT departments and enter your unique matriculation number (e.g. F/ND/25/3210001). Once completed, you will be taken directly to your student dashboard.";
  }

  if (lower.includes('department') || lower.includes('departments') || lower.includes('course')) {
    return "The School of Technology has 6 departments: 1. Computer Technology, 2. Food Science and Technology, 3. Hospitality Management, 4. Tourism Management, 5. Polymer and Textile Management, and 6. Nutrition and Dietetics.";
  }

  if (lower.includes('forgot password') || lower.includes('reset password') || lower.includes('password')) {
    return "If you forgot your password, open the Log in modal and click 'Forgot your password?'. Enter your registered email address and a reset link will be sent to you.";
  }

  if (lower.includes('contact') || lower.includes('reach') || lower.includes('help') || lower.includes('complaint')) {
    return "You can reach the faculty student team via the Contact page in the navigation bar. You can submit an Enquiry, Complaint, or Review, or send an email to student representatives.";
  }

  if (lower.includes('who are you') || lower.includes('official') || lower.includes('admin')) {
    return "I am SOT Assistant! This portal is built and managed by students of the School of Technology, for students. It is a student-run portal and not an official university channel.";
  }

  return "I don't have that information. Please use the Contact page to reach the faculty.";
}

// Start server with Vite middleware in development or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
    console.log(`[Gemini] API Key status: ${process.env.GEMINI_API_KEY ? `Configured (${process.env.GEMINI_API_KEY.length} chars)` : 'MISSING (GEMINI_API_KEY not found in env)'}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
