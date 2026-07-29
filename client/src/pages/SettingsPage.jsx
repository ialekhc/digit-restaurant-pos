import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService, printerService, vendorService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import {
  buildReceiptSettingsFromVendor,
  getReceiptSettings,
  saveReceiptSettings
} from '../utils/receiptSettings';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

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

const printerPurposes = [
  { value: 'KITCHEN', label: 'Kitchen printer' },
  { value: 'BAR', label: 'Bar printer' },
  { value: 'SMOKE', label: 'Hookah printer' },
  { value: 'COUNTER', label: 'Reception printer' }
];

const defaultPrinterForm = {
  name: '',
  purpose: 'KITCHEN',
  printerSystemName: '',
  connectionType: 'SYSTEM',
  ipAddress: '',
  port: '',
  paperWidthMm: 58,
  copies: 1,
  isActive: true
};

const SettingsPage = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [receiptForm, setReceiptForm] = useState(() => getReceiptSettings());
  const [printers, setPrinters] = useState([]);
  const [printerForm, setPrinterForm] = useState(defaultPrinterForm);
  const [editingPrinterId, setEditingPrinterId] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema) });

  const loadPrinters = async () => {
    try {
      setPrinters(await printerService.list());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load printer settings');
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  useAutoRefresh(loadPrinters, { enabled: !editingPrinterId });

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

  const updateReceiptField = (field, value) => {
    setReceiptForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveReceiptForm = () => {
    const saved = saveReceiptSettings(receiptForm);
    setReceiptForm(saved);
    setMessage('Receipt content saved successfully');
    setError('');
  };

  const useVendorReceiptDetails = async () => {
    setError('');
    setMessage('');
    try {
      const data = await vendorService.mySubscription();
      const settings = buildReceiptSettingsFromVendor(data.vendor || {});
      const saved = saveReceiptSettings({ ...getReceiptSettings(), ...settings });
      setReceiptForm(saved);
      setMessage('Receipt content loaded from vendor profile');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load vendor profile for receipt');
    }
  };

  const savePrinter = async () => {
    setError('');
    setMessage('');
    try {
      const payload = {
        ...printerForm,
        paperWidthMm: Number(printerForm.paperWidthMm || 58),
        copies: Number(printerForm.copies || 1)
      };
      if (editingPrinterId) await printerService.update(editingPrinterId, payload);
      else await printerService.create(payload);
      setPrinterForm(defaultPrinterForm);
      setEditingPrinterId('');
      await loadPrinters();
      setMessage('Printer settings saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save printer');
    }
  };

  const editPrinter = (printer) => {
    setEditingPrinterId(printer._id);
    setPrinterForm({
      name: printer.name || '',
      purpose: printer.purpose || 'KITCHEN',
      printerSystemName: printer.printerSystemName || '',
      connectionType: printer.connectionType || 'SYSTEM',
      ipAddress: printer.ipAddress || '',
      port: printer.port || '',
      paperWidthMm: printer.paperWidthMm || 58,
      copies: printer.copies || 1,
      isActive: printer.isActive !== false
    });
  };

  const testPrinter = async (printer) => {
    setError('');
    setMessage('');
    try {
      await printerService.test(printer._id);
      setMessage(`Test print queued for ${printer.name}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to queue test print');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Receipt Content" subtitle="Edit the business details printed on bills and kitchen tickets">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Vendor / Restaurant Name"
            value={receiptForm.businessName}
            onChange={(e) => updateReceiptField('businessName', e.target.value)}
          />
          <Input
            label="Phone"
            value={receiptForm.phone}
            onChange={(e) => updateReceiptField('phone', e.target.value)}
          />
          <Input
            label="Address"
            value={receiptForm.address}
            onChange={(e) => updateReceiptField('address', e.target.value)}
          />
          <Input
            label="Email"
            value={receiptForm.email}
            onChange={(e) => updateReceiptField('email', e.target.value)}
          />
          <div className="md:col-span-2">
            <Input
              label="Receipt Footer"
              value={receiptForm.footerText}
              onChange={(e) => updateReceiptField('footerText', e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={saveReceiptForm}>Save Receipt Content</Button>
          <Button variant="secondary" onClick={useVendorReceiptDetails}>Use Vendor Name & Address</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          These details are saved on this device and will be used when printing customer bills and kitchen tickets.
        </p>
      </Panel>

      <Panel title="Printer Settings" subtitle="Assign a separate system printer to Kitchen, Bar, Hookah, and Reception">
        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-brand-100 bg-white/80 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Printer Name" value={printerForm.name} onChange={(e) => setPrinterForm((p) => ({ ...p, name: e.target.value }))} />
              <Select label="Purpose" value={printerForm.purpose} onChange={(e) => setPrinterForm((p) => ({ ...p, purpose: e.target.value }))} options={printerPurposes} />
              <Input label="System Printer Name" value={printerForm.printerSystemName} onChange={(e) => setPrinterForm((p) => ({ ...p, printerSystemName: e.target.value }))} helperText="Must match QZ Tray / OS printer name" />
              <Select
                label="Connection Type"
                value={printerForm.connectionType}
                onChange={(e) => setPrinterForm((p) => ({ ...p, connectionType: e.target.value }))}
                options={[
                  { value: 'SYSTEM', label: 'System / QZ printer' },
                  { value: 'NETWORK', label: 'Network printer' },
                  { value: 'QZ_TRAY', label: 'QZ Tray' },
                  { value: 'BROWSER', label: 'Browser fallback' }
                ]}
              />
              <Input label="IP Address" value={printerForm.ipAddress} onChange={(e) => setPrinterForm((p) => ({ ...p, ipAddress: e.target.value }))} />
              <Input label="Port" value={printerForm.port} onChange={(e) => setPrinterForm((p) => ({ ...p, port: e.target.value }))} />
              <Input label="Paper Width (mm)" type="number" value={printerForm.paperWidthMm} onChange={(e) => setPrinterForm((p) => ({ ...p, paperWidthMm: e.target.value }))} />
              <Input label="Copies" type="number" value={printerForm.copies} onChange={(e) => setPrinterForm((p) => ({ ...p, copies: e.target.value }))} />
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={printerForm.isActive} onChange={(e) => setPrinterForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Active printer route
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={savePrinter}>{editingPrinterId ? 'Update Printer' : 'Save Printer'}</Button>
              {editingPrinterId ? <Button variant="secondary" onClick={() => { setEditingPrinterId(''); setPrinterForm(defaultPrinterForm); }}>Cancel Edit</Button> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {printerPurposes.map((purpose) => {
              const printer = printers.find((row) => row.purpose === purpose.value);
              const configured = Boolean(printer);
              return (
                <div key={purpose.value} className="rounded-2xl border border-brand-100 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{purpose.label}</p>
                      <p className="text-xs text-slate-500">{printer?.printerSystemName || 'No system printer selected'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${configured && printer.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {configured ? (printer.isActive ? 'Connected' : 'Disconnected') : 'Not configured'}
                    </span>
                  </div>
                  {printer?.lastError ? <p className="mt-2 text-xs text-rose-600">{printer.lastError}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {printer ? <Button size="sm" variant="secondary" onClick={() => editPrinter(printer)}>Edit</Button> : null}
                    {printer ? <Button size="sm" onClick={() => testPrinter(printer)}>Test Print</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

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
