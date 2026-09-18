'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { RewardItem, GiftRedemption } from '@/types';

export default function AdminRewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<GiftRedemption[]>([]);
  const [activeTab, setActiveTab] = useState<'REDEMPTIONS' | 'ITEMS' | 'CREATE'>('REDEMPTIONS');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for creating new reward item
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    image_url: '',
    diamond_cost: 10,
    stock_quantity: 50,
    category: 'Dụng cụ học tập',
    is_active: true,
  });

  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsData, redemptionsData] = await Promise.all([
        api.adminGetRewardItems(),
        api.adminGetRedemptions(),
      ]);
      setItems(itemsData);
      setRedemptions(redemptionsData);
    } catch (err: any) {
      console.error('Failed to fetch admin rewards data:', err);
      setError(err.message || 'Không thể tải dữ liệu quản lý quà tặng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title.trim()) return;
    setError(null);
    setSuccessMsg(null);

    try {
      await api.adminCreateRewardItem(newItem);
      setSuccessMsg(`Thêm mới quà tặng "${newItem.title}" thành công!`);
      setNewItem({
        title: '',
        description: '',
        image_url: '',
        diamond_cost: 10,
        stock_quantity: 50,
        category: 'Dụng cụ học tập',
        is_active: true,
      });
      setActiveTab('ITEMS');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo vật phẩm quà tặng');
    }
  };

  const handleUpdateStatus = async (redemptionId: number, status: string) => {
    try {
      await api.adminUpdateRedemptionStatus(redemptionId, status);
      setSuccessMsg(`Cập nhật trạng thái đơn #${redemptionId} thành công!`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái đơn');
    }
  };

  const handleUpdateStock = async (itemId: number, newStock: number) => {
    try {
      await api.adminUpdateRewardItem(itemId, { stock_quantity: newStock });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật số lượng tồn kho');
    }
  };

  const handleToggleActive = async (itemId: number, currentActive: boolean) => {
    try {
      await api.adminUpdateRewardItem(itemId, { is_active: !currentActive });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể thay đổi trạng thái vật phẩm');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin"
                className="text-xs font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                &larr; Trang Quản Trị Hệ Thống
              </Link>
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-amber-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent mt-1">
              👑 Quản Lý Kho Quà Tặng & Đơn Đổi Kim Cương
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Duyệt các yêu cầu đổi quà của học sinh, quản lý vật phẩm và tồn kho quà tặng.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('CREATE')}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-2"
          >
            <span>✨</span> Thêm Vật Phẩm Quà Tặng Mới
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-400">✕</button>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-4 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-rose-400">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('REDEMPTIONS')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'REDEMPTIONS'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-extrabold'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            📦 Yêu Cầu Đổi Quà Học Sinh ({redemptions.filter(r => r.status === 'PENDING').length} chờ duyệt)
          </button>
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'ITEMS'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-extrabold'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            🎁 Danh Mục Quà Tặng ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('CREATE')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'CREATE'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-extrabold'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            ➕ Thêm Vật Phẩm Mới
          </button>
        </div>

        {/* TAB 1: YÊU CẦU ĐỔI QUÀ HỌC SINH */}
        {activeTab === 'REDEMPTIONS' && (
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Danh Sách Yêu Cầu Đổi Quà</h2>

            {loading ? (
              <div className="py-12 text-center text-slate-400">Đang tải danh sách đơn đổi quà...</div>
            ) : redemptions.length === 0 ? (
              <p className="text-slate-400 py-8 text-center">Chưa có yêu cầu đổi quà nào từ học sinh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Mã Đơn</th>
                      <th className="py-3 px-4">Học Sinh</th>
                      <th className="py-3 px-4">Vật Phẩm Quà Tặng</th>
                      <th className="py-3 px-4">Số Kim Cương</th>
                      <th className="py-3 px-4">Ghi Chú Học Sinh</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Thao Tác Duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {redemptions.map((red) => (
                      <tr key={red.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">#{red.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {red.user_name || `Học sinh #${red.user_id}`}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-cyan-300">
                          {red.reward_item?.title || `Vật phẩm #${red.reward_item_id}`}
                        </td>
                        <td className="py-3.5 px-4 font-black text-amber-400">
                          {red.diamond_cost} 💎
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-300 max-w-xs italic">
                          {red.note || 'Không có'}
                        </td>
                        <td className="py-3.5 px-4">
                          {red.status === 'PENDING' && (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold px-2.5 py-1 rounded-full">
                              Chờ Duyệt
                            </span>
                          )}
                          {red.status === 'APPROVED' && (
                            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold px-2.5 py-1 rounded-full">
                              Đã Duyệt
                            </span>
                          )}
                          {red.status === 'DELIVERED' && (
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-2.5 py-1 rounded-full">
                              Đã Trao Quà
                            </span>
                          )}
                          {red.status === 'CANCELLED' && (
                            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold px-2.5 py-1 rounded-full">
                              Đã Hủy
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {red.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(red.id, 'APPROVED')}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(red.id, 'CANCELLED')}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow"
                              >
                                Hủy & Hoàn 💎
                              </button>
                            </>
                          )}
                          {red.status === 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateStatus(red.id, 'DELIVERED')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow"
                            >
                              Đã Trao Quà
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DANH MỤC QUÀ TẶNG */}
        {activeTab === 'ITEMS' && (
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Quản Lý Danh Mục Quà Tặng</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div className="flex gap-4">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-20 h-20 object-cover rounded-lg bg-slate-800" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-cyan-500/20 text-3xl flex items-center justify-center">🎁</div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                          {item.category}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.is_active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}>
                          {item.is_active ? 'Hiển thị' : 'Tạm ẩn'}
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-sm line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-amber-400 font-extrabold">{item.diamond_cost} 💎 Kim Cương</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Tồn kho:</span>
                      <input
                        type="number"
                        defaultValue={item.stock_quantity}
                        onBlur={(e) => handleUpdateStock(item.id, parseInt(e.target.value) || 0)}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white font-bold"
                      />
                    </div>

                    <button
                      onClick={() => handleToggleActive(item.id, item.is_active)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                        item.is_active ? 'bg-amber-600/80 hover:bg-amber-500 text-white' : 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {item.is_active ? 'Ẩn Quà' : 'Hiện Quà'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: THÊM VẬT PHẨM MỚI */}
        {activeTab === 'CREATE' && (
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ✨ Thêm Vật Phẩm Quà Tặng Mới
            </h2>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tên Vật Phẩm Quà Tặng *</label>
                <input
                  type="text"
                  required
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="VD: Sổ Tay Lò Xo Thông Minh, Bộ Bút Chì Màu..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mô Tả Quà Tặng</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Chi tiết vật phẩm quà tặng..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Số Kim Cương Quy Đổi (💎) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItem.diamond_cost}
                    onChange={(e) => setNewItem({ ...newItem, diamond_cost: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Số Lượng Khởi Tạo Trong Kho *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newItem.stock_quantity}
                    onChange={(e) => setNewItem({ ...newItem, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phân Loại</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Dụng cụ học tập">Dụng cụ học tập</option>
                    <option value="Huy hiệu danh dự">Huy hiệu danh dự</option>
                    <option value="Đồ dùng cá nhân">Đồ dùng cá nhân</option>
                    <option value="Vật phẩm cao cấp">Vật phẩm cao cấp</option>
                    <option value="Thẻ quà tặng">Thẻ quà tặng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Đường Dẫn Ảnh (URL Image)</label>
                  <input
                    type="text"
                    value={newItem.image_url}
                    onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('ITEMS')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500"
                >
                  Tạo Quà Tặng Mới
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
