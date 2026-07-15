import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * useApi — lightweight wrapper for API calls with loading/error state
 */
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall, options = {}) => {
    const {
      onSuccess,
      onError,
      successMessage,
      showErrorToast = true,
    } = options;

    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      if (successMessage) toast.success(successMessage);
      if (onSuccess) onSuccess(response.data);
      return response.data;
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'An error occurred';
      setError(message);
      if (showErrorToast) toast.error(message);
      if (onError) onError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute };
};
