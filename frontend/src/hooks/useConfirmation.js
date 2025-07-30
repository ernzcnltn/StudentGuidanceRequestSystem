import { useState } from 'react';

export const useConfirmation = () => {
  const [confirmationState, setConfirmationState] = useState({
    show: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    requireTextConfirmation: false,
    confirmationText: 'DELETE',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const showConfirmation = ({
    title,
    message,
    type = 'danger',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    requireTextConfirmation = false,
    confirmationText = 'DELETE',
    onConfirm = () => {},
    onCancel = () => {}
  }) => {
    return new Promise((resolve) => {
      setConfirmationState({
        show: true,
        title,
        message,
        type,
        confirmText,
        cancelText,
        requireTextConfirmation,
        confirmationText,
        onConfirm: () => {
          setConfirmationState(prev => ({ ...prev, show: false }));
          onConfirm();
          resolve(true);
        },
        onCancel: () => {
          setConfirmationState(prev => ({ ...prev, show: false }));
          onCancel();
          resolve(false);
        }
      });
    });
  };

  const hideConfirmation = () => {
    setConfirmationState(prev => ({ ...prev, show: false }));
  };

  return {
    confirmationState,
    showConfirmation,
    hideConfirmation
  };
};