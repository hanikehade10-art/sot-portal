import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth, safeAddDoc, safeUpdateDoc, cleanFirestoreData } from '../lib/firebase';
import { CourseItem, TopicItem, ResourceItem, ResourceType, QuizItem, CourseAccentColor } from '../types';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import { ACCENT_COLOR_OPTIONS, getCourseAccent } from '../config/courseAccents';
import { FormattedLessonNotes } from './FormattedLessonNotes';
import {
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl,
  getYouTubeEmbedUrl
} from '../data/coursesAndTimetables';
import { dispatchPushNotification, getDepartmentTopicSlug } from '../lib/pushNotifications';
import { logActivity } from '../lib/activityLogger';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  Video,
  FileText,
  Link2,
  FileQuestion,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  FolderOpen,
  Play,
  X,
  RefreshCw,
  Clock,
  Eye,
  List,
  Bold,
  Heading,
  Check
} from 'lucide-react';

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];

interface AdminCoursesManagerProps {
  onNotify?: (msg?: string) => void;
  userDepartment?: string;
  isRepMode?: boolean;
  onAddQuizForTopic?: (topic: TopicItem, course: CourseItem) => void;
}

export const AdminCoursesManager: React.FC<AdminCoursesManagerProps> = ({
  onNotify,
  userDepartment,
  isRepMode,
  onAddQuizForTopic
}) => {
  // Filters (locked to user's department for Reps)
  const [selectedDept, setSelectedDept] = useState<string>(
    userDepartment || SOT_DEPARTMENTS_LIST[0]
  );
  const [selectedLevel, setSelectedLevel] = useState<'ND1' | 'ND2' | 'HND1' | 'HND2'>('ND1');
  const [selectedSemester, setSelectedSemester] = useState<'First Semester' | 'Second Semester'>('First Semester');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected course for detailed topic & resource management
  const [managingCourseId, setManagingCourseId] = useState<string | null>(null);

  // Feedback notifications (Green Saved / Red Error)
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showSaved = (msg: string = 'Saved') => {
    setSavedMessage(msg);
    setErrorMessage(null);
    setTimeout(() => {
      setSavedMessage(null);
    }, 3500);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSavedMessage(null);
  };

  // Modals
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showBatchCourseModal, setShowBatchCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);

  // Course Form
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseUnits, setCourseUnits] = useState<number | string>(3);
  const [courseAccentColor, setCourseAccentColor] = useState<CourseAccentColor>('Teal');
  const [courseCoverImageUrl, setCourseCoverImageUrl] = useState('');
  const [courseAbout, setCourseAbout] = useState('');
  const [batchCoursesText, setBatchCoursesText] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  // Topic Modals
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showBatchTopicModal, setShowBatchTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [batchTopicsText, setBatchTopicsText] = useState('');
  const [savingTopic, setSavingTopic] = useState(false);
  const [notifyTopicStudents, setNotifyTopicStudents] = useState(true);
  const [notifyResourceStudents, setNotifyResourceStudents] = useState(true);

  // Resource Item Modal (Video, Note, Link, Past Question, Course Material)
  const [resourceModalConfig, setResourceModalConfig] = useState<{
    isOpen: boolean;
    type: ResourceType;
    topicId?: string;
    isCourseWide?: boolean;
    title: string;
    url: string;
    editingId?: string;
  }>({
    isOpen: false,
    type: 'Note',
    title: '',
    url: ''
  });
  const [savingResource, setSavingResource] = useState(false);

  // Lesson Editor State (Full Interactive Learning Experience)
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLessonTopic, setEditingLessonTopic] = useState<TopicItem | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonLevelTag, setLessonLevelTag] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [lessonWhatYoullLearnText, setLessonWhatYoullLearnText] = useState('');
  const [lessonBeforeYouBegin, setLessonBeforeYouBegin] = useState('');
  const [lessonEstimatedMinutes, setLessonEstimatedMinutes] = useState('15');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonNotes, setLessonNotes] = useState('');
  const [lessonNotesPdfUrl, setLessonNotesPdfUrl] = useState('');
  const [lessonSummary, setLessonSummary] = useState('');
  const [lessonFurtherReading, setLessonFurtherReading] = useState<Array<{ title: string; url: string }>>([]);
  const [lessonOrder, setLessonOrder] = useState<number>(1);
  const [lessonLinkedQuizId, setLessonLinkedQuizId] = useState<string>('');
  const [lessonRequireQuizToComplete, setLessonRequireQuizToComplete] = useState<boolean>(false);
  const [lessonNotify, setLessonNotify] = useState<boolean>(true);
  const [lessonLivePreview, setLessonLivePreview] = useState<boolean>(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizItem[]>([]);

  // Open Lesson Editor
  const handleOpenLessonEditor = (topic: TopicItem) => {
    setEditingLessonTopic(topic);
    setLessonTitle(topic.title || '');
    setLessonLevelTag(topic.levelTag || 'Beginner');
    setLessonWhatYoullLearnText(
      topic.whatYoullLearn && topic.whatYoullLearn.length > 0
        ? topic.whatYoullLearn.join('\n')
        : ''
    );
    setLessonBeforeYouBegin(topic.beforeYouBegin || '');
    setLessonEstimatedMinutes(topic.estimatedMinutes ? String(topic.estimatedMinutes) : '15');
    setLessonVideoUrl(topic.videoUrl || '');
    setLessonNotes(topic.notes || '');
    setLessonNotesPdfUrl(topic.notesPdfUrl || '');
    setLessonSummary(topic.summary || '');
    setLessonFurtherReading(topic.furtherReading && topic.furtherReading.length > 0 ? [...topic.furtherReading] : []);
    setLessonOrder(topic.order || 1);
    setLessonLinkedQuizId(topic.linkedQuizId || '');
    setLessonRequireQuizToComplete(Boolean(topic.requireQuizToComplete));
    setLessonNotify(true);
    setLessonLivePreview(false);
    setShowLessonModal(true);
  };

  // Add Further Reading Link
  const handleAddFurtherReadingLink = () => {
    setLessonFurtherReading(prev => [...prev, { title: '', url: '' }]);
  };

  const handleUpdateFurtherReadingLink = (index: number, field: 'title' | 'url', value: string) => {
    setLessonFurtherReading(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveFurtherReadingLink = (index: number) => {
    setLessonFurtherReading(prev => prev.filter((_, i) => i !== index));
  };

  // Insert formatting into notes
  const insertFormatting = (prefix: string, suffix: string = '') => {
    setLessonNotes(prev => `${prev}${prev ? '\n' : ''}${prefix} ${suffix}`);
  };

  // Save Lesson Content
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLessonTopic || !currentManagingCourse) return;
    if (!lessonTitle.trim()) {
      showError('Lesson topic title is required.');
      return;
    }

    setSavingLesson(true);
    try {
      const nowIso = new Date().toISOString();
      const parsedMinutes = Number(lessonEstimatedMinutes);
      const estMinutes = !isNaN(parsedMinutes) && parsedMinutes > 0 ? Math.round(parsedMinutes) : 15;

      const cleanReading = lessonFurtherReading
        .map(r => ({ title: r.title.trim(), url: r.url.trim() }))
        .filter(r => r.title && r.url);

      const updatePayload: Partial<TopicItem> = {
        title: lessonTitle.trim(),
        estimatedMinutes: estMinutes,
        levelTag: lessonLevelTag,
        whatYoullLearn: lessonWhatYoullLearnText.split('\n').map(l => l.trim()).filter(Boolean),
        beforeYouBegin: lessonBeforeYouBegin.trim() || '',
        videoUrl: lessonVideoUrl.trim() || '',
        notes: lessonNotes || '',
        notesPdfUrl: lessonNotesPdfUrl.trim() || '',
        summary: lessonSummary.trim() || '',
        furtherReading: cleanReading.length > 0 ? cleanReading : [],
        order: Number(lessonOrder) || 1,
        linkedQuizId: lessonLinkedQuizId.trim() || '',
        requireQuizToComplete: Boolean(lessonRequireQuizToComplete),
        updatedAt: nowIso
      };

      await safeUpdateDoc(doc(db, 'topics', editingLessonTopic.id), cleanFirestoreData(updatePayload));

      setTopics(prev =>
        prev.map(t => (t.id === editingLessonTopic.id ? { ...t, ...updatePayload } : t))
      );

      // Record Activity
      if (auth.currentUser) {
        await logActivity({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || 'Admin/Rep',
          role: isRepMode ? 'Rep' : 'Admin',
          action: 'Updated',
          itemType: 'Topic',
          title: `${currentManagingCourse.code}: ${lessonTitle.trim()}`
        }).catch(() => {});
      }

      // Notify students if requested
      if (lessonNotify && auth.currentUser) {
        const topicPushSlug = `dept-${getDepartmentTopicSlug(currentManagingCourse.department)}-${currentManagingCourse.level.toLowerCase()}`;
        dispatchPushNotification(
          {
            topic: topicPushSlug,
            title: `Lesson Updated: ${currentManagingCourse.code}`,
            body: `${lessonTitle.trim()} notes and study materials are now live!`,
            link: '/dashboard?tab=courses'
          },
          auth.currentUser
        ).catch(e => console.warn('Lesson push error:', e));
      }

      showSaved('Saved');
      setShowLessonModal(false);
      setEditingLessonTopic(null);
    } catch (err: any) {
      console.error('Error saving lesson:', err);
      showError(err.message || 'Failed to save lesson content.');
    } finally {
      setSavingLesson(false);
    }
  };

  // Fetch all courses, topics, resources, and quizzes
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Courses
      const cSnap = await getDocs(collection(db, 'courses'));
      const cList: CourseItem[] = [];
      cSnap.forEach(d => {
        cList.push({ id: d.id, ...(d.data() as any) });
      });
      setCourses(cList);

      // 2. Topics
      const tSnap = await getDocs(collection(db, 'topics'));
      const tList: TopicItem[] = [];
      tSnap.forEach(d => {
        tList.push({ id: d.id, ...(d.data() as any) });
      });
      tList.sort((a, b) => (a.order || 0) - (b.order || 0));
      setTopics(tList);

      // 3. Resources
      const rSnap = await getDocs(collection(db, 'resources'));
      const rList: ResourceItem[] = [];
      rSnap.forEach(d => {
        rList.push({ id: d.id, ...(d.data() as any) });
      });
      setResources(rList);

      // 4. Quizzes
      try {
        const qSnap = await getDocs(collection(db, 'quizzes'));
        const qList: QuizItem[] = [];
        qSnap.forEach(d => {
          qList.push({ id: d.id, ...(d.data() as any) });
        });
        setAvailableQuizzes(qList);
      } catch (qErr) {
        console.warn('Could not load quizzes for lesson linker:', qErr);
      }
    } catch (err: any) {
      console.error('Error loading courses/topics/resources:', err);
      showError(err.message || 'Failed to load course data from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered courses for currently selected Dept, Level, and Semester
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      const matchDept = c.department === selectedDept;
      const matchLevel = normalizeCourseLevel(c.level) === selectedLevel;
      const matchSem = normalizeCourseSemester(c.semester) === selectedSemester;
      if (!matchDept || !matchLevel || !matchSem) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [courses, selectedDept, selectedLevel, selectedSemester, searchQuery]);

  // Managing Course
  const currentManagingCourse = useMemo(() => {
    if (!managingCourseId) return null;
    return courses.find(c => c.id === managingCourseId) || null;
  }, [courses, managingCourseId]);

  // Topics for the managing course (sorted by order)
  const currentTopics = useMemo(() => {
    if (!managingCourseId) return [];
    return topics
      .filter(t => t.courseId === managingCourseId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [topics, managingCourseId]);

  // Resources for the managing course
  const currentCourseResources = useMemo(() => {
    if (!managingCourseId || !currentManagingCourse) return [];
    return resources.filter(r => {
      return r.courseId === managingCourseId || (r.courseCode && r.courseCode === currentManagingCourse.code);
    });
  }, [resources, managingCourseId, currentManagingCourse]);

  // Course-wide resources (not tied to any topic)
  const courseWideResources = useMemo(() => {
    return currentCourseResources.filter(r => !r.topicId);
  }, [currentCourseResources]);

  // Get resources for a specific topic
  const getTopicResources = (topicId: string) => {
    return currentCourseResources.filter(r => r.topicId === topicId);
  };

  // -------------------------------------------------------------
  // COURSE CRUD OPERATIONS
  // -------------------------------------------------------------
  const handleOpenAddCourse = () => {
    setEditingCourse(null);
    setCourseCode('');
    setCourseTitle('');
    setCourseUnits(3);
    setCourseAccentColor('Teal');
    setCourseCoverImageUrl('');
    setCourseAbout('');
    setShowAddCourseModal(true);
  };

  const handleOpenEditCourse = (course: CourseItem) => {
    setEditingCourse(course);
    setCourseCode(course.code);
    setCourseTitle(course.title);
    setCourseUnits(typeof course.units === 'number' ? course.units : 3);
    setCourseAccentColor(course.accentColor || 'Teal');
    setCourseCoverImageUrl(course.coverImageUrl || '');
    setCourseAbout(course.about || '');
    setShowAddCourseModal(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) {
      showError('Course code and course title are required.');
      return;
    }

    const parsedUnits = typeof courseUnits === 'number' ? courseUnits : parseInt(String(courseUnits).trim(), 10);
    if (isNaN(parsedUnits) || parsedUnits < 1 || parsedUnits > 6) {
      showError('Credit units must be a whole number between 1 and 6.');
      return;
    }
    const finalUnits = Math.round(parsedUnits);

    setSavingCourse(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: Partial<CourseItem> = {
        department: selectedDept,
        level: selectedLevel,
        semester: selectedSemester,
        code: courseCode.trim().toUpperCase(),
        title: courseTitle.trim(),
        units: finalUnits,
        accentColor: courseAccentColor,
        coverImageUrl: courseCoverImageUrl.trim() || '',
        about: courseAbout.trim() || '',
        updatedAt: nowIso
      };

      if (editingCourse) {
        await safeUpdateDoc(doc(db, 'courses', editingCourse.id), cleanFirestoreData(payload));
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...payload } : c));
        showSaved('Saved');
      } else {
        const ref = await safeAddDoc(collection(db, 'courses'), cleanFirestoreData({
          ...payload,
          createdAt: nowIso
        }));
        const newCourse: CourseItem = {
          id: ref?.id || ('course_' + Date.now()),
          ...payload,
          createdAt: nowIso,
          type: 'Core'
        } as CourseItem;
        setCourses(prev => [...prev, newCourse]);
        showSaved('Saved');
      }

      setShowAddCourseModal(false);
      setEditingCourse(null);
    } catch (err: any) {
      console.error('Error saving course:', err);
      showError(err.message || 'Failed to save course to Firestore.');
    } finally {
      setSavingCourse(false);
    }
  };

  // Add multiple courses at once: "COM 111 | Introduction to Computer | 3"
  const handleBatchAddCourses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCoursesText.trim()) return;

    const lines = batchCoursesText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setSavingCourse(true);
    try {
      const nowIso = new Date().toISOString();
      const addedCourses: CourseItem[] = [];

      for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        const code = parts[0]?.toUpperCase() || '';
        const title = parts[1] || '';
        let units = 3;
        if (parts[2] !== undefined && parts[2] !== '') {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
            units = parsed;
          } else if (!isNaN(parsed)) {
            units = Math.max(1, Math.min(6, parsed));
          }
        }

        if (code && title) {
          const payload = {
            department: selectedDept,
            level: selectedLevel,
            semester: selectedSemester,
            code,
            title,
            units,
            type: 'Core' as const,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          const ref = await safeAddDoc(collection(db, 'courses'), cleanFirestoreData(payload));
          addedCourses.push({ id: ref?.id || ('course_' + Date.now()), ...payload });
        }
      }

      setCourses(prev => [...prev, ...addedCourses]);
      setShowBatchCourseModal(false);
      setBatchCoursesText('');
      showSaved(`Saved ${addedCourses.length} courses!`);
    } catch (err: any) {
      console.error('Batch add error:', err);
      showError(err.message || 'Failed to batch add courses.');
    } finally {
      setSavingCourse(false);
    }
  };

  // Delete Course: also deletes its topics and resources
  const handleDeleteCourse = async (course: CourseItem) => {
    const confirmDelete = window.confirm(
      `Delete "${course.code}: ${course.title}"?\n\nWARNING: This will also delete all of its topics and associated learning materials/past questions.`
    );
    if (!confirmDelete) return;

    try {
      // 1. Delete associated resources
      const relatedResources = resources.filter(r => r.courseId === course.id || r.courseCode === course.code);
      for (const r of relatedResources) {
        await deleteDoc(doc(db, 'resources', r.id));
      }
      setResources(prev => prev.filter(r => r.courseId !== course.id && r.courseCode !== course.code));

      // 2. Delete associated topics
      const relatedTopics = topics.filter(t => t.courseId === course.id);
      for (const t of relatedTopics) {
        await deleteDoc(doc(db, 'topics', t.id));
      }
      setTopics(prev => prev.filter(t => t.courseId !== course.id));

      // 3. Delete course
      await deleteDoc(doc(db, 'courses', course.id));
      setCourses(prev => prev.filter(c => c.id !== course.id));

      if (managingCourseId === course.id) {
        setManagingCourseId(null);
      }

      showSaved('Course and all associated topics and materials deleted.');
    } catch (err: any) {
      console.error('Error deleting course:', err);
      showError(err.message || 'Failed to delete course and its dependencies.');
    }
  };

  // -------------------------------------------------------------
  // TOPIC CRUD & REORDER OPERATIONS
  // -------------------------------------------------------------
  const handleOpenAddTopic = () => {
    setEditingTopic(null);
    setTopicTitle('');
    setShowAddTopicModal(true);
  };

  const handleOpenEditTopic = (topic: TopicItem) => {
    setEditingTopic(topic);
    setTopicTitle(topic.title);
    setShowAddTopicModal(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCourseId || !currentManagingCourse || !topicTitle.trim()) {
      showError('Topic title is required.');
      return;
    }

    setSavingTopic(true);
    try {
      const nowIso = new Date().toISOString();

      if (editingTopic) {
        await safeUpdateDoc(doc(db, 'topics', editingTopic.id), cleanFirestoreData({
          title: topicTitle.trim(),
          updatedAt: nowIso
        }));
        setTopics(prev => prev.map(t => t.id === editingTopic.id ? { ...t, title: topicTitle.trim() } : t));
        showSaved('Saved');
      } else {
        const nextOrder = currentTopics.length > 0 ? Math.max(...currentTopics.map(t => t.order || 0)) + 1 : 1;
        const payload = {
          courseId: managingCourseId,
          department: currentManagingCourse.department,
          level: currentManagingCourse.level,
          semester: currentManagingCourse.semester,
          title: topicTitle.trim(),
          order: nextOrder,
          createdAt: nowIso
        };
        const ref = await safeAddDoc(collection(db, 'topics'), cleanFirestoreData(payload));
        const newTopic: TopicItem = { id: ref?.id || ('topic_' + Date.now()), ...payload };
        setTopics(prev => [...prev, newTopic]);
        showSaved('Saved');

        if (notifyTopicStudents && auth.currentUser) {
          const topic = `dept-${getDepartmentTopicSlug(currentManagingCourse.department)}-${currentManagingCourse.level.toLowerCase()}`;
          dispatchPushNotification(
            {
              topic,
              title: 'SOT: New Topic Added',
              body: `${currentManagingCourse.code}: ${topicTitle.trim()}`,
              link: '/dashboard?tab=courses'
            },
            auth.currentUser
          ).catch((e) => console.warn('Topic push dispatch notice:', e));
        }
      }

      setShowAddTopicModal(false);
      setEditingTopic(null);
      setTopicTitle('');
    } catch (err: any) {
      console.error('Error saving topic:', err);
      showError(err.message || 'Failed to save topic.');
    } finally {
      setSavingTopic(false);
    }
  };

  // Batch Add Topics: one topic per line
  const handleBatchAddTopics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCourseId || !currentManagingCourse || !batchTopicsText.trim()) return;

    const lines = batchTopicsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setSavingTopic(true);
    try {
      const nowIso = new Date().toISOString();
      let startOrder = currentTopics.length > 0 ? Math.max(...currentTopics.map(t => t.order || 0)) : 0;
      const newTopicsList: TopicItem[] = [];

      for (const line of lines) {
        startOrder += 1;
        const payload = {
          courseId: managingCourseId,
          department: currentManagingCourse.department,
          level: currentManagingCourse.level,
          semester: currentManagingCourse.semester,
          title: line,
          order: startOrder,
          createdAt: nowIso
        };
        const ref = await safeAddDoc(collection(db, 'topics'), cleanFirestoreData(payload));
        newTopicsList.push({ id: ref?.id || ('topic_' + Date.now()), ...payload });
      }

      setTopics(prev => [...prev, ...newTopicsList]);

      if (notifyTopicStudents && auth.currentUser && newTopicsList.length > 0) {
        const topic = `dept-${getDepartmentTopicSlug(currentManagingCourse.department)}-${currentManagingCourse.level.toLowerCase()}`;
        dispatchPushNotification(
          {
            topic,
            title: 'SOT: New Topics Added',
            body: `${currentManagingCourse.code}: Added ${newTopicsList.length} syllabus topics`,
            link: '/dashboard?tab=courses'
          },
          auth.currentUser
        ).catch((e) => console.warn('Batch topic push dispatch notice:', e));
      }

      setShowBatchTopicModal(false);
      setBatchTopicsText('');
      showSaved(`Saved ${newTopicsList.length} topics!`);
    } catch (err: any) {
      console.error('Batch add topics error:', err);
      showError(err.message || 'Failed to batch add topics.');
    } finally {
      setSavingTopic(false);
    }
  };

  // Delete Topic
  const handleDeleteTopic = async (topic: TopicItem) => {
    if (!window.confirm(`Delete topic "${topic.title}"? Associated items will also be removed.`)) return;

    try {
      // 1. Delete topic items
      const topicResources = resources.filter(r => r.topicId === topic.id);
      for (const r of topicResources) {
        await deleteDoc(doc(db, 'resources', r.id));
      }
      setResources(prev => prev.filter(r => r.topicId !== topic.id));

      // 2. Delete topic
      await deleteDoc(doc(db, 'topics', topic.id));
      setTopics(prev => prev.filter(t => t.id !== topic.id));
      showSaved('Saved');
    } catch (err: any) {
      console.error('Delete topic error:', err);
      showError(err.message || 'Failed to delete topic.');
    }
  };

  // Reorder Topic: Move Up or Down
  const handleMoveTopic = async (topic: TopicItem, direction: 'up' | 'down') => {
    const sorted = [...currentTopics];
    const index = sorted.findIndex(t => t.id === topic.id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const targetTopic = sorted[swapIndex];

    const currentOrder = topic.order || (index + 1);
    const targetOrder = targetTopic.order || (swapIndex + 1);

    try {
      await safeUpdateDoc(doc(db, 'topics', topic.id), { order: targetOrder });
      await safeUpdateDoc(doc(db, 'topics', targetTopic.id), { order: currentOrder });

      setTopics(prev => prev.map(t => {
        if (t.id === topic.id) return { ...t, order: targetOrder };
        if (t.id === targetTopic.id) return { ...t, order: currentOrder };
        return t;
      }));
      showSaved('Saved');
    } catch (err: any) {
      console.error('Reorder error:', err);
      showError(err.message || 'Failed to reorder topics.');
    }
  };

  // -------------------------------------------------------------
  // RESOURCE ITEM MANAGEMENT (VIDEO, NOTE, LINK, PAST QUESTION, MATERIAL)
  // -------------------------------------------------------------
  const handleOpenAddResourceModal = (
    type: ResourceType,
    topicId?: string,
    isCourseWide: boolean = false
  ) => {
    setResourceModalConfig({
      isOpen: true,
      type,
      topicId,
      isCourseWide,
      title: '',
      url: ''
    });
  };

  const handleSaveResourceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentManagingCourse || !resourceModalConfig.title.trim() || !resourceModalConfig.url.trim()) {
      showError('Title and URL are required.');
      return;
    }

    setSavingResource(true);
    try {
      const nowIso = new Date().toISOString();
      const formattedUrl = formatPdfUrl(resourceModalConfig.url.trim());

      const payload: Omit<ResourceItem, 'id'> = {
        courseId: currentManagingCourse.id,
        courseCode: currentManagingCourse.code,
        topicId: resourceModalConfig.topicId || '',
        type: resourceModalConfig.type,
        title: resourceModalConfig.title.trim(),
        url: formattedUrl,
        department: currentManagingCourse.department,
        level: currentManagingCourse.level,
        semester: currentManagingCourse.semester,
        uploadedBy: auth.currentUser?.uid || 'admin',
        uploadedByEmail: auth.currentUser?.email || '',
        uploadedByRole: 'admin',
        createdAt: nowIso
      };

      if (resourceModalConfig.editingId) {
        await safeUpdateDoc(doc(db, 'resources', resourceModalConfig.editingId), cleanFirestoreData({
          title: payload.title,
          url: payload.url,
          type: payload.type,
          updatedAt: nowIso
        }));
        setResources(prev => prev.map(r => r.id === resourceModalConfig.editingId ? { ...r, ...payload, id: r.id } : r));
      } else {
        const ref = await safeAddDoc(collection(db, 'resources'), cleanFirestoreData(payload));
        const newResource: ResourceItem = {
          id: ref?.id || ('res_' + Date.now()),
          ...payload
        };
        setResources(prev => [newResource, ...prev]);

        if (notifyResourceStudents && auth.currentUser) {
          const topic = `dept-${getDepartmentTopicSlug(currentManagingCourse.department)}-${currentManagingCourse.level.toLowerCase()}`;
          dispatchPushNotification(
            {
              topic,
              title: `SOT: New ${resourceModalConfig.type}`,
              body: `${currentManagingCourse.code}: ${resourceModalConfig.title.trim()}`,
              link: '/dashboard?tab=courses'
            },
            auth.currentUser
          ).catch((e) => console.warn('Resource push dispatch notice:', e));
        }
      }

      setResourceModalConfig(prev => ({ ...prev, isOpen: false }));
      showSaved('Saved');
    } catch (err: any) {
      console.error('Error saving resource item:', err);
      showError(err.message || 'Failed to save resource item.');
    } finally {
      setSavingResource(false);
    }
  };

  const handleDeleteResource = async (resourceId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'resources', resourceId));
      setResources(prev => prev.filter(r => r.id !== resourceId));
      showSaved('Saved');
    } catch (err: any) {
      console.error('Error deleting resource:', err);
      showError(err.message || 'Failed to delete resource.');
    }
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top Banner Alert (Green Saved or Red Error) */}
      {savedMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{savedMessage}</span>
          </div>
          <button onClick={() => setSavedMessage(null)} className="text-emerald-400 hover:text-white">&times;</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.2)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* VIEW A: COURSES LIST (WHEN NO COURSE IS CURRENTLY OPENED) */}
      {!currentManagingCourse ? (
        <div className="space-y-4">
          {/* Top Filter Controls Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Department Selector */}
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <span className="text-xs font-semibold text-[#9AA8C7] shrink-0">Department:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full lg:w-64 px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] font-medium focus:outline-none focus:border-[#2F52FF]"
                >
                  {SOT_DEPARTMENTS_LIST.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Level Selector */}
              <div className="flex items-center gap-1 bg-[#070D1A] p-1 rounded-lg border border-[#1E2E52] self-start sm:self-auto">
                {ACADEMIC_LEVELS.map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      selectedLevel === lvl
                        ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Semester Selector */}
              <div className="flex items-center gap-1 bg-[#070D1A] p-1 rounded-lg border border-[#1E2E52] self-start sm:self-auto">
                {SEMESTERS.map(sem => (
                  <button
                    key={sem}
                    onClick={() => setSelectedSemester(sem)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      selectedSemester === sem
                        ? 'bg-[#FFC700] text-[#0A1224] shadow-[0_0_10px_rgba(255,199,0,0.3)]'
                        : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                    }`}
                  >
                    {sem}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-row: Search and Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#1E2E52]/60">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search courses by code or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF]"
                />
                <Search className="w-3.5 h-3.5 text-[#9AA8C7] absolute left-2.5 top-2" />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-[#9AA8C7] mr-1">
                  <strong className="text-[#FFC700]">{filteredCourses.length}</strong> {filteredCourses.length === 1 ? 'course' : 'courses'}
                </span>

                <button
                  onClick={() => setShowBatchCourseModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-[#E6ECFA] hover:border-[#2F52FF] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Add Many at Once</span>
                </button>

                <button
                  onClick={handleOpenAddCourse}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.3)] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Course</span>
                </button>
              </div>
            </div>
          </div>

          {/* Compact Course List Table */}
          <div className="rounded-xl bg-[#0F1E36] border border-[#1E2E52] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070D1A] text-[#9AA8C7] uppercase font-bold tracking-wider border-b border-[#1E2E52]">
                  <tr>
                    <th className="py-2.5 px-3.5">Code</th>
                    <th className="py-2.5 px-3.5">Course Title</th>
                    <th className="py-2.5 px-3.5">Units</th>
                    <th className="py-2.5 px-3.5">Topics</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2E52]">
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#9AA8C7]">
                        <div className="space-y-2 max-w-sm mx-auto">
                          <BookOpen className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
                          <p className="text-sm font-semibold text-[#E6ECFA]">No courses in this semester yet</p>
                          <p className="text-xs text-[#9AA8C7]">
                            Tap "Add Course" or "Add Many at Once" above to populate courses for {selectedDept}.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map(course => {
                      const topicCount = topics.filter(t => t.courseId === course.id).length;
                      return (
                        <tr
                          key={course.id}
                          className="hover:bg-[#12224A]/40 transition-colors group cursor-pointer"
                          onClick={() => setManagingCourseId(course.id)}
                        >
                          <td className="py-3 px-3.5 font-bold text-[#FFC700] whitespace-nowrap">
                            {course.code}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-[#E6ECFA]">
                            <div className="flex items-center gap-2">
                              <span>{course.title}</span>
                              <span className="text-[10px] text-[#60A5FA] opacity-0 group-hover:opacity-100 transition-opacity">
                                (Tap to manage)
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-[#E6ECFA] whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[#070D1A] border border-[#1E2E52] font-semibold text-[11px]">
                              {course.units || 3} Units
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              topicCount > 0
                                ? 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40'
                                : 'bg-[#070D1A] text-[#9AA8C7] border border-[#1E2E52]'
                            }`}>
                              {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setManagingCourseId(course.id)}
                                className="px-2.5 py-1 rounded bg-[#2F52FF]/20 text-[#60A5FA] hover:bg-[#2F52FF] hover:text-white transition-all text-xs font-semibold cursor-pointer"
                                title="Manage topics and materials"
                              >
                                Manage
                              </button>
                              <button
                                onClick={() => handleOpenEditCourse(course)}
                                className="p-1 rounded text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#1E2E52] cursor-pointer"
                                title="Edit course details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCourse(course)}
                                className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                                title="Delete course and its topics"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW B: COURSE WORKSPACE (TOPICS, VIDEOS, NOTES, LINKS & COURSE-WIDE MATERIALS) */
        <div className="space-y-4">
          {/* Navigation Back Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setManagingCourseId(null)}
                className="p-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#E6ECFA] hover:text-[#FFC700] hover:border-[#FFC700] transition-colors cursor-pointer"
                title="Back to all courses"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-extrabold text-base text-[#FFC700]">
                    {currentManagingCourse.code}
                  </span>
                  <span className="text-[#9AA8C7]">•</span>
                  <span className="font-heading font-bold text-sm text-[#E6ECFA]">
                    {currentManagingCourse.title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/40 text-[10px] font-bold">
                    {currentManagingCourse.units || 3} Units
                  </span>
                </div>
                <p className="text-[11px] text-[#9AA8C7] mt-0.5">
                  {currentManagingCourse.department} • {currentManagingCourse.level} • {currentManagingCourse.semester}
                </p>
              </div>
            </div>

            {/* Course-level actions: Add Past Question & Add Course Material */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <button
                onClick={() => handleOpenAddResourceModal('Past Question', undefined, true)}
                className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] hover:border-[#FFC700] text-xs font-semibold text-[#FFC700] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileQuestion className="w-3.5 h-3.5 text-[#FFC700]" />
                <span>Add Past Question</span>
              </button>

              <button
                onClick={() => handleOpenAddResourceModal('Note', undefined, true)}
                className="px-3 py-1.5 rounded-lg bg-[#0A1224] border border-[#24315A] hover:border-[#2F52FF] text-xs font-semibold text-[#60A5FA] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Add Course Material</span>
              </button>
            </div>
          </div>

          {/* Section: Course-Wide Items (Past Questions & Materials not tied to a specific topic) */}
          {courseWideResources.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#1E2E52] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#E6ECFA] uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>General Course Materials &amp; Past Questions ({courseWideResources.length})</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {courseWideResources.map(r => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        r.type === 'Past Question'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-[#2F52FF]/20 text-[#60A5FA] border border-[#2F52FF]/30'
                      }`}>
                        {r.type || 'Material'}
                      </span>
                      <span className="text-xs font-medium text-[#E6ECFA] truncate" title={r.title}>
                        {r.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-[#60A5FA] hover:text-white hover:bg-[#1E2E52]"
                        title="Open file or link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteResource(r.id, r.title)}
                        className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Topics Management */}
          <div className="p-4 rounded-xl bg-[#0F1E36] border border-[#1E2E52] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2E52]">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA] flex items-center gap-2">
                  <span>Syllabus Topics</span>
                  <span className="px-2 py-0.2 rounded-full bg-[#2F52FF]/20 text-[#60A5FA] text-xs font-bold">
                    {currentTopics.length}
                  </span>
                </h3>
                <p className="text-xs text-[#9AA8C7]">
                  Add structured topics, upload video tutorials, attach PDF lecture notes, and link reference websites.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setShowBatchTopicModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[#E6ECFA] hover:border-[#2F52FF] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-[#FFC700]" />
                  <span>Add Many at Once</span>
                </button>

                <button
                  onClick={handleOpenAddTopic}
                  className="px-3 py-1.5 rounded-lg bg-[#2F52FF] text-white text-xs font-bold hover:bg-[#2545df] flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.3)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Topic</span>
                </button>
              </div>
            </div>

            {/* List of Topics */}
            {currentTopics.length === 0 ? (
              <div className="py-10 text-center text-[#9AA8C7] space-y-2">
                <Layers className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
                <p className="text-sm font-semibold text-[#E6ECFA]">No topics added to this course yet</p>
                <p className="text-xs text-[#9AA8C7] max-w-sm mx-auto">
                  Add topics individually or paste your syllabus topics all at once using "Add Many at Once".
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentTopics.map((topic, index) => {
                  const topicItems = getTopicResources(topic.id);
                  const isFirst = index === 0;
                  const isLast = index === currentTopics.length - 1;

                  return (
                    <div
                      key={topic.id}
                      className="p-3.5 rounded-xl bg-[#0A1224] border border-[#1E2E52] space-y-3 hover:border-[#24315A] transition-all"
                    >
                      {/* Topic Header with Reorder, Edit Lesson, Edit Title & Delete */}
                      <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                          {/* Order index pill */}
                          <span className="w-6 h-6 rounded-md bg-[#121C36] border border-[#24315A] text-[#FFC700] font-bold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <h4
                            onClick={() => handleOpenLessonEditor(topic)}
                            className="font-heading font-bold text-sm text-[#E6ECFA] hover:text-[#FFC700] cursor-pointer break-words transition-colors"
                            title="Click to edit lesson content"
                          >
                            {topic.title}
                          </h4>

                          {/* Chips: Estimated read time, video indicator, notes indicator, quiz linked */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-[#121C36] border border-[#24315A] text-[10px] font-semibold text-[#9AA8C7] flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-[#FFC700]" />
                              <span>{topic.estimatedMinutes || 15}m</span>
                            </span>

                            {topic.videoUrl && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                                <Video className="w-2.5 h-2.5" />
                                <span>Video</span>
                              </span>
                            )}

                            {topic.notes && (
                              <span className="px-1.5 py-0.5 rounded bg-[#2F52FF]/20 border border-[#2F52FF]/40 text-[#60A5FA] text-[10px] font-bold flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" />
                                <span>Notes</span>
                              </span>
                            )}

                            {topic.linkedQuizId && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                <FileQuestion className="w-2.5 h-2.5" />
                                <span>Quiz</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Controls: Edit Lesson button, Add Quiz button, Reorder buttons, Edit Title, Delete */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <button
                            onClick={() => handleOpenLessonEditor(topic)}
                            className="px-2.5 py-1 rounded-lg bg-[#2F52FF] hover:bg-[#4364FF] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(47,82,255,0.3)]"
                            title="Open full lesson editor"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Edit Lesson</span>
                          </button>

                          {onAddQuizForTopic && currentManagingCourse && (
                            <button
                              onClick={() => onAddQuizForTopic(topic, currentManagingCourse)}
                              className="px-2 py-1 rounded-lg bg-[#FFC700]/15 hover:bg-[#FFC700] text-[#FFC700] hover:text-[#0A1224] border border-[#FFC700]/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Add quiz for this topic"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Quiz</span>
                            </button>
                          )}

                          <button
                            disabled={isFirst}
                            onClick={() => handleMoveTopic(topic, 'up')}
                            className="p-1 rounded bg-[#0F1E36] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#E6ECFA] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Move topic up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={isLast}
                            onClick={() => handleMoveTopic(topic, 'down')}
                            className="p-1 rounded bg-[#0F1E36] border border-[#1E2E52] text-[#9AA8C7] hover:text-[#E6ECFA] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Move topic down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditTopic(topic)}
                            className="p-1 rounded text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#1E2E52] cursor-pointer"
                            title="Edit topic title only"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTopic(topic)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                            title="Delete topic"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Topic Action Buttons: Add Video, Add Note (PDF), Add Link */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#1E2E52]/60 flex-wrap">
                        <button
                          onClick={() => handleOpenAddResourceModal('Video', topic.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] hover:border-[#2F52FF] text-[#E6ECFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Video className="w-3 h-3 text-rose-400" />
                          <span>Add Video</span>
                        </button>

                        <button
                          onClick={() => handleOpenAddResourceModal('Note', topic.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] hover:border-[#FFC700] text-[#E6ECFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-[#FFC700]" />
                          <span>Add Note (PDF link)</span>
                        </button>

                        <button
                          onClick={() => handleOpenAddResourceModal('Other', topic.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] hover:border-emerald-400 text-[#E6ECFA] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3 h-3 text-emerald-400" />
                          <span>Add Link</span>
                        </button>
                      </div>

                      {/* Topic Resources List */}
                      {topicItems.length > 0 && (
                        <div className="space-y-2 pt-2">
                          {topicItems.map(item => {
                            const ytEmbed = item.type === 'Video' ? getYouTubeEmbedUrl(item.url) : null;

                            return (
                              <div
                                key={item.id}
                                className="p-2.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {item.type === 'Video' ? (
                                    <div className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                                      <Video className="w-3.5 h-3.5" />
                                    </div>
                                  ) : item.type === 'Note' ? (
                                    <div className="w-6 h-6 rounded bg-[#FFC700]/20 text-[#FFC700] flex items-center justify-center shrink-0">
                                      <FileText className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                      <Link2 className="w-3.5 h-3.5" />
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#E6ECFA] truncate">
                                      {item.title}
                                    </p>
                                    <p className="text-[10px] text-[#9AA8C7] truncate">
                                      {item.url}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  {ytEmbed && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
                                      YouTube Embedded
                                    </span>
                                  )}
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 rounded bg-[#2F52FF] text-white text-[11px] font-semibold hover:bg-[#2545df] flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => handleDeleteResource(item.id, item.title)}
                                    className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                                    title="Delete item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 1: ADD / EDIT SINGLE COURSE                        */}
      {/* --------------------------------------------------------- */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0F1E36] border border-[#1E2E52] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2E52]">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                {editingCourse ? 'Edit Course' : `Add Course to ${selectedDept}`}
              </h3>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Department, Level &amp; Semester (Locked to current view)
                </label>
                <div className="p-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA]">
                  {selectedDept} • {selectedLevel} • {selectedSemester}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Course Code * (e.g. COM 111)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COM 111"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Course Title * (e.g. Introduction to Computing)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Computer Science"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Credit Units (1 to 6) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  step={1}
                  required
                  value={courseUnits}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setCourseUnits('');
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        setCourseUnits(Math.min(6, Math.max(1, num)));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
                <p className="text-[10px] text-[#9AA8C7] mt-1">
                  Enter a whole number from 1 to 6. Saved exactly as entered.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Course Accent Color (Default: Teal)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ACCENT_COLOR_OPTIONS.map(color => {
                    const previewTheme = getCourseAccent(color);
                    const isSelected = courseAccentColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCourseAccentColor(color)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? `${previewTheme.badgeBg} ${previewTheme.badgeBorder} shadow-sm ring-1 ring-[#FACC15]`
                            : 'bg-[#070D1A] border-[#1E2E52] hover:border-[#24315A]'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: previewTheme.stroke }}
                        />
                        <span className={`text-[10px] font-bold ${isSelected ? previewTheme.accentText : 'text-[#9AA8C7]'}`}>
                          {color}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Cover Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/course-cover.jpg (or leave empty for accent gradient)"
                  value={courseCoverImageUrl}
                  onChange={(e) => setCourseCoverImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
                <p className="text-[10px] text-[#9AA8C7] mt-1">
                  Leave blank to use the accent-colour gradient cover with course code and icon.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  About this course (Overview)
                </label>
                <textarea
                  rows={3}
                  placeholder="A clear overview describing the learning goals, prerequisites and scope of this course..."
                  value={courseAbout}
                  onChange={(e) => setCourseAbout(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingCourse ? 'Saving...' : editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 2: ADD MULTIPLE COURSES AT ONCE                     */}
      {/* --------------------------------------------------------- */}
      {showBatchCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1E36] border border-[#1E2E52] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2E52]">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                  Add Multiple Courses at Once
                </h3>
                <p className="text-xs text-[#9AA8C7]">
                  {selectedDept} • {selectedLevel} • {selectedSemester}
                </p>
              </div>
              <button
                onClick={() => setShowBatchCourseModal(false)}
                className="text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchAddCourses} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Format: Course Code | Title | Units (one per line)
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder={`COM 111 | Introduction to Computer | 3\nCOM 112 | Digital Electronics | 3\nCOM 113 | Introduction to Programming | 4`}
                  value={batchCoursesText}
                  onChange={(e) => setBatchCoursesText(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] font-mono focus:outline-none focus:border-[#2F52FF]"
                />
                <p className="text-[10px] text-[#9AA8C7] mt-1">
                  Tip: Separate code, title, and units using a pipe "|" symbol.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setShowBatchCourseModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse || !batchCoursesText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingCourse ? 'Importing...' : 'Save All Courses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 3: ADD / EDIT SINGLE TOPIC                          */}
      {/* --------------------------------------------------------- */}
      {showAddTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0F1E36] border border-[#1E2E52] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2E52]">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                {editingTopic ? 'Edit Topic Title' : `Add Topic to ${currentManagingCourse?.code}`}
              </h3>
              <button
                onClick={() => setShowAddTopicModal(false)}
                className="text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Topic Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Binary Logic & Truth Tables"
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {!editingTopic && (
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <input
                    type="checkbox"
                    id="notifyTopicStudentsCheck"
                    checked={notifyTopicStudents}
                    onChange={(e) => setNotifyTopicStudents(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#070D1A] border border-[#1E2E52] text-[#2F52FF] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="notifyTopicStudentsCheck" className="text-xs font-semibold text-[#E6ECFA] cursor-pointer select-none">
                    Notify students (Phone push notification)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setShowAddTopicModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTopic}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingTopic ? 'Saving...' : editingTopic ? 'Save Changes' : 'Add Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 4: ADD MULTIPLE TOPICS AT ONCE                      */}
      {/* --------------------------------------------------------- */}
      {showBatchTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0F1E36] border border-[#1E2E52] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2E52]">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                  Add Multiple Topics at Once
                </h3>
                <p className="text-xs text-[#9AA8C7]">
                  {currentManagingCourse?.code}: {currentManagingCourse?.title}
                </p>
              </div>
              <button
                onClick={() => setShowBatchTopicModal(false)}
                className="text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchAddTopics} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Enter topic titles (one per line)
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder={`Overview of Operating Systems\nProcess Management & Scheduling\nMemory Management & Paging\nFile Systems and I/O Protection`}
                  value={batchTopicsText}
                  onChange={(e) => setBatchTopicsText(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] font-sans focus:outline-none focus:border-[#2F52FF]"
                />
                <p className="text-[10px] text-[#9AA8C7] mt-1">
                  Each line will be added in order to this course's syllabus.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="notifyBatchTopicStudentsCheck"
                  checked={notifyTopicStudents}
                  onChange={(e) => setNotifyTopicStudents(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#070D1A] border border-[#1E2E52] text-[#2F52FF] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="notifyBatchTopicStudentsCheck" className="text-xs font-semibold text-[#E6ECFA] cursor-pointer select-none">
                  Notify students (Phone push notification)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setShowBatchTopicModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTopic || !batchTopicsText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingTopic ? 'Saving...' : 'Add All Topics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 5: ADD / EDIT RESOURCE (VIDEO, NOTE, LINK, PQ)       */}
      {/* --------------------------------------------------------- */}
      {resourceModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D1A]/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0F1E36] border border-[#1E2E52] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2E52]">
              <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                {resourceModalConfig.type === 'Video'
                  ? 'Add Video Tutorial'
                  : resourceModalConfig.type === 'Note'
                  ? 'Add Note (PDF Link)'
                  : resourceModalConfig.type === 'Past Question'
                  ? 'Add Past Question'
                  : 'Add Reference Link'}
              </h3>
              <button
                onClick={() => setResourceModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResourceItem} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    resourceModalConfig.type === 'Video'
                      ? 'e.g. Chapter 1 Crash Course: Logic Gates & Truth Tables'
                      : resourceModalConfig.type === 'Past Question'
                      ? 'e.g. 2023/2024 First Semester Examination Paper'
                      : 'e.g. Official Lecture Handout Slides (PDF)'
                  }
                  value={resourceModalConfig.title}
                  onChange={(e) => setResourceModalConfig(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                  File or Link URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder={
                    resourceModalConfig.type === 'Video'
                      ? 'https://youtube.com/watch?v=... or YouTube link'
                      : 'https://drive.google.com/file/d/... or document URL'
                  }
                  value={resourceModalConfig.url}
                  onChange={(e) => setResourceModalConfig(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                />
                <p className="text-[10px] text-[#9AA8C7] mt-1">
                  {resourceModalConfig.type === 'Video'
                    ? 'YouTube video links automatically display with an embedded video player.'
                    : 'Google Drive links automatically convert to interactive preview embeds.'}
                </p>
              </div>

              {!resourceModalConfig.editingId && (
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <input
                    type="checkbox"
                    id="notifyResourceStudentsCheck"
                    checked={notifyResourceStudents}
                    onChange={(e) => setNotifyResourceStudents(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#070D1A] border border-[#1E2E52] text-[#2F52FF] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="notifyResourceStudentsCheck" className="text-xs font-semibold text-[#E6ECFA] cursor-pointer select-none">
                    Notify students (Phone push notification)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setResourceModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className="px-3 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResource}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingResource ? 'Saving...' : 'Save Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 6: ADMIN LESSON EDITOR (TOPIC LEARNING EXPERIENCE)   */}
      {/* --------------------------------------------------------- */}
      {showLessonModal && editingLessonTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070D1A]/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-[#0F1E36] border border-[#1E2E52] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 border-b border-[#1E2E52] flex items-center justify-between bg-[#070D1A]/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#E6ECFA]">
                    Lesson Editor: {currentManagingCourse?.code}
                  </h3>
                  <p className="text-[10px] text-[#9AA8C7]">
                    Edit syllabus notes, video embed, summary, reading links, and linked quiz
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setEditingLessonTopic(null);
                }}
                className="p-1.5 rounded-lg bg-[#121C36] text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveLesson} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Feedback banners */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {savedMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{savedMessage}</span>
                </div>
              )}

              {/* Title & Timing Row */}
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Topic Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={lessonTitle}
                      onChange={e => setLessonTitle(e.target.value)}
                      placeholder="e.g. Overview of Operating Systems"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Level
                    </label>
                    <select
                      value={lessonLevelTag}
                      onChange={e => setLessonLevelTag(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs font-semibold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Est. Minutes
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={lessonEstimatedMinutes}
                        onChange={e => setLessonEstimatedMinutes(e.target.value)}
                        placeholder="15"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-center font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
                      />
                      <span className="text-xs text-[#9AA8C7]">mins</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={lessonOrder}
                      onChange={e => setLessonOrder(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-center font-bold text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                    />
                  </div>
                </div>

                {/* What you'll learn */}
                <div className="pt-2 border-t border-[#1E2E52]">
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    What You'll Learn (Enter one key takeaway / outcome per line)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={`Understand the difference between processes and threads\nLearn how CPU scheduling algorithms prioritize tasks\nAnalyze race conditions and synchronization primitives`}
                    value={lessonWhatYoullLearnText}
                    onChange={e => setLessonWhatYoullLearnText(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                  <p className="text-[10px] text-[#9AA8C7] mt-1">
                    Displayed at the top of the lesson as a helpful learning roadmap.
                  </p>
                </div>

                {/* Before you begin */}
                <div className="pt-2 border-t border-[#1E2E52]">
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1">
                    Before You Begin (Prerequisites or setup notes, optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Ensure you have reviewed Chapter 1 on binary representations, or have a notepad ready for algorithm traces."
                    value={lessonBeforeYouBegin}
                    onChange={e => setLessonBeforeYouBegin(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                </div>

                {/* Video URL with Live Preview */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-rose-400" />
                      <span>Video Tutorial Link (YouTube link or video URL)</span>
                    </span>
                    {lessonVideoUrl && getYouTubeEmbedUrl(lessonVideoUrl) && (
                      <span className="text-[10px] text-emerald-400 font-bold">YouTube Embed Detected</span>
                    )}
                  </label>
                  <input
                    type="url"
                    value={lessonVideoUrl}
                    onChange={e => setLessonVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />

                  {lessonVideoUrl && getYouTubeEmbedUrl(lessonVideoUrl) && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-[#24315A] aspect-video max-h-52 bg-black">
                      <iframe
                        src={getYouTubeEmbedUrl(lessonVideoUrl)!}
                        title="Video Preview"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>

                {/* Optional Notes PDF Document Link */}
                <div className="pt-2 border-t border-[#1E2E52]">
                  <label className="block text-[11px] font-semibold text-[#9AA8C7] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-teal-400" />
                      <span>Topic Notes PDF (Optional Google Drive link or PDF URL)</span>
                    </span>
                    {lessonNotesPdfUrl && (
                      <span className="text-[10px] text-teal-400 font-semibold">PDF Document Linked</span>
                    )}
                  </label>
                  <input
                    type="url"
                    value={lessonNotesPdfUrl}
                    onChange={e => setLessonNotesPdfUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/... or PDF handout URL"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                  />
                  <p className="text-[10px] text-[#9AA8C7] mt-1">
                    When provided, students see an in-app PDF viewer with Zoom, Open and Download buttons alongside or instead of typed notes.
                  </p>
                </div>
              </div>

              {/* Lesson Notes with Formatting Toolbar (Heading, Bold, Bullet list, Numbered list, Callout) and Live Preview */}
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold text-[#FFC700] tracking-wider block">
                    Lesson Notes (Formatted Markdown with Callouts &amp; Tables)
                  </span>

                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => insertFormatting('## Section Heading')}
                      className="px-2 py-0.5 rounded bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] text-[10px] text-[#E6ECFA] font-bold cursor-pointer"
                      title="Add Heading"
                    >
                      Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('**bold text**')}
                      className="px-2 py-0.5 rounded bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] text-[10px] text-[#E6ECFA] font-bold cursor-pointer"
                      title="Add Bold text"
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('• Key takeaway point')}
                      className="px-2 py-0.5 rounded bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] text-[10px] text-[#E6ECFA] font-bold cursor-pointer"
                      title="Add Bullet point"
                    >
                      Bullet List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('1. First sequential step\n2. Second sequential step')}
                      className="px-2 py-0.5 rounded bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] text-[10px] text-[#E6ECFA] font-bold cursor-pointer"
                      title="Add Numbered list"
                    >
                      Numbered List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('> Tip: Remember to review this principle before practicals.')}
                      className="px-2 py-0.5 rounded bg-[#0F1E36] hover:bg-[#1A2E63] border border-teal-500/40 text-[10px] text-teal-300 font-bold cursor-pointer"
                      title="Add Callout (> Tip: / > Note: / > Remember:)"
                    >
                      Callout
                    </button>

                    <div className="h-4 w-[1px] bg-[#24315A] mx-1" />

                    {/* Preview Toggle */}
                    <div className="flex items-center p-0.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52]">
                      <button
                        type="button"
                        onClick={() => setLessonLivePreview(false)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          !lessonLivePreview
                            ? 'bg-[#2F52FF] text-white shadow-sm'
                            : 'text-[#9AA8C7] hover:text-white'
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setLessonLivePreview(true)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                          lessonLivePreview
                            ? 'bg-[#2F52FF] text-white shadow-sm'
                            : 'text-[#9AA8C7] hover:text-white'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>
                </div>

                {!lessonLivePreview ? (
                  <textarea
                    rows={11}
                    value={lessonNotes}
                    onChange={e => setLessonNotes(e.target.value)}
                    placeholder={`## 1. Overview of System Architecture\nThis topic covers foundational computer architecture principles...\n\n> Tip: Make sure to understand the distinction between CPU registers and primary memory.\n\n## Core Components\n• Arithmetic Logic Unit (ALU)\n• Control Unit (CU)\n• System Buses\n\n> Note: Memory access latency is significantly higher than cache hits.\n\n1. Fetch instruction from memory\n2. Decode instruction\n3. Execute operation`}
                    className="w-full p-3.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52] font-mono text-xs text-[#E6ECFA] leading-relaxed placeholder-[#9AA8C7]/40 focus:outline-none focus:border-[#2F52FF]"
                  />
                ) : (
                  <div className="p-5 rounded-xl bg-[#111A2E] border border-[#1E2E52] min-h-[220px] max-h-80 overflow-y-auto">
                    <FormattedLessonNotes
                      notes={lessonNotes || ''}
                      theme={getCourseAccent(currentManagingCourse?.accentColor)}
                      fontSize={16}
                    />
                  </div>
                )}
              </div>

              {/* Highlighted Summary Box */}
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#FFC700] uppercase tracking-wider">
                  Highlighted Summary (Revision Takeaway Box)
                </label>
                <textarea
                  rows={3}
                  value={lessonSummary}
                  onChange={e => setLessonSummary(e.target.value)}
                  placeholder="Key summary points students should remember before taking exams or quizzes..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
                />
              </div>

              {/* Further Reading Links */}
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#60A5FA] tracking-wider block">
                    Further Reading (References &amp; Recommended Links)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddFurtherReadingLink}
                    className="px-2 py-0.5 rounded bg-[#0F1E36] hover:bg-[#1A2E63] border border-[#1E2E52] text-[10px] text-[#60A5FA] hover:text-white font-bold cursor-pointer"
                  >
                    + Add Link
                  </button>
                </div>

                {lessonFurtherReading.length === 0 ? (
                  <p className="text-[11px] text-[#9AA8C7] italic">No reference links added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {lessonFurtherReading.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.title}
                          onChange={e => handleUpdateFurtherReadingLink(idx, 'title', e.target.value)}
                          placeholder="Link Title (e.g. GeeksforGeeks OS Architecture)"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                        />
                        <input
                          type="url"
                          value={item.url}
                          onChange={e => handleUpdateFurtherReadingLink(idx, 'url', e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFurtherReadingLink(idx)}
                          className="p-1.5 rounded-lg bg-[#0F1E36] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                          title="Remove link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Quiz Selector & Requirement */}
              <div className="p-3.5 rounded-xl bg-[#070D1A] border border-[#1E2E52] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-[11px] font-semibold text-[#E6ECFA] flex items-center gap-1.5">
                    <FileQuestion className="w-3.5 h-3.5 text-[#FFC700]" />
                    <span>Linked Quiz (Taken directly inside this topic)</span>
                  </label>

                  {/* Add quiz for this topic button */}
                  {onAddQuizForTopic && currentManagingCourse && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowLessonModal(false);
                        onAddQuizForTopic(editingLessonTopic, currentManagingCourse);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFC700] hover:bg-[#ffd233] text-[#0A1224] text-xs font-bold transition-all cursor-pointer shadow-sm self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add quiz for this topic</span>
                    </button>
                  )}
                </div>

                <select
                  value={lessonLinkedQuizId}
                  onChange={e => setLessonLinkedQuizId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1E36] border border-[#1E2E52] text-xs font-bold text-[#FFC700] focus:outline-none focus:border-[#2F52FF]"
                >
                  <option value="">No linked quiz</option>
                  {availableQuizzes
                    .filter(
                      q =>
                        !currentManagingCourse ||
                        !q.courseCode ||
                        q.courseCode === currentManagingCourse.code ||
                        q.department === currentManagingCourse.department
                    )
                    .map(quiz => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.courseCode}: {quiz.title} ({quiz.questionCount || quiz.questions?.length || 0} questions)
                      </option>
                    ))}
                </select>

                {/* Require passing the quiz to complete this topic setting */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0F1E36] border border-[#1E2E52]">
                  <input
                    type="checkbox"
                    id="requireQuizToCompleteCheck"
                    checked={lessonRequireQuizToComplete}
                    onChange={e => setLessonRequireQuizToComplete(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2F52FF] bg-[#070D1A] border-[#1E2E52] cursor-pointer"
                  />
                  <label htmlFor="requireQuizToCompleteCheck" className="text-xs text-[#E6ECFA] font-medium cursor-pointer">
                    Require passing the quiz to complete this topic <span className="text-[#9AA8C7] text-[11px] block sm:inline">(Off by default. When on, students must pass to complete this topic)</span>
                  </label>
                </div>
              </div>

              {/* Notification toggle */}
              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="notifyLessonStudentsCheck"
                  checked={lessonNotify}
                  onChange={e => setLessonNotify(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#070D1A] border border-[#1E2E52] text-[#2F52FF] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="notifyLessonStudentsCheck" className="text-xs font-semibold text-[#E6ECFA] cursor-pointer select-none">
                  Notify students (Phone push notification to {currentManagingCourse?.department} {currentManagingCourse?.level})
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => {
                    setShowLessonModal(false);
                    setEditingLessonTopic(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingLesson ? 'Saving...' : 'Save Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

