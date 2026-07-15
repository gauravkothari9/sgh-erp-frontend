import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';
import { Spinner } from './LoadingSpinner';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
  children,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn ${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          >
            {loading ? <Spinner size="sm" /> : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          {children}
        </div>
      </div>
    </Modal>
  );
}
