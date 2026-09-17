'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Document, DocumentStatus, DocumentType } from '@/types';
import {
  FolderTree,
  UploadCloud,

  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Network,
  BookOpen,
  Filter,
  Plus,
  X,
  Sparkles,
  Search,
  ChevronRight,
} from 'lucide-react';

export default function DocumentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();


  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'STUDENT' && user?.grade && !gradeFilter) {
      setGradeFilter(user.grade.toString());
    }
  }, [user]);


  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubject, setUploadSubject] = useState('Toán học');
  const [uploadGrade, setUploadGrade] = useState('4');
  const [uploadBookSeries, setUploadBookSeries] = useState('Kết nối tri thức với cuộc sống');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action states
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await api.getDocuments({
        subject: subjectFilter || undefined,
        grade: gradeFilter ? parseInt(gradeFilter) : undefined,
        status: statusFilter || undefined,
      });
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, subjectFilter, gradeFilter, statusFilter]);

  // Tự động làm mới danh sách mỗi 3 giây khi có tài liệu đang xử lý (PENDING hoặc PROCESSING)
  useEffect(() => {
    const hasActiveTask = documents.some(
      (d) => d.status === 'PROCESSING' || d.status === 'PENDING'
    );
    if (!hasActiveTask || !user) return;

    const interval = setInterval(async () => {
      try {
        const docs = await api.getDocuments({
          subject: subjectFilter || undefined,
          grade: gradeFilter ? parseInt(gradeFilter) : undefined,
          status: statusFilter || undefined,
        });
        setDocuments(docs);
      } catch (err) {
        console.error('Lỗi tự động cập nhật trạng thái tài liệu:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, user, subjectFilter, gradeFilter, statusFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadTitle) {
        // Auto-fill title from filename
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Vui lòng chọn tệp tài liệu (PDF, DOCX, TXT)');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Vui lòng nhập tên tài liệu');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      formData.append('subject', uploadSubject);
      formData.append('grade', uploadGrade);
      if (uploadBookSeries.trim()) {
        formData.append('book_series', uploadBookSeries.trim());
      }

      await api.uploadDocument(formData);
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'Lỗi khi tải lên tài liệu');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = async (docId: number) => {
    try {
      setRetryingId(docId);
      await api.retryDocument(docId);
      await fetchDocuments();
    } catch (err: any) {
      alert(`Thử lại thất bại: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (docId: number, title: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài liệu "${title}" cùng toàn bộ phân đoạn và cây tri thức liên quan?`)) {
      return;
    }
    try {
      setDeletingId(docId);
      await api.deleteDocument(docId);
      await fetchDocuments();
    } catch (err: any) {
      alert(`Xóa thất bại: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocuments = documents.filter((doc) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      doc.title.toLowerCase().includes(kw) ||
      doc.subject.toLowerCase().includes(kw) ||
      (doc.book_series && doc.book_series.toLowerCase().includes(kw))
    );
  });

  const canManage = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Hệ thống Xử lý Học liệu & SGK
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Kho Tài Liệu & Tri Thức SGK
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Quản lý học liệu SGK chuẩn hóa (PDF, DOCX, TXT), phân đoạn ngữ nghĩa và trích xuất Knowledge Map 8 cấp độ.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/knowledge-map"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white text-sm font-medium text-slate-700 shadow-sm transition"
            >
              <Network className="w-4 h-4 text-blue-600" />
              Xem Bản Đồ Tri Thức
            </Link>

            {canManage && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                Tải lên tài liệu
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên sách, chủ đề..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subject filter */}
            <div>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả môn học</option>
                <option value="Toán">Toán học</option>
                <option value="Tiếng Việt">Tiếng Việt</option>
                <option value="Ngữ văn">Ngữ văn</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Khoa học">Khoa học (Lớp 4-5)</option>
                <option value="Khoa học tự nhiên">Khoa học tự nhiên (Lớp 6-9)</option>
                <option value="Lịch sử">Lịch sử & Địa lí</option>
                <option value="Tin học">Tin học</option>
                <option value="Công nghệ">Công nghệ</option>
                <option value="Giáo dục công dân">Giáo dục công dân</option>
              </select>
            </div>

            {/* Grade filter */}
            <div>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả khối lớp</option>
                <optgroup label="Cấp 1 (Tiểu học)">
                  <option value="4">Lớp 4</option>
                  <option value="5">Lớp 5</option>
                </optgroup>
                <optgroup label="Cấp 2 (THCS)">
                  <option value="6">Lớp 6</option>
                  <option value="7">Lớp 7</option>
                  <option value="8">Lớp 8</option>
                  <option value="9">Lớp 9</option>
                </optgroup>
                <optgroup label="Cấp 3 (THPT)">
                  <option value="10">Lớp 10</option>
                  <option value="11">Lớp 11</option>
                  <option value="12">Lớp 12</option>
                </optgroup>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="COMPLETED">Thành công</option>
                <option value="PROCESSING">Đang xử lý</option>
                <option value="FAILED">Thất bại</option>
                <option value="PENDING">Chờ duyệt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-slate-500">Đang tải kho tài liệu...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-rose-900">{error}</p>
            <button
              onClick={fetchDocuments}
              className="mt-3 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              Thử tải lại
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mx-auto mb-4">
              <FolderTree className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-semibold text-slate-900">Chưa có tài liệu nào</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Tải lên sách giáo khoa hoặc tài liệu học tập chuẩn để kích hoạt pipeline AI trích xuất phân đoạn và Knowledge Map.
            </p>
            {canManage && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                Tải lên tài liệu đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => {
              const meta = doc.extracted_metadata || {};
              const isCompleted = doc.status === 'COMPLETED';
              const isFailed = doc.status === 'FAILED';
              const isProcessing = doc.status === 'PROCESSING';

              return (
                <div
                  key={doc.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-blue-300"
                >
                  <div>
                    {/* Header line: Tags & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {doc.subject}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Lớp {doc.grade}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-600">
                          {doc.file_type}
                        </span>
                      </div>

                      {/* Status indicator */}
                      <div>
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã trích xuất
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang xử lý
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Thất bại
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Document Title */}
                    <Link
                      href={`/documents/${doc.id}`}
                      className="block group-hover:text-blue-600 transition"
                    >
                      <h3 className="font-bold text-base text-slate-900 line-clamp-2 leading-snug">
                        {doc.title}
                      </h3>
                    </Link>

                    {doc.book_series && (
                      <p className="text-xs text-slate-500 mt-1">
                        Bộ sách: <span className="font-medium text-slate-700">{doc.book_series}</span>
                      </p>
                    )}

                    {/* Error Banner if Failed */}
                    {isFailed && (
                      <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 text-xs">
                            <p className="font-semibold text-rose-900">Xử lý tài liệu không thành công</p>
                            <p className="text-rose-700 mt-0.5 line-clamp-2">{doc.error_message || 'Không rõ nguyên nhân lỗi'}</p>
                          </div>
                        </div>
                        {canManage && (
                          <button
                            onClick={() => handleRetry(doc.id)}
                            disabled={retryingId === doc.id}
                            className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retryingId === doc.id ? 'animate-spin' : ''}`} />
                            {retryingId === doc.id ? 'Đang thử lại...' : 'Thử lại (Retry)'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Stats overview if completed */}
                    {isCompleted && (
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 rounded-xl p-2">
                          <div className="text-xs text-slate-500">Phân đoạn</div>
                          <div className="text-sm font-bold text-slate-800">{doc.chunk_count}</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2">
                          <div className="text-xs text-slate-500">Chương / Bài</div>
                          <div className="text-sm font-bold text-slate-800">
                            {meta.total_chapters || 0} / {meta.total_lessons || 0}
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2">
                          <div className="text-xs text-slate-500">Mục tiêu</div>
                          <div className="text-sm font-bold text-slate-800">
                            {meta.total_learning_objectives || 0}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatFileSize(doc.file_size)}</span>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 font-medium transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Chunks
                      </Link>

                      {isCompleted && (
                        <Link
                          href={`/knowledge-map?doc=${doc.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition"
                        >
                          <Network className="w-3.5 h-3.5" />
                          Cây tri thức
                        </Link>
                      )}

                      {canManage && (
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          disabled={deletingId === doc.id}
                          title="Xóa tài liệu"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => !isUploading && setIsUploadOpen(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Tải Lên Tài Liệu SGK</h2>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động phân tích cú pháp, trích xuất cấu trúc chương/bài và bản đồ tri thức.
                </p>
              </div>
            </div>

            {uploadError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File upload drag-and-drop zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tệp tài liệu (PDF, DOCX, TXT - Tối đa 50MB)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                    uploadFile
                      ? 'border-emerald-400 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-semibold text-slate-800">{uploadFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(uploadFile.size)}</p>
                      <span className="text-xs text-blue-600 underline">Nhấp để đổi tệp khác</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <UploadCloud className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-700">
                        Kéo thả tệp vào đây hoặc nhấp để chọn
                      </p>
                      <p className="text-xs text-slate-500">Hỗ trợ định dạng: PDF, DOCX, TXT</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề tài liệu
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Sách Giáo Khoa Toán 10 - Tập 1"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Subject & Grade grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học</label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Tiếng Việt">Tiếng Việt (Lớp 4-5)</option>
                    <option value="Ngữ văn">Ngữ văn (Lớp 6-9)</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Khoa học">Khoa học (Lớp 4-5)</option>
                    <option value="Khoa học tự nhiên">Khoa học tự nhiên (Lớp 6-9)</option>
                    <option value="Lịch sử & Địa lí">Lịch sử & Địa lí</option>
                    <option value="Tin học">Tin học</option>
                    <option value="Công nghệ">Công nghệ</option>
                    <option value="Giáo dục công dân">Giáo dục công dân</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={uploadGrade}
                    onChange={(e) => setUploadGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <optgroup label="Cấp 1 (Tiểu học)">
                      <option value="4">Lớp 4</option>
                      <option value="5">Lớp 5</option>
                    </optgroup>
                    <optgroup label="Cấp 2 (THCS)">
                      <option value="6">Lớp 6</option>
                      <option value="7">Lớp 7</option>
                      <option value="8">Lớp 8</option>
                      <option value="9">Lớp 9</option>
                    </optgroup>
                    <optgroup label="Cấp 3 (THPT)">
                      <option value="10">Lớp 10</option>
                      <option value="11">Lớp 11</option>
                      <option value="12">Lớp 12</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Book Series */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bộ sách (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Kết nối tri thức, Cánh Diều, Chân trời sáng tạo..."
                  value={uploadBookSeries}
                  onChange={(e) => setUploadBookSeries(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang phân tích & trích xuất...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Bắt đầu tải lên
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
