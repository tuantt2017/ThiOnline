'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { KnowledgeNode, Document, KnowledgeMapTree } from '@/types';
import {
  Network,
  ChevronRight,
  ChevronDown,
  FolderTree,
  Search,
  BookOpen,
  Maximize2,
  Minimize2,
  Loader2,
  GraduationCap,
} from 'lucide-react';

// Color mappings and icons for the 8 levels
const NODE_STYLE_CONFIG: Record<
  string,
  { label: string; badge: string; border: string; iconColor: string }
> = {
  SUBJECT: {
    label: 'Môn học',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-l-4 border-l-blue-500',
    iconColor: 'text-blue-600',
  },
  GRADE: {
    label: 'Khối lớp',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    border: 'border-l-4 border-l-cyan-500',
    iconColor: 'text-cyan-600',
  },
  BOOK: {
    label: 'Bộ sách',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    border: 'border-l-4 border-l-purple-500',
    iconColor: 'text-purple-600',
  },
  CHAPTER: {
    label: 'Chương',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    border: 'border-l-4 border-l-indigo-500',
    iconColor: 'text-indigo-600',
  },
  LESSON: {
    label: 'Bài học',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    border: 'border-l-4 border-l-sky-500',
    iconColor: 'text-sky-600',
  },
  TOPIC: {
    label: 'Chủ đề',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    border: 'border-l-4 border-l-amber-500',
    iconColor: 'text-amber-600',
  },
  CONCEPT: {
    label: 'Khái niệm',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    border: 'border-l-4 border-l-rose-500',
    iconColor: 'text-rose-600',
  },
  LEARNING_OBJECTIVE: {
    label: 'Mục tiêu cần đạt',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    border: 'border-l-4 border-l-emerald-500',
    iconColor: 'text-emerald-600',
  },
};

// Recursive Tree Node Component
function TreeNode({
  node,
  expandedIds,
  toggleExpand,
  searchFilter,
  level = 0,
}: {
  node: KnowledgeNode;
  expandedIds: Set<number>;
  toggleExpand: (id: number) => void;
  searchFilter: string;
  level?: number;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const config = NODE_STYLE_CONFIG[node.node_type] || {
    label: node.node_type,
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    border: 'border-l-4 border-l-slate-400',
    iconColor: 'text-slate-600',
  };

  const matchesFilter =
    !searchFilter ||
    node.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (node.description && node.description.toLowerCase().includes(searchFilter.toLowerCase()));

  if (searchFilter && !matchesFilter && !hasChildren) {
    return null;
  }

  return (
    <div className="space-y-2 select-none">
      <div
        className={`flex items-start justify-between p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm transition-all hover:shadow-md hover:border-slate-300 ${config.border}`}
        style={{ marginLeft: `${level * 1.25}rem` }}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="mt-0.5 p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-700" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-700" />
              )}
            </button>
          ) : (
            <span className="w-6 h-6 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${config.badge}`}>
                {config.label}
              </span>
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {node.title}
              </h4>
            </div>

            {node.description && (
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {node.description}
              </p>
            )}
          </div>
        </div>

        {hasChildren && (
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
            {node.children.length} mục con
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              searchFilter={searchFilter}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeMapContent() {
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get('docId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(
    docIdParam ? parseInt(docIdParam, 10) : null
  );
  const [treeData, setTreeData] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch available documents
  useEffect(() => {
    async function loadDocs() {
      setLoading(true);
      try {
        const docs = await api.getDocuments({ status: 'COMPLETED' });
        setDocuments(docs || []);
        if (docs && docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách tài liệu:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDocs();
  }, []);

  // Fetch knowledge tree for selected document
  useEffect(() => {
    if (!selectedDocId) return;

    async function loadTree() {
      setTreeLoading(true);
      try {
        const treeRes: KnowledgeMapTree = await api.getDocumentKnowledgeMap(selectedDocId!);
        const nodes = treeRes?.tree || [];
        setTreeData(nodes);

        // Expand root and 1st level by default
        const initialExpanded = new Set<number>();
        function addExpanded(nodeList: KnowledgeNode[], depth: number) {
          if (depth > 1) return;
          for (const n of nodeList) {
            initialExpanded.add(n.id);
            if (n.children) {
              addExpanded(n.children, depth + 1);
            }
          }
        }
        addExpanded(nodes, 0);
        setExpandedIds(initialExpanded);
      } catch (err) {
        console.error('Lỗi khi tải bản đồ tri thức:', err);
        setTreeData([]);
      } finally {
        setTreeLoading(false);
      }
    }

    loadTree();
  }, [selectedDocId]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<number>();
    function collect(nodeList: KnowledgeNode[]) {
      for (const n of nodeList) {
        allIds.add(n.id);
        if (n.children) collect(n.children);
      }
    }
    collect(treeData);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200 mb-2">
              <Network className="w-3.5 h-3.5" /> Sơ Đồ Cây Tri Thức Chuẩn SGK
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Bản Đồ Tri Thức (Knowledge Map)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
              Trực quan hóa cấu trúc phân cấp tri thức 8 cấp độ từ Sách giáo khoa GDPT.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
            >
              <FolderTree className="w-4 h-4 text-blue-600" />
              Quản lý tài liệu SGK
            </Link>
          </div>
        </div>

        {/* Legend Toolbar: 8 Levels */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 mb-6 shadow-sm">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
            Cấu trúc 8 cấp bậc chuẩn SGK:
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {Object.entries(NODE_STYLE_CONFIG).map(([key, cfg], idx) => (
              <React.Fragment key={key}>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold ${cfg.badge}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {idx + 1}. {cfg.label}
                </span>
                {idx < 7 && <span className="text-slate-300">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Controls: Document Selector + Search + Expand/Collapse */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Document Selector */}
            <div className="flex items-center gap-3 flex-1">
              <BookOpen className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1">
                <select
                  value={selectedDocId || ''}
                  onChange={(e) => setSelectedDocId(parseInt(e.target.value, 10))}
                  disabled={loading || documents.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {documents.length === 0 ? (
                    <option value="">Chưa có tài liệu nào hoàn tất trích xuất</option>
                  ) : (
                    documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.subject} Lớp {d.grade}] {d.title} ({d.book_series || 'SGK'})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Keyword Search */}
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm khái niệm, bài học..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Expand / Collapse buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Mở rộng tất cả
              </button>
              <button
                onClick={collapseAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
              >
                <Minimize2 className="w-3.5 h-3.5" /> Thu gọn
              </button>
            </div>
          </div>
        </div>

        {/* Tree Render Area */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
          {treeLoading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-semibold text-slate-500">Đang dựng cây tri thức...</p>
            </div>
          ) : treeData.length === 0 ? (
            <div className="py-16 text-center">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">
                Chưa có dữ liệu bản đồ tri thức
              </h3>
              <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Vui lòng tải lên tài liệu SGK để hệ thống tự động sinh cây phân cấp tri thức.
              </p>
              <Link
                href="/documents"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition"
              >
                Tải lên tài liệu ngay
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {treeData.map((rootNode) => (
                <TreeNode
                  key={rootNode.id}
                  node={rootNode}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  searchFilter={searchFilter}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeMapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <KnowledgeMapContent />
    </Suspense>
  );
}
