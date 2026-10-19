import { X } from 'lucide-react';

interface RevokeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  device: string;
  isProcessing: boolean;
}

export function RevokeSessionModal({ isOpen, onClose, onConfirm, userName, device, isProcessing }: RevokeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Revoke session</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Revoke <span className="font-semibold text-slate-900 dark:text-slate-100">{userName}</span>'s session on <span className="font-semibold text-slate-900 dark:text-slate-100">{device}</span>? 
          They will need to sign in again.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isProcessing ? 'Revoking...' : 'Revoke session'}
          </button>
        </div>
      </div>
    </div>
  );
}
