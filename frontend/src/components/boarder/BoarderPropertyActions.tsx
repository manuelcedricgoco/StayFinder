import { useEffect, useState, type FormEvent } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, apiRequest } from '../../lib/api';

interface FavoriteResponse {
  favorites: { property: { id: string } }[];
}

const controlClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';

export function BoarderPropertyActions({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const { user, isLoading } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inquiry, setInquiry] = useState('');
  const [rating, setRating] = useState('5');
  const [review, setReview] = useState('');
  const [reportReason, setReportReason] = useState('FAKE_PROPERTY');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'BOARDER') return;
    let active = true;
    apiRequest<FavoriteResponse>('GET', '/boarder/favorites')
      .then((response) => {
        if (active) setIsFavorite(response.favorites.some((favorite) => favorite.property.id === propertyId));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason.message : 'Could not check saved properties.');
      });
    return () => {
      active = false;
    };
  }, [user, propertyId]);

  if (isLoading) return null;
  if (!user) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Interested in this place?</h2>
        <p className="mt-2 text-sm text-slate-600">Log in as a boarder to save this listing, inquire, review, or report it.</p>
        <Link
          to="/login"
          className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          Log in
        </Link>
      </section>
    );
  }
  if (user.role !== 'BOARDER') return null;

  async function runAction(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(success);
      return true;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The request could not be completed.');
      return false;
    }
  }

  async function toggleFavorite() {
    setLoadingFavorite(true);
    const succeeded = await runAction(
      () => apiRequest(
        isFavorite ? 'DELETE' : 'POST',
        `/boarder/favorites/${encodeURIComponent(propertyId)}`,
      ),
      isFavorite ? 'Property removed from saved properties.' : 'Property saved.',
    );
    if (succeeded) setIsFavorite(!isFavorite);
    setLoadingFavorite(false);
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const succeeded = await runAction(
      () => apiRequest('POST', '/boarder/inquiries', { propertyId, message: inquiry }),
      'Inquiry sent. You can track the response in your inquiries.',
    );
    if (succeeded) setInquiry('');
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const succeeded = await runAction(
      () => apiRequest('POST', `/boarder/properties/${encodeURIComponent(propertyId)}/reviews`, {
        rating: Number(rating),
        content: review,
      }),
      'Review submitted for moderation.',
    );
    if (succeeded) setReview('');
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const succeeded = await runAction(
      () => apiRequest('POST', `/boarder/properties/${encodeURIComponent(propertyId)}/reports`, {
        reason: reportReason,
        details: reportDetails,
      }),
      'Report submitted for review.',
    );
    if (succeeded) setReportDetails('');
  }

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Interested in this place?</h2>
          <p className="mt-1 text-sm text-slate-600">Save it or send a message to the owner.</p>
        </div>
        <button
          type="button"
          disabled={loadingFavorite}
          onClick={toggleFavorite}
          className="rounded-lg border border-emerald-700 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          {loadingFavorite ? (
            'Saving…'
          ) : (
            <>
              <Heart
                className="mr-1 inline h-4 w-4"
                fill={isFavorite ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              {isFavorite ? 'Saved' : 'Save property'}
            </>
          )}
        </button>
      </div>

      {(message || error) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {error || message}
        </p>
      )}

      <form onSubmit={submitInquiry} className="border-t border-slate-100 pt-5">
        <label className="block text-sm font-medium text-slate-700" htmlFor="inquiry-message">
          Message the owner about {propertyName}
        </label>
        <textarea
          id="inquiry-message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          value={inquiry}
          onChange={(event) => setInquiry(event.target.value)}
          className={controlClass}
          placeholder="Introduce yourself and ask about availability, viewing, or other details."
        />
        <button type="submit" className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">
          Send inquiry
        </button>
      </form>

      <div className="grid gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
        <form onSubmit={submitReview}>
          <h3 className="font-semibold text-slate-900">Leave a review</h3>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="review-rating">Rating</label>
          <select id="review-rating" className={controlClass} value={rating} onChange={(event) => setRating(event.target.value)}>
            {[5, 4, 3, 2, 1].map((stars) => <option key={stars} value={stars}>{stars} {stars === 1 ? 'star' : 'stars'}</option>)}
          </select>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="review-content">Review</label>
          <textarea
            id="review-content"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={review}
            onChange={(event) => setReview(event.target.value)}
            className={controlClass}
            placeholder="Share useful, respectful information about this property."
          />
          <p className="mt-2 text-xs text-slate-500">Reviews are held for moderation before publication. One review per property.</p>
          <button type="submit" className="mt-3 rounded-lg border border-emerald-700 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50">
            Submit review
          </button>
        </form>

        <form onSubmit={submitReport}>
          <h3 className="font-semibold text-slate-900">Report this listing</h3>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="report-reason">Reason</label>
          <select id="report-reason" className={controlClass} value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
            <option value="FAKE_PROPERTY">Fake property</option>
            <option value="SCAM">Scam</option>
            <option value="INCORRECT_INFORMATION">Incorrect information</option>
            <option value="INAPPROPRIATE_CONTENT">Inappropriate content</option>
            <option value="PROPERTY_UNAVAILABLE">Property unavailable</option>
            <option value="OTHER">Other</option>
          </select>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="report-details">
            Details (optional)
          </label>
          <textarea
            id="report-details"
            maxLength={1000}
            rows={3}
            value={reportDetails}
            onChange={(event) => setReportDetails(event.target.value)}
            className={controlClass}
            placeholder="Add details to help moderators investigate."
          />
          <button type="submit" className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50">
            Submit report
          </button>
        </form>
      </div>
    </section>
  );
}
