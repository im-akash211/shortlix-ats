import { useNavigate } from 'react-router-dom';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-7xl font-bold text-gray-200">403</div>
      <h1 className="text-2xl font-semibold text-gray-700">Access Denied</h1>
      <p className="text-gray-500 max-w-sm">
        You don't have permission to view this page. Contact your admin if you think this is a
        mistake.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
