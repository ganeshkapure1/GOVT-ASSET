'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckCircleIcon } from '@/components/ui/icons';

export interface FeedbackCardProps {
  complaintId: string;
  referenceNumber: string;
  status: string;
  initialRating?: number | null;
  initialFeedbackText?: string | null;
  onFeedbackSubmitted?: (feedback: { rating: number; feedbackText?: string | null }) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor / Unsatisfactory',
  2: 'Fair / Needs Improvement',
  3: 'Average / Acceptable',
  4: 'Good / Well Executed',
  5: 'Excellent / Exceeded SLA',
};

export function FeedbackCard({
  complaintId,
  referenceNumber: _referenceNumber,
  status,
  initialRating = null,
  initialFeedbackText = null,
  onFeedbackSubmitted,
}: FeedbackCardProps) {
  const [rating, setRating] = useState<number>(initialRating || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState(initialFeedbackText || '');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(Boolean(initialRating));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if existing feedback exists from API on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchExistingFeedback() {
      if (initialRating) return;
      try {
        const res = await fetch(`/api/v1/complaints/${complaintId}/feedback`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            setRating(json.data.rating);
            setFeedbackText(json.data.feedbackText || '');
            setIsSubmitted(true);
          }
        }
      } catch {
        // Silently ignore if offline or unauthenticated
      }
    }

    if (['VERIFIED_RESOLVED', 'CLOSED'].includes(status)) {
      fetchExistingFeedback();
    }
    return () => {
      isMounted = false;
    };
  }, [complaintId, status, initialRating]);

  // Feedback is only permissible for resolved or closed grievances
  const isEligibleStatus = ['VERIFIED_RESOLVED', 'CLOSED'].includes(status);
  if (!isEligibleStatus) {
    return null;
  }

  const activeRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMessage('Please select a rating between 1 and 5 stars.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedbackText: feedbackText.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setIsSubmitted(true);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted({
            rating,
            feedbackText: feedbackText.trim() || null,
          });
        }
      } else {
        setErrorMessage(json?.error?.message || 'Failed to record feedback.');
      }
    } catch {
      setErrorMessage('Network error while recording your feedback. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/95 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-subtle transition-all space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-[#0B4FC2] dark:text-blue-400 uppercase tracking-wider block">
            Resolution Quality Feedback
          </span>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            How satisfied are you with the civic maintenance?
          </h3>
        </div>
        {isSubmitted && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>Feedback Submitted</span>
          </span>
        )}
      </div>

      {isSubmitted ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-lg ${star <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {rating}/5 — {RATING_LABELS[rating] || 'Satisfactory'}
            </span>
          </div>
          {feedbackText && (
            <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-1 border-t border-slate-200/60 dark:border-slate-700">
              &ldquo;{feedbackText}&rdquo;
            </p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Thank you for helping the municipal corporation maintain accountability.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Interactive 5-Star Rating Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Rating (1 to 5 Stars) <span className="text-rose-600">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Resolution Quality Rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`Rate ${star} of 5 stars (${RATING_LABELS[star]})`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    disabled={isLoading}
                    className="p-1 rounded-lg text-2xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#0B4FC2]"
                  >
                    <span className={star <= activeRating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              {activeRating > 0 && (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                  {RATING_LABELS[activeRating]}
                </span>
              )}
            </div>
          </div>

          {/* Optional Comments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="feedback-comment" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Additional Comments (Optional)
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {feedbackText.length}/500 chars
              </span>
            </div>
            <textarea
              id="feedback-comment"
              rows={3}
              maxLength={500}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us about the speed of response, road finish quality, or civility of maintenance crew..."
              className="w-full text-xs p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#0B4FC2] focus:outline-none transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={rating === 0 || isLoading}
              className="font-bold min-w-[120px]"
            >
              {isLoading ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
