'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { Quiz, QuizQuestion, ImportedQuestion } from '@/lib/types';
import { getQuiz, updateQuiz, uploadDiagramImage, uploadDiagramBlob, generateQuestionId } from '@/lib/utils';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function QuizEditorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.quizId;

  // Quiz State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Panels
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isDiagramReviewOpen, setIsDiagramReviewOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // PDF Import State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [pdfImportProgress, setPdfImportProgress] = useState<string>('');
  const [importedQuestions, setImportedQuestions] = useState<ImportedQuestion[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [selectedImportIndices, setSelectedImportIndices] = useState<number[]>([]);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);

  // Initialize API Key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setGeminiApiKey(saved);
  }, []);

  // Diagram Cropper State
  const [diagramQueue, setDiagramQueue] = useState<{ qId: string; pageNumber: number; questionText: string }[]>([]);
  const [currentDiagramIdx, setCurrentDiagramIdx] = useState<number>(0);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Crop Coordinates
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Bulk JSON Import
  const [jsonInput, setJsonInput] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load Quiz Data
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getQuiz(quizId);
        if (data) {
          setQuiz(data);
          if (data.questions.length > 0) {
            setActiveQuestionId(data.questions[0].id);
          }
        } else {
          showToast('Quiz not found');
        }
      } catch (err) {
        console.error(err);
        showToast('Error loading quiz');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [quizId]);

  // Save Quiz
  const handleSave = async () => {
    if (!quiz) return;
    try {
      setSaving(true);
      await updateQuiz(quiz.id, {
        title: quiz.title,
        description: quiz.description,
        durationMinutes: quiz.durationMinutes,
        questions: quiz.questions,
        isAcceptingResponses: quiz.isAcceptingResponses,
        showResultsImmediately: quiz.showResultsImmediately,
        allowSingleAttempt: quiz.allowSingleAttempt,
        divisions: quiz.divisions || ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F'],
      });
      setSaveSuccess(true);
      showToast('✓ All changes saved');
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Save quiz error:', err);
      const msg = err.code ? `[${err.code}] ${err.message}` : (err.message || 'Error saving quiz');
      showToast(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!quiz) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const studentUrl = `${origin}/quiz/${quiz.id}`;
    navigator.clipboard.writeText(studentUrl);
    showToast('✓ Student quiz link copied to clipboard!');
  };

  // Division Configuration Helpers
  const [newDivisionInput, setNewDivisionInput] = useState('');

  const handleAddDivision = () => {
    if (!quiz || !newDivisionInput.trim()) return;
    const current = quiz.divisions || ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F'];
    const val = newDivisionInput.trim();
    if (!current.includes(val)) {
      setQuiz({ ...quiz, divisions: [...current, val] });
    }
    setNewDivisionInput('');
  };

  const removeDivision = (indexToRemove: number) => {
    if (!quiz) return;
    const current = quiz.divisions || ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F'];
    const updated = current.filter((_, idx) => idx !== indexToRemove);
    setQuiz({ ...quiz, divisions: updated });
  };

  const applyDivisionPreset = (preset: string) => {
    if (!quiz) return;
    let list: string[] = [];
    if (preset === '6th (A-F)') list = ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F'];
    else if (preset === '7th (A-F)') list = ['7th A', '7th B', '7th C', '7th D', '7th E', '7th F'];
    else if (preset === '8th (A-F)') list = ['8th A', '8th B', '8th C', '8th D', '8th E', '8th F'];
    else if (preset === '9th (A-F)') list = ['9th A', '9th B', '9th C', '9th D', '9th E', '9th F'];
    else if (preset === '10th (A-F)') list = ['10th A', '10th B', '10th C', '10th D', '10th E', '10th F'];
    else if (preset === 'A to D') list = ['Section A', 'Section B', 'Section C', 'Section D'];
    setQuiz({ ...quiz, divisions: list });
    showToast(`✓ Applied ${preset} divisions`);
  };

  // Question Management
  const addQuestion = (afterId?: string) => {
    if (!quiz) return;
    const newQ: QuizQuestion = {
      id: generateQuestionId(),
      num: quiz.questions.length + 1,
      question: '',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      answer: 1,
      points: 1,
      explanation: '',
    };

    let nextQuestions = [...quiz.questions];
    if (afterId) {
      const idx = nextQuestions.findIndex((q) => q.id === afterId);
      nextQuestions.splice(idx + 1, 0, newQ);
    } else {
      nextQuestions.push(newQ);
    }
    nextQuestions = nextQuestions.map((q, i) => ({ ...q, num: i + 1 }));
    setQuiz({ ...quiz, questions: nextQuestions });
    setActiveQuestionId(newQ.id);
  };

  const updateQuestion = (id: string, patch: Partial<QuizQuestion>) => {
    if (!quiz) return;
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    });
  };

  const duplicateQuestion = (id: string) => {
    if (!quiz) return;
    const target = quiz.questions.find((q) => q.id === id);
    if (!target) return;
    const clone: QuizQuestion = {
      ...target,
      id: generateQuestionId(),
      question: `${target.question} (Copy)`,
    };
    const idx = quiz.questions.findIndex((q) => q.id === id);
    const nextQuestions = [...quiz.questions];
    nextQuestions.splice(idx + 1, 0, clone);
    setQuiz({
      ...quiz,
      questions: nextQuestions.map((q, i) => ({ ...q, num: i + 1 })),
    });
    setActiveQuestionId(clone.id);
  };

  const deleteQuestion = (id: string) => {
    if (!quiz || quiz.questions.length <= 1) {
      showToast('A quiz must have at least one question');
      return;
    }
    const nextQuestions = quiz.questions.filter((q) => q.id !== id).map((q, i) => ({ ...q, num: i + 1 }));
    setQuiz({ ...quiz, questions: nextQuestions });
    if (activeQuestionId === id) {
      setActiveQuestionId(nextQuestions[0]?.id || null);
    }
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (!quiz) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= quiz.questions.length) return;
    const nextQuestions = [...quiz.questions];
    const [moved] = nextQuestions.splice(idx, 1);
    nextQuestions.splice(targetIdx, 0, moved);
    setQuiz({
      ...quiz,
      questions: nextQuestions.map((q, i) => ({ ...q, num: i + 1 })),
    });
  };

  // Diagram Image File Upload for Question Card
  const [uploadingDiagramQId, setUploadingDiagramQId] = useState<string | null>(null);
  const [urlInputQId, setUrlInputQId] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState<string>('');

  const handleImageUpload = async (qId: string, file: File) => {
    try {
      setUploadingDiagramQId(qId);
      showToast('Attaching diagram...');
      const url = await uploadDiagramImage(file, quizId, qId);
      updateQuestion(qId, { diagramUrl: url, hasDiagram: true });
      showToast('✓ Diagram attached successfully');
    } catch (err: any) {
      console.error('Image upload error:', err);
      showToast(`Failed to upload image: ${err?.message || 'Check image file'}`);
    } finally {
      setUploadingDiagramQId(null);
    }
  };

  const handleAttachImageUrl = (qId: string) => {
    const trimmed = urlInputValue.trim();
    if (!trimmed) return;
    updateQuestion(qId, { diagramUrl: trimmed, hasDiagram: true });
    setUrlInputQId(null);
    setUrlInputValue('');
    showToast('✓ Diagram link attached');
  };

  // PDF Import Execution
  const handlePdfUploadAndExtract = async () => {
    if (!pdfFile) {
      showToast('Please select a PDF file');
      return;
    }

    try {
      setPdfImporting(true);
      setPdfImportProgress('Reading PDF pages & extracting question text...');

      // Save user API key to localStorage if entered
      if (geminiApiKey.trim()) {
        localStorage.setItem('gemini_api_key', geminiApiKey.trim());
      }

      // Step 1: Client-side text extraction using pdf.js as fallback/pre-processor
      let extractedText = '';
      try {
        let pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              pdfjs = (window as any).pdfjsLib;
              if (pdfjs) {
                pdfjs.GlobalWorkerOptions.workerSrc =
                  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
              } else {
                reject(new Error('pdfjsLib missing'));
              }
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js script'));
            document.head.appendChild(script);
          });
        }

        if (pdfjs) {
          const ab = await pdfFile.arrayBuffer();
          const doc = await pdfjs.getDocument({ data: ab }).promise;
          for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const tc = await page.getTextContent();
            const text = tc.items.map((item: any) => item.str).join(' ');
            extractedText += `\n--- Page ${p} ---\n` + text;
          }
        }
      } catch (clientErr) {
        console.warn('Client text extraction notice:', clientErr);
      }

      setPdfImportProgress(
        geminiApiKey.trim()
          ? 'Calling Gemini 2.5 Flash for multimodal OCR & question parsing...'
          : 'Processing extracted question paper text...'
      );

      const formData = new FormData();
      formData.append('pdf', pdfFile);
      if (geminiApiKey.trim()) {
        formData.append('apiKey', geminiApiKey.trim());
      }
      if (extractedText) {
        formData.append('extractedText', extractedText);
      }

      const res = await fetch('/api/import-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract questions');
      }

      setImportedQuestions(data.questions || []);
      setImportWarnings(data.warnings || []);
      setSelectedImportIndices((data.questions || []).map((_: any, i: number) => i));
      setPdfImportProgress('');
      showToast(`✓ Extracted ${data.questions?.length || 0} questions from PDF`);
    } catch (err: any) {
      console.error(err);
      showToast(`Extraction notice: ${err.message}`);
      setPdfImportProgress('');
    } finally {
      setPdfImporting(false);
    }
  };

  // Confirm PDF Questions Import
  const handleCommitImportedQuestions = async () => {
    if (!quiz || importedQuestions.length === 0) return;

    const chosen = importedQuestions.filter((_, idx) => selectedImportIndices.includes(idx));
    if (chosen.length === 0) {
      showToast('No questions selected');
      return;
    }

    const converted: QuizQuestion[] = chosen.map((iq, i) => ({
      id: generateQuestionId(),
      num: quiz.questions.length + i + 1,
      question: iq.question,
      options: iq.options,
      answer: iq.answer,
      points: 1,
      explanation: iq.explanation || '',
      hasDiagram: iq.hasDiagram,
      pageNumber: iq.pageNumber,
      warning: iq.warning,
    }));

    const nextQuestions = [...quiz.questions, ...converted].map((q, i) => ({ ...q, num: i + 1 }));
    setQuiz({ ...quiz, questions: nextQuestions });
    setIsPdfModalOpen(false);

    // Identify questions requiring diagram cropping
    const queue = converted
      .filter((q) => q.hasDiagram)
      .map((q) => ({
        qId: q.id,
        pageNumber: q.pageNumber || 1,
        questionText: q.question,
      }));

    if (queue.length > 0 && pdfFile) {
      setDiagramQueue(queue);
      setCurrentDiagramIdx(0);
      setIsDiagramReviewOpen(true);
      showToast(`Imported ${converted.length} questions. Opening diagram cropper for ${queue.length} diagrams.`);
    } else {
      showToast(`✓ Imported ${converted.length} questions from PDF!`);
    }
  };

  // Load PDF.js Document when Diagram Review Panel Opens
  useEffect(() => {
    if (!isDiagramReviewOpen || !pdfFile) return;

    async function loadPdf() {
      try {
        let pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              pdfjs = (window as any).pdfjsLib;
              if (pdfjs) {
                pdfjs.GlobalWorkerOptions.workerSrc =
                  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
              } else {
                reject(new Error('pdfjsLib not found'));
              }
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
          });
        }

        const arrayBuffer = await pdfFile!.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(doc);
      } catch (err) {
        console.warn('PDF.js preview fallback:', err);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = 600;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, 600, 400);
            ctx.strokeStyle = '#673ab7';
            ctx.lineWidth = 2;
            ctx.strokeRect(40, 40, 520, 320);
            ctx.fillStyle = '#673ab7';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('Sample Exam Diagram / Schematic (Page Preview)', 80, 140);
            ctx.fillStyle = '#5f6368';
            ctx.font = '14px sans-serif';
            ctx.fillText('Drag your cursor over this diagram to select the crop box.', 80, 180);
            setCropBox({ x: 60, y: 80, w: 480, h: 220 });
          }
        }
      }
    }
    loadPdf();
  }, [isDiagramReviewOpen, pdfFile]);

  // Render PDF Page to Canvas for Current Diagram Item
  useEffect(() => {
    if (!isDiagramReviewOpen || !pdfDoc || diagramQueue.length === 0) return;
    const current = diagramQueue[currentDiagramIdx];
    if (!current) return;

    let isCancelled = false;

    async function renderPage() {
      setIsRenderingPage(true);
      setCropBox(null);
      try {
        const pageNum = Math.min(Math.max(1, current.pageNumber), pdfDoc.numPages);
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas || isCancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!isCancelled) {
          setCropBox({
            x: Math.round(viewport.width * 0.15),
            y: Math.round(viewport.height * 0.2),
            w: Math.round(viewport.width * 0.7),
            h: Math.round(viewport.height * 0.35),
          });
        }
      } catch (err) {
        console.error('Error rendering PDF page:', err);
      } finally {
        if (!isCancelled) setIsRenderingPage(false);
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [isDiagramReviewOpen, pdfDoc, currentDiagramIdx, diagramQueue]);

  // Crop & Attach Diagram to Current Question
  const handleCropAndAttach = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !cropBox) {
      showToast('Please select a region to crop');
      return;
    }

    const current = diagramQueue[currentDiagramIdx];
    if (!current) return;

    try {
      showToast('Cropping and saving diagram...');
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(10, cropBox.w);
      cropCanvas.height = Math.max(10, cropBox.h);
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return;

      cropCtx.drawImage(
        canvas,
        cropBox.x,
        cropBox.y,
        cropBox.w,
        cropBox.h,
        0,
        0,
        cropBox.w,
        cropBox.h
      );

      cropCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const url = await uploadDiagramBlob(blob, quizId, current.qId);
        updateQuestion(current.qId, { diagramUrl: url, hasDiagram: true });
        showToast(`✓ Attached diagram to Question!`);

        if (currentDiagramIdx + 1 < diagramQueue.length) {
          setCurrentDiagramIdx((prev) => prev + 1);
        } else {
          setIsDiagramReviewOpen(false);
          showToast('✓ All diagrams attached to questions!');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('Failed to crop diagram');
    }
  };

  // Canvas Mouse Events for Dragging Crop Box
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDraggingCrop(true);
    setCropStart({ x, y });
    setCropBox({ x, y, w: 0, h: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCrop) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);

    setCropBox({ x, y, w, h });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCrop(false);
  };

  // Bulk JSON Import
  const handleCommitJson = () => {
    try {
      setJsonError(null);
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        setJsonError('Input must be a JSON array of question objects.');
        return;
      }

      const validated: QuizQuestion[] = parsed.map((item: any, i: number) => {
        let opts = Array.isArray(item.options) ? item.options.map(String) : [];
        while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
        opts = opts.slice(0, 4);

        let ans = Number(item.answer);
        if (isNaN(ans) || ans < 1 || ans > 4) ans = 1;

        return {
          id: generateQuestionId(),
          num: (quiz?.questions.length || 0) + i + 1,
          question: item.question || `Question ${i + 1}`,
          options: opts as [string, string, string, string],
          answer: ans,
          points: Number(item.points) || 1,
          explanation: item.explanation || '',
          diagramUrl: item.diagramUrl || undefined,
        };
      });

      if (!quiz) return;
      setQuiz({
        ...quiz,
        questions: [...quiz.questions, ...validated].map((q, i) => ({ ...q, num: i + 1 })),
      });
      setIsJsonModalOpen(false);
      setJsonInput('');
      showToast(`✓ Bulk imported ${validated.length} questions!`);
    } catch (err: any) {
      setJsonError(`Invalid JSON: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Opening Quiz Editor...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-red-600 font-semibold">Quiz not found</p>
        <Link href="/admin" className="gf-btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-36">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#323232] text-white px-5 py-3 rounded-md shadow-lg text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Google Forms Tab Bar (Questions / Responses) */}
      <div className="bg-white border-b border-[#dadce0] -mt-8 -mx-4 px-6 mb-6 shadow-2xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href={`/admin/edit/${quiz.id}`}
              className="py-3.5 text-sm font-semibold text-[#673ab7] border-b-2 border-[#673ab7] flex items-center gap-2"
            >
              Questions
            </Link>
            <Link
              href={`/admin/responses/${quiz.id}`}
              className="py-3.5 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
            >
              Responses
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-bold text-gray-700">
                {quiz.responseCount || 0}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              type="button"
              className="gf-btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
              title="Copy Student Quiz Link to Clipboard"
            >
              <svg className="w-4 h-4 text-[#673ab7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy Link</span>
            </button>

            <Link
              href={`/quiz/${quiz.id}`}
              target="_blank"
              className="gf-btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="Preview Student View in New Tab"
            >
              <svg className="w-4 h-4 text-[#673ab7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Student Preview ↗</span>
            </Link>

            <button
              onClick={handleSave}
              disabled={saving}
              className="gf-btn-primary text-xs py-1.5 px-4"
            >
              {saving ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Editor Center Single Column */}
      <div className="max-w-3xl mx-auto space-y-4 relative">
        {/* Quiz Header Card */}
        <div className="gf-card overflow-hidden">
          <div className="gf-header-accent" />
          <div className="p-7 space-y-5">
            <div>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                placeholder="Untitled Quiz"
                className="w-full text-3xl font-normal text-[#202124] gf-input-underline pb-2 placeholder-gray-400"
              />
            </div>

            <div>
              <textarea
                rows={2}
                value={quiz.description}
                onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                placeholder="Form description / Exam instructions..."
                className="w-full text-sm text-[#5f6368] gf-input-underline pb-2 resize-none placeholder-gray-400"
              />
            </div>

            {/* Direct Student Quiz Link Bar */}
            <div className="p-3 bg-[#ede7f6]/50 rounded-lg border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="font-semibold text-[#673ab7] shrink-0">Student Link:</span>
                <code className="bg-white px-2 py-1 rounded border border-purple-200 text-[#673ab7] font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                  {typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quiz.id}` : `/quiz/${quiz.id}`}
                </code>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="gf-btn-outline text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#673ab7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="gf-btn-outline text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                  title="Scan with phone"
                >
                  <svg className="w-3.5 h-3.5 text-[#673ab7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR Code
                </button>
                <Link
                  href={`/quiz/${quiz.id}`}
                  target="_blank"
                  className="gf-btn-primary text-[11px] py-1 px-2.5 flex items-center gap-1"
                >
                  Open Quiz ↗
                </Link>
              </div>
            </div>

            {/* Exam Settings Bar */}
            <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <span>Time Limit:</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={quiz.durationMinutes}
                  onChange={(e) => setQuiz({ ...quiz, durationMinutes: Number(e.target.value) || 90 })}
                  className="w-16 px-2 py-1 border border-[#dadce0] rounded text-center font-bold text-gray-800"
                />
                <span className="text-gray-500">Minutes</span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                <span>Accepting Responses:</span>
                <button
                  type="button"
                  onClick={() => setQuiz({ ...quiz, isAcceptingResponses: !quiz.isAcceptingResponses })}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                    quiz.isAcceptingResponses ? 'bg-[#673ab7]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      quiz.isAcceptingResponses ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between col-span-1 sm:col-span-2 pt-2 border-t border-gray-100">
                <span>Show score & answers immediately after submit:</span>
                <button
                  type="button"
                  onClick={() => setQuiz({ ...quiz, showResultsImmediately: !quiz.showResultsImmediately })}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                    quiz.showResultsImmediately ? 'bg-[#673ab7]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      quiz.showResultsImmediately ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between col-span-1 sm:col-span-2">
                <span>Allow only 1 attempt per student Roll No. / Email:</span>
                <button
                  type="button"
                  onClick={() => setQuiz({ ...quiz, allowSingleAttempt: !quiz.allowSingleAttempt })}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                    quiz.allowSingleAttempt ? 'bg-[#673ab7]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      quiz.allowSingleAttempt ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Student Registration & Standards / Divisions Settings */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#673ab7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Student Standard & Divisions (Required on Entry)
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Students will choose their division from these options when taking the quiz. Customize per exam below:
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-gray-500 font-medium mr-1">Quick Presets:</span>
                {['6th (A-F)', '7th (A-F)', '8th (A-F)', '9th (A-F)', '10th (A-F)', 'A to D'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyDivisionPreset(preset)}
                    className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-[#673ab7] border border-purple-200 transition-colors font-medium cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Active Division Chips */}
              <div className="flex flex-wrap gap-2 items-center min-h-[36px] p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                {(quiz.divisions || ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F']).map((div, dIdx) => (
                  <span
                    key={dIdx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-gray-800 border border-gray-300 shadow-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#673ab7]" />
                    {div}
                    <button
                      type="button"
                      onClick={() => removeDivision(dIdx)}
                      className="text-gray-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                      title="Remove division"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* Add Custom Division Input */}
                <div className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="text"
                    placeholder="+ Add (e.g. 6th G)"
                    value={newDivisionInput}
                    onChange={(e) => setNewDivisionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDivision();
                      }
                    }}
                    className="px-2.5 py-1 bg-white border border-dashed border-gray-300 rounded text-xs focus:border-[#673ab7] focus:outline-none w-28"
                  />
                  <button
                    type="button"
                    onClick={handleAddDivision}
                    className="px-2.5 py-1 rounded bg-[#673ab7] text-white text-[11px] font-medium hover:bg-[#5e35b1] cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Cards List */}
        {quiz.questions.map((q, idx) => {
          const isActive = activeQuestionId === q.id;

          return (
            <div
              key={q.id}
              onClick={() => setActiveQuestionId(q.id)}
              className={`gf-card relative transition-all ${
                isActive ? 'gf-card-active' : ''
              }`}
            >
              <div className="p-6 space-y-4">
                {/* Question Header & Points */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#ede7f6] text-[#673ab7] font-bold text-xs flex items-center justify-center">
                      {q.num}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Question {q.num}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Points:</span>
                    <input
                      type="number"
                      min={1}
                      value={q.points}
                      onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) || 1 })}
                      className="w-12 px-2 py-0.5 border border-[#dadce0] rounded text-center font-bold text-gray-800"
                    />

                    {/* Reorder Buttons */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(idx, 'up');
                      }}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer"
                      title="Move Question Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === quiz.questions.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(idx, 'down');
                      }}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer"
                      title="Move Question Down"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {/* Quality Warning if flagged */}
                {q.warning && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{q.warning}</span>
                  </div>
                )}

                {/* Question Textarea */}
                <div>
                  <textarea
                    rows={2}
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                    placeholder="Question"
                    className="w-full text-base font-normal text-[#202124] gf-input-underline pb-2 resize-y placeholder-gray-400"
                  />
                </div>

                {/* Diagram Section */}
                {q.diagramUrl ? (
                  <div className="p-3 bg-gray-50 border border-[#dadce0] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-[#673ab7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Question Diagram
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-[#673ab7] hover:underline font-medium cursor-pointer">
                          Replace
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(q.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => updateQuestion(q.id, { diagramUrl: undefined, hasDiagram: false })}
                          className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 flex justify-center bg-white p-2 rounded border border-gray-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.diagramUrl} alt="Question Diagram" className="max-h-60 object-contain rounded" />
                    </div>
                  </div>
                ) : uploadingDiagramQId === q.id ? (
                  <div className="p-3 bg-[#ede7f6]/50 border border-purple-200 rounded-lg flex items-center gap-2.5 text-xs text-[#673ab7] font-medium">
                    <div className="w-4 h-4 border-2 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
                    <span>Processing and attaching diagram image...</span>
                  </div>
                ) : urlInputQId === q.id ? (
                  <div className="p-3 bg-gray-50 border border-purple-200 rounded-lg space-y-2">
                    <div className="text-xs font-semibold text-gray-700">Paste Image Link (URL):</div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/diagram.png"
                        value={urlInputValue}
                        onChange={(e) => setUrlInputValue(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-[#dadce0] rounded bg-white focus:outline-none focus:border-[#673ab7]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAttachImageUrl(q.id);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAttachImageUrl(q.id)}
                        className="gf-btn-primary text-xs py-1.5 px-3 cursor-pointer"
                      >
                        Attach
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUrlInputQId(null);
                          setUrlInputValue('');
                        }}
                        className="gf-btn-outline text-xs py-1.5 px-3 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="cursor-pointer text-xs font-medium text-[#673ab7] hover:text-[#5e35a1] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-[#ede7f6] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Add diagram image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(q.id, file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setUrlInputQId(q.id);
                        setUrlInputValue('');
                      }}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                    >
                      or paste image URL
                    </button>
                  </div>
                )}

                {/* 4 MCQ Options (Google Forms Radio Style) */}
                <div className="space-y-3 pt-1">
                  {q.options.map((optText, optIdx) => {
                    const optionNum = optIdx + 1;
                    const isCorrect = q.answer === optionNum;

                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-3 py-1 px-2 rounded-md transition-colors ${
                          isCorrect ? 'bg-[#ede7f6]/40' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Google Forms Radio Button to select Answer Key */}
                        <input
                          type="radio"
                          name={`answer-${q.id}`}
                          checked={isCorrect}
                          onChange={() => updateQuestion(q.id, { answer: optionNum })}
                          className="gf-radio"
                          title="Select as correct answer key"
                        />

                        {/* Option Letter */}
                        <span className="text-xs font-bold text-gray-400 w-4">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>

                        {/* Underlined Option Input */}
                        <input
                          type="text"
                          value={optText}
                          onChange={(e) => {
                            const nextOpts = [...q.options] as [string, string, string, string];
                            nextOpts[optIdx] = e.target.value;
                            updateQuestion(q.id, { options: nextOpts });
                          }}
                          placeholder={`Option ${optionNum}`}
                          className="flex-1 text-sm text-[#202124] gf-input-underline pb-1 placeholder-gray-400"
                        />

                        {isCorrect && (
                          <span className="text-xs font-semibold text-[#673ab7] px-2 py-0.5 rounded-full bg-[#ede7f6] shrink-0">
                            ✓ Correct Key
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Drawer */}
                <div className="pt-2">
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer font-medium text-[#673ab7] hover:underline select-none">
                      {q.explanation ? 'Edit explanation' : '+ Add explanation'}
                    </summary>
                    <div className="mt-2">
                      <textarea
                        rows={2}
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                        placeholder="Explain why this answer is correct..."
                        className="w-full text-xs text-gray-700 gf-input-underline pb-1 resize-y"
                      />
                    </div>
                  </details>
                </div>

                {/* Bottom Card Controls */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => duplicateQuestion(q.id)}
                    className="p-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors"
                    title="Duplicate Question"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                    title="Delete Question"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Floating Vertical Toolbar (Google Forms Style beside Active Question) */}
              {isActive && (
                <div className="hidden lg:flex gf-floating-toolbar">
                  <button
                    type="button"
                    onClick={() => addQuestion(q.id)}
                    className="gf-toolbar-btn"
                    title="Add question"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  <label
                    className="gf-toolbar-btn text-purple-700 cursor-pointer"
                    title="Add diagram image to this question"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(q.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsPdfModalOpen(true)}
                    className="gf-toolbar-btn text-red-600"
                    title="Import from PDF (Gemini AI)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsJsonModalOpen(true)}
                    className="gf-toolbar-btn text-blue-600"
                    title="Bulk JSON import"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicateQuestion(q.id)}
                    className="gf-toolbar-btn"
                    title="Duplicate"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    className="gf-toolbar-btn hover:text-red-600"
                    title="Delete question"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom Quick-Add Bar */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => addQuestion()}
            className="gf-btn-outline text-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Question
          </button>

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="gf-btn-outline text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Import PDF
          </button>

          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="gf-btn-outline text-xs text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Bulk JSON
          </button>
        </div>
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#dadce0] py-3 px-6 z-30 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="text-xs text-gray-500 font-medium">
            {quiz.questions.length} Questions | Total Marks: {quiz.questions.reduce((a, b) => a + b.points, 0)}
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                ✓ All changes saved
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="gf-btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL 1: Automatic PDF-to-Quiz Importer ── */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="gf-card max-w-2xl w-full max-h-[90vh] flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Automatic PDF-to-Quiz Importer</h3>
                  <p className="text-xs text-gray-500">
                    Gemini AI extracts questions, 4 MCQ options, answer keys, and diagrams.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* AI Active Status Banner */}
            <div className="p-3 bg-[#ede7f6]/60 border border-purple-200 rounded-lg flex items-center gap-2 text-xs text-[#673ab7]">
              <span className="w-2 h-2 rounded-full bg-[#673ab7] shrink-0" />
              <span><strong>Gemini AI Active:</strong> Multi-column layouts, diagrams, and answer keys will be extracted automatically.</span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingPdf(true);
              }}
              onDragLeave={() => setIsDraggingPdf(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingPdf(false);
                const file = e.dataTransfer.files?.[0];
                if (file) setPdfFile(file);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDraggingPdf
                  ? 'border-[#673ab7] bg-[#ede7f6]/60 scale-[1.01]'
                  : 'border-[#dadce0] hover:border-[#673ab7] bg-gray-50/50'
              }`}
            >
              <input
                type="file"
                id="pdf-upload"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPdfFile(file);
                }}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer block space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#ede7f6] text-[#673ab7] flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {pdfFile ? pdfFile.name : 'Click to select or drag & drop question paper PDF'}
                </p>
                <p className="text-xs text-gray-500">
                  Multi-column layouts and end-of-paper answer keys supported
                </p>
              </label>

              {pdfFile && (
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={handlePdfUploadAndExtract}
                    disabled={pdfImporting}
                    className="gf-btn-primary text-xs"
                  >
                    {pdfImporting ? 'Extracting with Gemini AI...' : 'Start AI Extraction'}
                  </button>
                </div>
              )}
            </div>

            {/* Progress */}
            {pdfImportProgress && (
              <div className="p-3 bg-[#ede7f6] rounded-lg text-xs text-[#673ab7] font-medium flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#673ab7] border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{pdfImportProgress}</span>
              </div>
            )}

            {/* Warnings */}
            {importWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-xs font-semibold text-amber-800">Quality Warnings / Notes:</p>
                {importWarnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-700">
                    • {w}
                  </p>
                ))}
              </div>
            )}

            {/* Extracted Questions Preview */}
            {importedQuestions.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 border border-[#dadce0] rounded-lg p-3 max-h-56">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600 pb-1 border-b">
                  <span>Extracted {importedQuestions.length} Questions</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedImportIndices(importedQuestions.map((_, i) => i))}
                      className="text-[#673ab7] hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedImportIndices([])}
                      className="text-gray-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {importedQuestions.map((iq, idx) => {
                  const isChecked = selectedImportIndices.includes(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedImportIndices((prev) =>
                          isChecked ? prev.filter((i) => i !== idx) : [...prev, idx]
                        );
                      }}
                      className={`p-2.5 rounded border text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
                        isChecked ? 'border-purple-300 bg-[#ede7f6]/40' : 'border-gray-200 bg-white opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 text-[#673ab7] rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-800 mr-2">Q{iq.num}.</span>
                        <span className="text-gray-700 line-clamp-1">{iq.question}</span>
                        <div className="text-gray-500 text-[11px] mt-1 flex items-center gap-3">
                          <span>Ans: Option {iq.answer}</span>
                          {iq.hasDiagram && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                              Diagram (Page {iq.pageNumber})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="gf-btn-text text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCommitImportedQuestions}
                disabled={importedQuestions.length === 0 || selectedImportIndices.length === 0}
                className="gf-btn-primary text-xs"
              >
                Import {selectedImportIndices.length} Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Diagram Review & Cropper Panel ── */}
      {isDiagramReviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="gf-card max-w-4xl w-full max-h-[92vh] flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#ede7f6] text-[#673ab7] text-xs flex items-center justify-center">
                    {currentDiagramIdx + 1}/{diagramQueue.length}
                  </span>
                  Diagram Review & Crop Tool
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Drag a crop box over the diagram on this PDF page, then click &quot;Crop &amp; Attach&quot;.
                </p>
              </div>

              <button
                onClick={() => setIsDiagramReviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Target Question */}
            {diagramQueue[currentDiagramIdx] && (
              <div className="p-3 bg-[#ede7f6]/60 rounded-lg text-xs">
                <span className="font-semibold text-[#673ab7]">Target Question: </span>
                <span className="text-gray-800">{diagramQueue[currentDiagramIdx].questionText}</span>
                <span className="ml-2 font-medium text-gray-500">
                  (PDF Page {diagramQueue[currentDiagramIdx].pageNumber})
                </span>
              </div>
            )}

            {/* Canvas Crop Area */}
            <div className="flex-1 overflow-auto border border-[#dadce0] rounded-lg bg-gray-100 flex items-center justify-center relative min-h-[360px]">
              {isRenderingPage && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
                  <div className="w-8 h-8 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <div className="relative inline-block cursor-crosshair select-none">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  className="max-w-full block shadow-md"
                />

                {cropBox && (
                  <div
                    style={{
                      left: `${cropBox.x}px`,
                      top: `${cropBox.y}px`,
                      width: `${cropBox.w}px`,
                      height: `${cropBox.h}px`,
                    }}
                    className="absolute border-2 border-[#673ab7] bg-[#673ab7]/20 pointer-events-none"
                  >
                    <span className="absolute top-1 left-1 bg-[#673ab7] text-white text-[10px] px-1 py-0.5 rounded font-mono">
                      Crop Area
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cropper Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  if (currentDiagramIdx + 1 < diagramQueue.length) {
                    setCurrentDiagramIdx((prev) => prev + 1);
                  } else {
                    setIsDiagramReviewOpen(false);
                  }
                }}
                className="gf-btn-text text-xs"
              >
                Skip This Diagram &rarr;
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDiagramReviewOpen(false)}
                  className="gf-btn-text text-xs"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleCropAndAttach}
                  disabled={!cropBox}
                  className="gf-btn-primary text-xs"
                >
                  Crop & Attach to Question
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Bulk JSON Import Modal ── */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="gf-card max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Bulk JSON Import</h3>
              <button onClick={() => setIsJsonModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Paste an array of question objects. Example format:
              <br />
              <code className="text-[#673ab7] font-mono">
                [{'{"question": "...", "options": ["A", "B", "C", "D"], "answer": 1}'}]
              </code>
            </p>

            {jsonError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs font-medium">
                {jsonError}
              </div>
            )}

            <textarea
              rows={8}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste JSON array here..."
              className="w-full text-xs font-mono p-3 border border-[#dadce0] rounded-md focus:border-[#673ab7] focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(false)}
                className="gf-btn-text text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitJson}
                disabled={!jsonInput.trim()}
                className="gf-btn-primary text-xs"
              >
                Import Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Mobile Testing */}
      {showQrModal && quiz && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Scan Exam Link with Phone</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Point your phone camera at this QR code to open the exam directly without typing mistakes:
            </p>

            <div className="flex justify-center p-4 bg-gray-50 rounded-xl border border-gray-200/60 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quiz.id}` : `/quiz/${quiz.id}`
                )}`}
                alt="Quiz QR Code"
                className="w-48 h-48 rounded-lg shadow-xs"
              />
            </div>

            <div className="bg-purple-50 text-[#673ab7] p-2.5 rounded-lg border border-purple-100 text-[11px] font-mono break-all select-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quiz.id}` : `/quiz/${quiz.id}`}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="gf-btn-outline flex-1 text-xs py-2"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="gf-btn-primary flex-1 text-xs py-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
