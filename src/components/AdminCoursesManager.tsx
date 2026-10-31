import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CourseItem, TopicItem, ResourceItem, ResourceType } from '../types';
import { SOT_DEPARTMENTS_LIST } from '../data/departments';
import {
  normalizeCourseLevel,
  normalizeCourseSemester,
  formatPdfUrl,
  getYouTubeEmbedUrl
} from '../data/coursesAndTimetables';
import { dispatchPushNotification, getDepartmentTopicSlug } from '../lib/pushNotifications';
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
  RefreshCw
} from 'lucide-react';

const ACADEMIC_LEVELS: Array<'ND1' | 'ND2' | 'HND1' | 'HND2'> = ['ND1', 'ND2', 'HND1', 'HND2'];
const SEMESTERS: Array<'First Semester' | 'Second Semester'> = ['First Semester', 'Second Semester'];

interface AdminCoursesManagerProps {
  onNotify?: (msg: string) => void;
}

export const AdminCoursesManager: React.FC<AdminCoursesManagerProps> = () => {
  // Filters
  const [selectedDept, setSelectedDept] = useState<string>(SOT_DEPARTMENTS_LIST[0]);
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
  const [courseUnits, setCourseUnits] = useState(3);
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

  // Fetch all courses, topics, and resources
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
    setShowAddCourseModal(true);
  };

  const handleOpenEditCourse = (course: CourseItem) => {
    setEditingCourse(course);
    setCourseCode(course.code);
    setCourseTitle(course.title);
    setCourseUnits(course.units || 3);
    setShowAddCourseModal(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) {
      showError('Course code and course title are required.');
      return;
    }

    setSavingCourse(true);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        department: selectedDept,
        level: selectedLevel,
        semester: selectedSemester,
        code: courseCode.trim().toUpperCase(),
        title: courseTitle.trim(),
        units: Number(courseUnits) || 3,
        updatedAt: nowIso
      };

      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), payload);
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...payload } : c));
        showSaved('Saved');
      } else {
        const ref = await addDoc(collection(db, 'courses'), {
          ...payload,
          createdAt: nowIso
        });
        const newCourse: CourseItem = {
          id: ref.id,
          ...payload,
          createdAt: nowIso,
          type: 'Core'
        };
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
        const units = parts[2] ? parseInt(parts[2], 10) || 3 : 3;

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
          const ref = await addDoc(collection(db, 'courses'), payload);
          addedCourses.push({ id: ref.id, ...payload });
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
        await updateDoc(doc(db, 'topics', editingTopic.id), {
          title: topicTitle.trim(),
          updatedAt: nowIso
        });
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
        const ref = await addDoc(collection(db, 'topics'), payload);
        const newTopic: TopicItem = { id: ref.id, ...payload };
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
        const ref = await addDoc(collection(db, 'topics'), payload);
        newTopicsList.push({ id: ref.id, ...payload });
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
      await updateDoc(doc(db, 'topics', topic.id), { order: targetOrder });
      await updateDoc(doc(db, 'topics', targetTopic.id), { order: currentOrder });

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
        topicId: resourceModalConfig.topicId || undefined,
        type: resourceModalConfig.type,
        title: resourceModalConfig.title.trim(),
        url: formattedUrl,
        department: currentManagingCourse.department,
        level: currentManagingCourse.level,
        semester: currentManagingCourse.semester,
        uploadedBy: auth.currentUser?.uid || 'admin',
        uploadedByEmail: auth.currentUser?.email || undefined,
        uploadedByRole: 'admin',
        createdAt: nowIso
      };

      if (resourceModalConfig.editingId) {
        await updateDoc(doc(db, 'resources', resourceModalConfig.editingId), {
          title: payload.title,
          url: payload.url,
          type: payload.type,
          updatedAt: nowIso
        });
        setResources(prev => prev.map(r => r.id === resourceModalConfig.editingId ? { ...r, ...payload, id: r.id } : r));
      } else {
        const ref = await addDoc(collection(db, 'resources'), payload);
        const newResource: ResourceItem = {
          id: ref.id,
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
                      {/* Topic Header with Reorder, Edit & Delete */}
                      <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Order index pill */}
                          <span className="w-6 h-6 rounded-md bg-[#121C36] border border-[#24315A] text-[#FFC700] font-bold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <h4 className="font-heading font-bold text-sm text-[#E6ECFA] break-words">
                            {topic.title}
                          </h4>
                        </div>

                        {/* Controls: Reorder buttons, Edit, Delete */}
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
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
                            className="p-1 rounded text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#1E2E52] cursor-pointer ml-1"
                            title="Edit topic title"
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
                  Credit Units (e.g. 2, 3, 4)
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={courseUnits}
                  onChange={(e) => setCourseUnits(parseInt(e.target.value, 10) || 3)}
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

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2E52]">
                <button
                  type="button"
                  onClick={() => setResourceModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1E2E52] text-xs text-[#9AA8C7] hover:text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResource}
                  className="px-4 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.4)] disabled:opacity-50"
                >
                  {savingResource ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
