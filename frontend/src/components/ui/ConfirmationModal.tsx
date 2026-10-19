import { X } from 'lucide-react';
import { useState } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (input?: string) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isProcessing: boolean;
  withInput?: boolean;
  inputLabel?: string;
}

export function ConfirmationModal({ 
  isOpen, onClose, onConfirm, title, description, confirmLabel, isProcessing, withInput, inputLabel 
}: ConfirmationModalProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{description}</p>

        {withInput && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{inputLabel}</label>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              rows={3}
            />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(withInput ? inputValue : undefined)}
            disabled={isProcessing || (withInput && inputValue.trim().length < 5)}
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
