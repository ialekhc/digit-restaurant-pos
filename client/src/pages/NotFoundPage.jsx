import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold text-slate-800">404</h1>
      <p className="mt-2 text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/dashboard" className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-white">
        Go to Dashboard
      </Link>
    </div>
  );
};

export default NotFoundPage;
