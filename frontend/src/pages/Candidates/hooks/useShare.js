import { useState, useRef, useEffect } from 'react';
import { candidateShareApi, usersApi } from '../services/candidatesApi';

export function useShare() {
  const [shareOpen, setShareOpen]         = useState(null);
  const [sharePos, setSharePos]           = useState({ top: 0, left: 0 });
  const [shareSearch, setShareSearch]     = useState('');
  const [shareSelected, setShareSelected] = useState([]);
  const [usersList, setUsersList]         = useState([]);
  const [usersLoading, setUsersLoading]   = useState(false);
  const [shareToast, setShareToast]       = useState(null);
  const shareRef                          = useRef(null);

  const openShare = (e, candidateId) => {
    setShareOpen(candidateId);
    setShareSearch('');
    setShareSelected([]);
  };

  useEffect(() => {
    if (!shareOpen) return;
    if (usersList.length === 0) {
      setUsersLoading(true);
      usersApi.dropdown()
        .then(res => setUsersList(Array.isArray(res) ? res : (res.results || [])))
        .catch(console.error)
        .finally(() => setUsersLoading(false));
    }
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShareOpen(null);
        setShareSearch('');
        setShareSelected([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  const handleShare = async () => {
    const count = shareSelected.length;
    try {
      await candidateShareApi.share(shareOpen, shareSelected);
      setShareToast(`Profile shared with ${count} user${count > 1 ? 's' : ''} successfully`);
      setTimeout(() => setShareToast(null), 3000);
    } catch (err) {
      console.error(err);
    }
    setShareOpen(null);
    setShareSearch('');
    setShareSelected([]);
  };

  return {
    shareOpen,
    setShareOpen,
    sharePos,
    shareSearch,
    setShareSearch,
    shareSelected,
    setShareSelected,
    usersList,
    usersLoading,
    shareToast,
    shareRef,
    openShare,
    handleShare,
  };
}
