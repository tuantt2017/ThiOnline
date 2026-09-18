'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { RewardItem, GiftRedemption, DiamondTransaction, RewardBalance } from '@/types';

export default function StudentRewardsPage() {
  const [balance, setBalance] = useState<RewardBalance | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [transactions, setTransactions] = useState<DiamondTransaction[]>([]);
  const [redemptions, setRedemptions] = useState<GiftRedemption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'SHOP' | 'HISTORY'>('SHOP');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Redemption Modal State
  const [selectedItem, setSelectedItem] = useState<RewardItem | null>(null);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [balData, itemsData, historyData] = await Promise.all([
        api.getRewardBalance(),
        api.getRewardItems(),
        api.getStudentRewardHistory(),
      ]);
      setBalance(balData);
      setItems(itemsData);
      setTransactions(historyData.transactions);
      setRedemptions(historyData.redemptions);
    } catch (err: any) {
      console.error('Error fetching rewards data:', err);
      setError(err.message || 'Không thể tải dữ liệu quà tặng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(items.map((item) => item.category)))];

  const filteredItems = selectedCategory === 'ALL'
    ? items
    : items.filter((item) => item.category === selectedCategory);

  const handleRedeem = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setError(null);

    try {
      await api.redeemRewardItem(selectedItem.id, note);
      setSuccessMsg(`🎉 Đổi thành công quà: "${selectedItem.title}"! Đơn đổi quà đã được chuyển tới Thầy Cô để trao cho bạn.`);
      setSelectedItem(null);
      setNote('');
      // Refresh balance and history
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Đổi quà không thành công. Vui lòng kiểm tra lại số dư kim cương.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Top Header & Navigation */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/student/english"
                className="text-xs font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                &larr; Góc Học Sinh
              </Link>
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-amber-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent mt-1">
              💎 Cửa Hàng Quà Tặng & Đổi Kim Cương
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Tích lũy kim cương từ bài thi điểm cao (≥9đ được 2💎) & ôn luyện AI (được 1💎) để đổi lấy quà tặng hấp dẫn!
            </p>
          </div>

          {/* Diamond Wallet Badge */}
          <div className="bg-gradient-to-br from-indigo-900/90 via-purple-900/80 to-slate-900 border border-cyan-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center gap-4 min-w-[240px]">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-3xl shadow-inner animate-pulse">
              💎
            </div>
            <div>
              <p className="text-xs font-semibold text-cyan-300 tracking-wider uppercase">Ví Kim Cương</p>
              <div className="text-3xl font-black text-white flex items-baseline gap-1">
                {balance ? balance.diamond_balance : 0}
                <span className="text-xs font-normal text-slate-300">💎</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Đã tích lũy: <strong className="text-cyan-300">{balance?.total_earned || 0}💎</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Alert Notifications */}
        {successMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <span>{successMsg}</span>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('SHOP')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'SHOP'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              🎁 Cửa Hàng Quà Tặng
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'HISTORY'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              📜 Lịch Sử Đổi Quà & Thưởng 💎
            </button>
          </div>
        </div>

        {/* TAB 1: CỬA HÀNG QUÀ TẶNG */}
        {activeTab === 'SHOP' && (
          <div className="space-y-6">

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat === 'ALL' ? 'Tất cả quà tặng' : cat}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-20 text-center text-slate-400">
                <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
                <p>Đang tải danh sách quà tặng hấp dẫn...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-slate-800/40 rounded-2xl p-12 text-center text-slate-400 border border-slate-700/50">
                <p className="text-lg font-semibold">Hiện chưa có quà tặng trong mục này.</p>
                <p className="text-sm mt-1">Hãy quay lại sau hoặc làm bài thi để tích lũy thêm kim cương nhé!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredItems.map((item) => {
                  const canAfford = (balance?.diamond_balance || 0) >= item.diamond_cost;
                  const isOutOfStock = item.stock_quantity <= 0;

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 flex flex-col group"
                    >
                      {/* Image container */}
                      <div className="relative h-48 bg-slate-900 overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-slate-800 to-slate-900 text-cyan-400">
                            🎁
                          </div>
                        )}
                        <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700 text-cyan-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                          {item.category}
                        </span>
                        {isOutOfStock && (
                          <span className="absolute top-3 right-3 bg-rose-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                            Tạm Hết Hàng
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <h3 className="font-bold text-white text-base group-hover:text-cyan-300 transition-colors line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                            {item.description || 'Quà tặng rực rỡ dành cho học sinh chăm chỉ!'}
                          </p>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-slate-700/60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-cyan-300 font-extrabold text-lg">
                              <span>💎</span>
                              <span>{item.diamond_cost}</span>
                              <span className="text-xs font-normal text-slate-400">Kim Cương</span>
                            </div>
                            <span className="text-xs text-slate-400">
                              Còn: <strong className="text-slate-200">{item.stock_quantity}</strong>
                            </span>
                          </div>

                          <button
                            disabled={!canAfford || isOutOfStock}
                            onClick={() => setSelectedItem(item)}
                            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                              isOutOfStock
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : canAfford
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20 active:scale-95'
                                : 'bg-slate-700/70 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isOutOfStock
                              ? 'Hết Hàng'
                              : canAfford
                              ? '🎁 Đổi Quà Ngay'
                              : `Thiếu ${item.diamond_cost - (balance?.diamond_balance || 0)}💎`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LỊCH SỬ ĐỔI QUÀ & THƯỞNG KIM CƯƠNG */}
        {activeTab === 'HISTORY' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Redemptions History */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                🎁 Đơn Đổi Quà Đã Đăng Ký
              </h2>
              {redemptions.length === 0 ? (
                <p className="text-slate-400 text-sm py-4">Bạn chưa đăng ký đổi phần quà nào.</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {redemptions.map((red) => (
                    <div
                      key={red.id}
                      className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-cyan-300">
                          {red.reward_item?.title || `Vật phẩm #${red.reward_item_id}`}
                        </h4>
                        <p className="text-xs text-slate-400">
                          Trừ {red.diamond_cost} 💎 • Ngày đổi: {new Date(red.created_at).toLocaleDateString('vi-VN')}
                        </p>
                        {red.note && (
                          <p className="text-[11px] text-slate-400 italic">
                            Ghi chú: {red.note}
                          </p>
                        )}
                      </div>

                      <div>
                        {red.status === 'PENDING' && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold px-3 py-1 rounded-full">
                            ⏳ Chờ Duyệt
                          </span>
                        )}
                        {red.status === 'APPROVED' && (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold px-3 py-1 rounded-full">
                            👍 Đã Duyệt
                          </span>
                        )}
                        {red.status === 'DELIVERED' && (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-3 py-1 rounded-full">
                            🎉 Đã Trao Quà
                          </span>
                        )}
                        {red.status === 'CANCELLED' && (
                          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold px-3 py-1 rounded-full">
                            ❌ Đã Hủy (Đã Hoàn 💎)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diamond Transactions History */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                💎 Nhật Ký Biến Động Kim Cương
              </h2>
              {transactions.length === 0 ? (
                <p className="text-slate-400 text-sm py-4">Chưa có lịch sử biến động kim cương.</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3.5 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{tx.description}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(tx.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>

                      <div className={`text-base font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 💎
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* CONFIRMATION MODAL FOR REDEMPTION */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                🎁 Xác Nhận Đổi Quà Tặng
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              {selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-cyan-500/20 text-3xl flex items-center justify-center">🎁</div>
              )}
              <div>
                <h4 className="font-bold text-white text-sm">{selectedItem.title}</h4>
                <p className="text-xs text-cyan-300 font-bold mt-1">Chi phí: {selectedItem.diamond_cost} 💎 Kim Cương</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ghi chú địa chỉ / Lớp học (để Thầy Cô trao quà):
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Em ở Lớp 5A1, nhờ Thầy/Cô trao quà tại phòng học ạ."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                rows={3}
              />
            </div>

            <div className="bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-xl text-[11px] text-cyan-200">
              💡 Sau khi xác nhận, hệ thống sẽ trừ <strong>{selectedItem.diamond_cost} 💎</strong> trong ví của bạn. Số dư còn lại: <strong>{(balance?.diamond_balance || 0) - selectedItem.diamond_cost} 💎</strong>.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Hủy Bỏ
              </button>
              <button
                disabled={submitting}
                onClick={handleRedeem}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20"
              >
                {submitting ? 'Đang Xử Lý...' : 'Xác Nhận Đổi Quà'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
