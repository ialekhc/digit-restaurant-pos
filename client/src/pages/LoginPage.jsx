import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { getDefaultRouteForRole } from '../utils/constants';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const featureCards = [
  {
    title: 'QR Menu',
    text: 'Let guests scan a table QR, browse items, and place orders without waiting.'
  },
  {
    title: 'Table Flow',
    text: 'Color-coded tables, active order view, table transfer, and table-based billing.'
  },
  {
    title: 'Kitchen Display',
    text: 'Separate queues for Food, Bar, Smoke, and Overall order preparation.'
  },
  {
    title: 'Billing',
    text: 'NPR billing, clean POS receipt layout, payment history, credit records, and Excel export.'
  },
  {
    title: 'Inventory',
    text: 'Track stock, purchase in, purchase out, low-stock alerts, suppliers, and daily usage.'
  },
  {
    title: 'Reports',
    text: 'Daily, weekly, monthly, and yearly sales reports with operational insights.'
  }
];

const workflowSteps = [
  'Table selected',
  'Order placed',
  'Kitchen prepares',
  'Ready and served',
  'Bill and payment'
];

const benefits = [
  ['Subscription SaaS', 'Plans control features, staff limits, branches, and vendor access.'],
  ['Role-Based Screens', 'Each team member sees only the tools needed for their work.'],
  ['Owner Visibility', 'Sales, vendors, subscription income, and staff activity in one place.']
];

