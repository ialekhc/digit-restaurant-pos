import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const schema = z
  .object({
    oldPassword: z.string().min(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6)
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

const SettingsPage = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setError('');
    setMessage('');

    try {
      await authService.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });

      setMessage('Password changed successfully');
      reset();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to change password');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Settings" subtitle="Manage account settings">
        <form className="max-w-lg space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Old Password" type="password" {...register('oldPassword')} error={errors.oldPassword?.message} />
          <Input label="New Password" type="password" {...register('newPassword')} error={errors.newPassword?.message} />
          <Input label="Confirm New Password" type="password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />

          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Change Password'}</Button>
        </form>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </Panel>
    </div>
  );
};

export default SettingsPage;
