import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { ROLE_LOGIN_PRESETS, ROLES, getDefaultRouteForRole } from '../utils/constants';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const loginPresets = ROLE_LOGIN_PRESETS.filter((preset) => preset.role !== ROLES.SUPER_ADMIN);
  const [selectedRole, setSelectedRole] = useState(loginPresets[0]?.role || '');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: loginPresets[0]?.email || '',
      password: loginPresets[0]?.password || ''
    }
  });

  const onSubmit = async (values) => {
    setError('');
    try {
      const response = await login(values);
      navigate(location.state?.from || getDefaultRouteForRole(response?.user?.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const useRolePreset = (preset) => {
    setSelectedRole(preset.role);
    setValue('email', preset.email, { shouldValidate: true, shouldDirty: true });
    setValue('password', preset.password, { shouldValidate: true, shouldDirty: true });
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg shadow-slate-300/30 lg:grid lg:grid-cols-5">
        <div className="bg-slate-50 p-5 sm:p-6 lg:col-span-2 lg:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Restaurant RMS</h1>
          <p className="mt-2 text-sm text-slate-600">Choose a role preset and continue with one tap.</p>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
            {loginPresets.map((preset) => (
              <button
                key={preset.role}
                type="button"
                onClick={() => useRolePreset(preset)}
                className={`min-w-[190px] rounded-2xl border px-4 py-3 text-left transition lg:min-w-0 lg:w-full ${
                  selectedRole === preset.role
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{preset.label}</p>
                <p className="text-xs text-slate-600">{preset.description}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{preset.email}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6 lg:col-span-3 lg:p-8">
          <h2 className="font-display text-2xl font-bold text-slate-900">Sign In</h2>
          <p className="mt-1 text-sm text-slate-600">Use your account credentials to continue.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input label="Email" type="email" placeholder="name@example.com" {...register('email')} error={errors.email?.message} />
            <Input label="Password" type="password" placeholder="********" {...register('password')} error={errors.password?.message} />

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
