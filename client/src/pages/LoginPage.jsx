import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { ROLE_LOGIN_PRESETS, getDefaultRouteForRole } from '../utils/constants';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(ROLE_LOGIN_PRESETS[0].role);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: ROLE_LOGIN_PRESETS[0].email,
      password: ROLE_LOGIN_PRESETS[0].password
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 via-white to-slate-100 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 lg:grid lg:grid-cols-5">
        <div className="bg-slate-950 p-6 text-white lg:col-span-2 lg:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Restaurant RMS</h1>
          <p className="mt-2 text-sm text-slate-300">Choose your role and login quickly with the matching account.</p>
          <div className="mt-6 space-y-2">
            {ROLE_LOGIN_PRESETS.map((preset) => (
              <button
                key={preset.role}
                type="button"
                onClick={() => useRolePreset(preset)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedRole === preset.role
                    ? 'border-brand-400 bg-brand-500/20'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-semibold">{preset.label}</p>
                <p className="text-xs text-slate-300">{preset.description}</p>
                <p className="mt-1 text-xs text-slate-400">{preset.email}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 lg:col-span-3 lg:p-8">
          <h2 className="text-2xl font-bold text-slate-900">Login</h2>
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