const faqs = [
  ['Can waiters add more orders to the same table?', 'Yes. Staff can view a table order, add more items, and send new items to kitchen.'],
  ['Can billing search by table or order number?', 'Yes. Cashier billing supports both table number and order number workflows.'],
  ['Is tax required?', 'No. The current setup uses NPR pricing without tax/VAT in billing.']
];

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: ''
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

  return (
    <div className="min-h-screen bg-[#fffef8] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-9rem] top-[-7rem] h-96 w-96 rounded-full bg-brand-200/55 blur-3xl" />
        <div className="absolute right-[-8rem] top-28 h-[26rem] w-[26rem] rounded-full bg-brand-100/80 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-aqua-100/90 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-brand-100/80 bg-[#fffef8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-aqua-400 text-sm font-black text-white shadow-lg shadow-brand-200">
              D
            </span>
            <span>
              <span className="block font-display text-base font-extrabold leading-4 text-slate-950">Digit POS</span>
              <span className="text-xs font-semibold text-brand-700">Subscription Restaurant Cloud</span>
            </span>
          </a>

          <nav className="hidden items-center gap-5 text-sm font-bold text-slate-600 lg:flex">
            <a className="hover:text-brand-700" href="#features">Features</a>
            <a className="hover:text-brand-700" href="#workflow">Workflow</a>
            <a className="hover:text-brand-700" href="#pricing">Subscriptions</a>
            <a className="hover:text-brand-700" href="#faq">FAQs</a>
          </nav>

          <a
            href="#login"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700"
          >
            Login
          </a>
        </div>
      </header>

      <main id="top" className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8 lg:py-10">
        <section className="space-y-8">
          <div className="grid min-h-[520px] items-center gap-8 rounded-[2rem] border border-brand-100 bg-white/85 p-5 shadow-sm shadow-brand-100/70 sm:p-8 lg:grid-cols-[1fr_0.82fr]">
            <div>
              <div className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-brand-800">
                Subscription-Based Restaurant SaaS
              </div>
              <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                One cloud workspace for every restaurant operation.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-600 sm:text-lg">
                Digit POS is a subscription platform for restaurants that need table service, kitchen routing,
                NPR billing, inventory, reports, vendor subscriptions, and staff access in one clean system.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#login"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-600 to-aqua-500 px-5 text-sm font-black text-white shadow-xl shadow-brand-200 transition hover:scale-[1.01]"
                >
                  Staff login
                </a>
                <a
                  href="#features"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand-200 bg-white px-5 text-sm font-black text-brand-800 transition hover:bg-brand-50"
                >
                  View system features
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {benefits.map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                    <p className="text-sm font-black text-slate-950">{title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-brand-100" />
              <div className="relative overflow-hidden rounded-[2rem] border border-brand-100 bg-gradient-to-br from-white to-brand-50 p-5 shadow-2xl shadow-brand-100">
                <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[5rem] bg-brand-100/80" />
                <div className="relative">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-800">Subscription Control</p>
                  <h2 className="mt-4 font-display text-4xl font-extrabold leading-tight text-slate-950">
                    Plans, vendors, and restaurant tools in sync.
                  </h2>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {[
                      ['Starter', 'Small cafe setup'],
                      ['Standard', 'Kitchen + inventory'],
                      ['Premium', 'Advanced operations'],
                      ['Enterprise', 'Multi-branch control']
                    ].map(([plan, text]) => (
                      <div key={plan} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                        <p className="text-sm font-black text-slate-950">{plan}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-3xl border border-brand-100 bg-brand-600 p-4 text-white">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-100">Included by plan</p>
                    <div className="mt-3 space-y-2">
                      {['Staff accounts', 'Feature access', 'Vendor subscription tracking', 'Sales and inventory modules'].map((item) => (
                        <div key={item} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section id="features" className="rounded-[2rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Operational modules</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-950 sm:text-4xl">
                Practical tools for front desk, floor, kitchen, and owners
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-slate-600">
                Each module is designed around day-to-day restaurant work, not generic admin screens.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-3xl border border-brand-100 bg-gradient-to-b from-white to-brand-50/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-sm font-black text-white">
                    {feature.title.slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-extrabold text-slate-950">{feature.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="workflow" className="rounded-[2rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Operational flow</p>
                <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-950">Table to kitchen to bill</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
                  The system follows the actual restaurant flow, including adding more items to the same table and
                  transferring tables when customers move.
                </p>
              </div>
              <a href="#login" className="rounded-2xl bg-brand-700 px-5 py-3 text-center text-sm font-black text-white">
                Start from staff login
              </a>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-5">
              {workflowSteps.map((step, index) => (
                <div key={step} className="rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <p className="mt-4 text-sm font-black text-slate-950">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="pricing" className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
            <div className="rounded-[2rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Subscriptions and growth</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-950">Plan-based access for every restaurant size</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                Starter, Standard, Premium, and Enterprise plans can control staff limits, branches, enabled modules,
                subscriptions, and vendor access from the platform administration portal.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {['Menu and table management', 'Kitchen display system', 'Inventory and suppliers', 'Advanced sales reports'].map((item) => (
                  <div key={item} className="rounded-2xl bg-aqua-50 px-4 py-3 text-sm font-black text-aqua-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] border border-brand-100 bg-gradient-to-br from-brand-600 to-aqua-500 p-6 text-white shadow-xl shadow-brand-200">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white/80">For owners</p>
              <p className="mt-6 font-display text-5xl font-extrabold">Track subscriptions</p>
              <p className="mt-3 text-sm font-bold leading-6 text-white/90">
                Platform operators can manage vendors, active plans, subscription payments, renewal status, and recurring income.
              </p>
            </div>
          </section>

          <section id="faq" className="rounded-[2rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
            <div className="text-center">
              <h2 className="font-display text-3xl font-extrabold text-slate-950">Frequently asked questions</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">Quick answers before staff sign in.</p>
            </div>
            <div className="mt-6 divide-y divide-brand-100">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-4" open={question === faqs[0][0]}>
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                    <span>{question}</span>
                    <span className="float-right text-brand-600 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </section>

        <aside id="login" className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-[2rem] border border-brand-100 bg-white p-5 shadow-2xl shadow-brand-100/80 sm:p-6">
            <div className="mb-6">
              <div className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-brand-800">
                Secure staff access
              </div>
              <h2 className="mt-4 font-display text-3xl font-extrabold text-slate-950">Login to continue</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Enter your assigned vendor or staff account credentials to access the restaurant workspace.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <Input
                label="Email address"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
                autoComplete="current-password"
                {...register('password')}
                error={errors.password?.message}
              />

              {error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="min-h-12 w-full rounded-2xl"
                size="xl"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Access note</p>
              <p className="mt-2 text-sm font-black text-slate-900">Use your assigned account only.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Your role decides which modules you can access after login.
              </p>
            </div>

            <p className="mt-5 text-center text-xs font-semibold leading-5 text-slate-500">
              Contact the restaurant administrator if you do not have login credentials.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default LoginPage;
