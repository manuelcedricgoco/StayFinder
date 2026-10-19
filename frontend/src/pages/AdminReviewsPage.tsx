import { useState } from 'react';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { RatingStars } from '../components/ui/RatingStars';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';

interface AdminReview {
  id: string;
  rating: number;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  boarder: { name: string };
  property: { id: string; name: string; owner: { name: string } };
}

interface ReviewsResponse { status: 'ok'; reviews: AdminReview[] }

export function AdminReviewsPage() {
  const [filter, setFilter] = useState('PENDING');
  const path = `/admin/reviews${filter ? `?status=${filter}` : ''}`;
  const { state, reload } = useApiResource<ReviewsResponse>(path);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  async function moderate(review: AdminReview, status: 'APPROVED' | 'REJECTED') {
    setError('');
    setSavingId(review.id);
    try {
      await apiRequest('PATCH', `/admin/reviews/${encodeURIComponent(review.id)}/status`, { status });
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not moderate this review.');
    } finally {
      setSavingId(null);
      setSelectedReview(null);
      setIsApproveModalOpen(false);
      setIsRejectModalOpen(false);
    }
  }

  function openApproveModal(review: AdminReview) {
    setSelectedReview(review);
    setIsApproveModalOpen(true);
  }

  function openRejectModal(review: AdminReview) {
    setSelectedReview(review);
    setIsRejectModalOpen(true);
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Review moderation</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Only approved reviews are published.</p></div>
        <FilterDropdown
          options={[
            { label: 'All', value: '' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Rejected', value: 'REJECTED' }
          ]}
          selected={filter}
          onSelect={setFilter}
        />
      </div>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {state.status === 'loading' && <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading reviews…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-300">{state.message}</p>}
      {state.status === 'success' && state.data.reviews.length === 0 && <p className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-300">No reviews match this status.</p>}
      {state.status === 'success' && <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {state.data.reviews.map((review) => (
        <li key={review.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{review.property.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">By {review.boarder.name} · Owner {review.property.owner.name}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <RatingStars rating={review.rating} /><span className="text-slate-600 dark:text-slate-300">· {review.status}</span>
              </span>
            </div>
            <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{review.content}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(review.createdAt).toLocaleString()}</p>
            {review.status === 'PENDING' && <div className="flex flex-wrap gap-2"><button disabled={savingId === review.id} onClick={() => openApproveModal(review)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Approve</button><button disabled={savingId === review.id} onClick={() => openRejectModal(review)} className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-400 disabled:opacity-60">Reject</button></div>}
          </div>
        </li>
      ))}</ul>}
      {selectedReview && (
        <>
          <ConfirmationModal
            isOpen={isApproveModalOpen}
            onClose={() => setIsApproveModalOpen(false)}
            onConfirm={() => moderate(selectedReview, 'APPROVED')}
            title="Approve Review"
            description={`Are you sure you want to approve the review by ${selectedReview.boarder.name} for ${selectedReview.property.name}?`}
            confirmLabel="Approve"
            isProcessing={savingId === selectedReview.id}
          />
          <ConfirmationModal
            isOpen={isRejectModalOpen}
            onClose={() => setIsRejectModalOpen(false)}
            onConfirm={() => moderate(selectedReview, 'REJECTED')}
            title="Reject Review"
            description={`Are you sure you want to reject the review by ${selectedReview.boarder.name} for ${selectedReview.property.name}?`}
            confirmLabel="Reject"
            isProcessing={savingId === selectedReview.id}
          />
        </>
      )}
    </section>
  );
}
