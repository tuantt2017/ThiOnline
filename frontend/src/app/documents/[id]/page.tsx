'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Document, DocumentChunk, PaginatedChunks } from '@/types';
import {
  ArrowLeft,
  FileText,
  Network,
  BookOpen,
  Calendar,
  Layers,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  Target,
  Sparkles,
} from 'lucide-react';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const documentId = parseInt(params.id as string, 10);


  const [document, setDocument] = useState<Document | null>(null);
  const [chunksData, setChunksData] = useState<PaginatedChunks | null>(null);
  const [loading, setLoading] = useState(true);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chunks pagination & search
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const fetchDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const doc = await api.getDocumentById(documentId);
      setDocument(doc);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết tài liệu');
    } finally {
      setLoading(false);
    }
  };

  const fetchChunks = async (pageToFetch: number, querySearch?: string) => {
    try {
      setChunksLoading(true);
      const res = await api.getDocumentChunks(documentId, {
        page: pageToFetch,
        page_size: 15,
        search: querySearch || undefined,
      });
      setChunksData(res);
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách chunks:', err);
    } finally {
      setChunksLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && documentId) {
      fetchDocument();
    }
  }, [user, documentId]);

  useEffect(() => {
    if (user && documentId) {
      fetchChunks(page, activeSearch);
    }
  }, [user, documentId, page, activeSearch]);

  // Tự động cập nhật trạng thái tài liệu khi đang ở trạng thái PENDING hoặc PROCESSING
  useEffect(() => {
    if (!document || (document.status !== 'PROCESSING' && document.status !== 'PENDING')) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await api.getDocumentById(documentId);
        setDocument(updated);
        if (updated.status === 'COMPLETED') {
          fetchChunks(1, activeSearch);
        }
      } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái chi tiết tài liệu:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [document?.status, documentId, activeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
  };

  const clearSearch = () => {
    setSearch('');
    setActiveSearch('');
    setPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Không tìm thấy tài liệu</h2>
        <p className="text-sm text-slate-500 mt-1">{error || 'Tài liệu không tồn tại hoặc đã bị xóa.'}</p>
        <Link
          href="/documents"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const meta = document.extracted_metadata || {};

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-6">
          <Link href="/documents" className="hover:text-blue-600 transition flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Kho tài liệu
          </Link>
          <span>/</span>
          <span className="text-slate-800 truncate max-w-xs sm:max-w-md">{document.title}</span>
        </div>

        {/* Document Header Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {document.subject}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  Khối Lớp {document.grade}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600">
                  Định dạng: {document.file_type}
                </span>
                {document.status === 'COMPLETED' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Trích xuất hoàn tất
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {document.title}
              </h1>

              {document.book_series && (
                <p className="text-sm text-slate-600 mt-1.5">
                  Bộ sách: <span className="font-semibold text-slate-900">{document.book_series}</span>
                </p>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={`/knowledge-map?doc=${document.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition"
              >
                <Network className="w-4 h-4" />
                Mở Bản Đồ Tri Thức
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-3.5 text-center">
              <div className="text-xs text-slate-500 font-medium">Tổng số trang</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{document.total_pages || 1}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 text-center">
              <div className="text-xs text-slate-500 font-medium">Số phân đoạn (Chunks)</div>
              <div className="text-lg font-bold text-blue-600 mt-0.5">{document.chunk_count}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 text-center">
              <div className="text-xs text-slate-500 font-medium">Số chương</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{meta.total_chapters || 0}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 text-center">
              <div className="text-xs text-slate-500 font-medium">Số bài học</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{meta.total_lessons || 0}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 text-center">
              <div className="text-xs text-slate-500 font-medium">Khái niệm</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{meta.total_concepts || 0}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 text-center">
              <div className="text-xs text-slate-500 font-medium">Mục tiêu học tập</div>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">{meta.total_learning_objectives || 0}</div>
            </div>
          </div>
        </div>

        {/* Chunks Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Danh Sách Phân Đoạn Ngữ Nghĩa (Document Chunks)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Các đoạn văn bản đã chia nhỏ chuẩn ~1.000 ký tự có bảo toàn liên kết Chương, Bài, Chủ đề và Mục tiêu học tập.
              </p>
            </div>

            {/* Chunk Search form */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm từ khóa trong chunk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              >
                Tìm
              </button>
              {activeSearch && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium"
                >
                  Bỏ lọc
                </button>
              )}
            </form>
          </div>

          {/* Chunks List */}
          {chunksLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <p className="text-xs text-slate-500">Đang tải phân đoạn...</p>
            </div>
          ) : !chunksData || chunksData.items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Không tìm thấy phân đoạn nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="space-y-4">
              {chunksData.items.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 hover:border-blue-300 transition"
                >
                  {/* Chunk header badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800">
                        Chunk #{chunk.chunk_index + 1}
                      </span>
                      {chunk.page_number && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-200/80 text-slate-700">
                          Trang {chunk.page_number}
                        </span>
                      )}
                      {chunk.chapter && (
                        <span className="text-xs font-semibold text-slate-800">
                          {chunk.chapter}
                        </span>
                      )}
                      {chunk.lesson && (
                        <span className="text-xs text-slate-500">
                          / {chunk.lesson}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{chunk.char_count} ký tự</span>
                  </div>

                  {/* Chunk content */}
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-100 mb-3 font-normal">
                    {chunk.content}
                  </div>

                  {/* Context tags: Topic, Concept, Objective */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {chunk.topic && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Tag className="w-3 h-3" />
                        <span className="font-medium">Chủ đề:</span> {chunk.topic}
                      </span>
                    )}
                    {chunk.concept && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        <Sparkles className="w-3 h-3" />
                        <span className="font-medium">Khái niệm:</span> {chunk.concept}
                      </span>
                    )}
                    {chunk.learning_objective && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Target className="w-3 h-3" />
                        <span className="font-medium">Mục tiêu:</span> {chunk.learning_objective}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination controls */}
          {chunksData && chunksData.total_pages > 1 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 text-xs text-slate-500">
              <div>
                Hiển thị trang <span className="font-bold text-slate-900">{chunksData.page}</span> /{' '}
                {chunksData.total_pages} (Tổng số {chunksData.total} chunks)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || chunksLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Trước
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(chunksData.total_pages, p + 1))}
                  disabled={page >= chunksData.total_pages || chunksLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition"
                >
                  Sau <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
