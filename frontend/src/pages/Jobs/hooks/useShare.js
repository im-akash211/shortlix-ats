import { useState, useRef, useEffect } from 'react';
import { usersApi, candidateShareApi } from '../services/jobsApi';

export function useShare() {
  const [shareOpen, setShareOpen]           = useState(null);
  const [shareSearch, setShareSearch]       = useState('');
  const [shareSelected, setShareSelected]   = useState([]);
  const [shareToast, setShareToast]         = useState(null);
  const shareRef                            = useRef(null);
  const [usersList, setUsersList]           = useState([]);
  const [usersLoading, setUsersLoading]     = useState(false);

  useEffect(() => {
    if (!shareOpen) return;
    if (usersList.length === 0) {
      setUsersLoading(true);
      usersApi.dropdown()
        .then((res) => setUsersList(Array.isArray(res) ? res : (res.results || [])))
        .catch(console.error)
        .finally(() => setUsersLoading(false));
    }
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShareOpen(null); setShareSearch(''); setShareSelected([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  const openShare = (candidateId) => {
    setShareOpen(candidateId);
    setShareSearch('');
    setShareSelected([]);
  };

  // Allows external callers (e.g. schedule modal) to pre-load the users list
  const ensureUsersLoaded = () => {
    if (usersList.length === 0 && !usersLoading) {
      setUsersLoading(true);
      usersApi.dropdown()
        .then((res) => setUsersList(Array.isArray(res) ? res : (res.results || [])))
        .catch(console.error)
        .finally(() => setUsersLoading(false));
    }
  };

  const handleShare = async (candidateId) => {
    const count = shareSelected.length;
    try {
      await candidateShareApi.share(candidateId, shareSelected);
      setShareToast(`Profile shared with ${count} user${count > 1 ? 's' : ''} successfully`);
      setTimeout(() => setShareToast(null), 3000);
    } catch (err) {
      console.error('Share failed', err);
    }
    setShareOpen(null); setShareSearch(''); setShareSelected([]);
  };

  return {
    shareOpen, setShareOpen,
    shareSearch, setShareSearch,
    shareSelected, setShareSelected,
    shareToast, setShareToast,
    shareRef,
    usersList,
    usersLoading,
    openShare,
    ensureUsersLoaded,
    handleShare,
  };
}
