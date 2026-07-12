import { Link } from 'react-router-dom';

const platformStats = [
  ['10+', 'Role-based work areas'],
  ['4', 'Subscription plans'],
  ['3', 'Kitchen display sections'],
  ['NPR', 'Local billing currency']
];

const modules = [
  ['Table Service', 'Color-coded table grid, active table orders, table transfer, and table-number billing.'],
  ['Order Workflow', 'Dine-in, takeaway, and delivery orders with kitchen-ready status tracking.'],
  ['Kitchen Display', 'Separate Food, Bar, Smoke, and Overall views for clear preparation queues.'],
  ['Billing & Payments', 'Simple receipts, credit sales records, payment history, and Excel exports.'],
  ['Inventory', 'Purchase in, purchase out, suppliers, stock levels, and low-stock visibility.'],
  ['Sales Reports', 'Daily, weekly, monthly, and yearly visibility for sales, payments, and performance.']
];

const plans = [
  ['Starter', 'Small cafes and new restaurants', 'Menu, tables, dine-in, takeaway, and basic billing.'],
  ['Standard', 'Growing restaurants', 'Kitchen display, inventory, customer management, and advanced sales reports.'],
  ['Premium', 'High-volume restaurants', 'Supplier control, loyalty, split billing, delivery, and performance reports.'],
  ['Enterprise', 'Chains and multi-branch teams', 'Unlimited branches, custom branding, APIs, and centralized control.']
];

const workflow = [
  'Table selected',
  'Order placed',
  'Kitchen or bar prepares',
  'Ready and served',
  'Bill generated',
  'Payment recorded'
];

const HomePage = () => {
  return (
    <div className="min-h-screen bg-[#fffef8] text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute right-[-10rem] top-24 h-[30rem] w-[30rem] rounded-full bg-aqua-100/80 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/4 h-[30rem] w-[30rem] rounded-full bg-aqua-100 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-brand-100/80 bg-[#fffef8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-aqua-500 text-sm font-black text-white shadow-lg shadow-brand-200">
              DP
            </span>
            <span>
              <span className="block font-display text-base font-extrabold leading-4">Digit Restaurant POS</span>
              <span className="text-xs font-bold text-brand-700">Restaurant Subscription Cloud</span>
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-black text-slate-600 lg:flex">
            <a className="hover:text-brand-700" href="#modules">Modules</a>
            <a className="hover:text-brand-700" href="#workflow">Workflow</a>
            <a className="hover:text-brand-700" href="#plans">Plans</a>
            <a className="hover:text-brand-700" href="#contact">Contact</a>
          </nav>

          <Link
            to="/login"
            className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-brand-200 transition hover:bg-brand-800"
          >
            Login
          </Link>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="grid items-center gap-8 rounded-[2.25rem] border border-brand-100 bg-white/85 p-5 shadow-sm shadow-brand-100/80 sm:p-8 lg:grid-cols-[1fr_0.78fr]">
          <div>
            <div className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-brand-800">
              Built for subscription-based restaurant operations
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Manage restaurants, vendors, subscriptions, sales, kitchen, and inventory from one platform.
            </h1>
            <p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-slate-600 sm:text-lg">
              Digit Restaurant POS is a practical MERN/Postgres restaurant management system for teams that need fast
              table service, clean NPR billing, kitchen visibility, inventory control, and SaaS-style vendor
              subscription management.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 to-aqua-500 px-6 text-sm font-black text-white shadow-xl shadow-brand-200 transition hover:scale-[1.01]"
              >
                Login to workspace
              </Link>
              <a
                href="#modules"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand-200 bg-white px-6 text-sm font-black text-brand-800 transition hover:bg-brand-50"
              >
                Explore features
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {platformStats.map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-brand-100 bg-brand-50/80 p-4">
                  <p className="font-display text-2xl font-extrabold text-brand-800">{value}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-3 -top-4 hidden h-24 w-24 rounded-full bg-brand-100 lg:block" />
            <div className="relative overflow-hidden rounded-[2rem] border border-brand-100 bg-gradient-to-br from-white to-brand-50 p-5 shadow-2xl shadow-brand-100">
              <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[5rem] bg-brand-100/80" />
              <div className="relative">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-800">Platform control</p>
                <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight">
                  One system for restaurant staff and SaaS operators.
                </h2>
                <div className="mt-6 space-y-3">
                  {[
                    ['Restaurant Staff', 'Tables, orders, kitchen, billing, purchase flow, and reports.'],
                    ['Vendor Owner', 'Subscription-based access to assigned restaurant tools.'],
                    ['Business Owner', 'Sales, inventory, staff access, and subscription visibility.']
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
                      <p className="text-sm font-black">{title}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="mt-8 rounded-[2.25rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">System modules</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
              Everything a restaurant team needs in daily operation
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              The interface is designed for staff with minimum technical knowledge, using clear actions,
              simple status badges, and role-based navigation.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map(([title, text]) => (
              <article
                key={title}
                className="rounded-3xl border border-brand-100 bg-gradient-to-b from-white to-brand-50/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-700 text-xs font-black text-white">
                  {title.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="mt-8 rounded-[2.25rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Restaurant workflow</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">From table to kitchen to bill</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Waiters can create orders from tables, kitchen can update preparation status, and cashier can
                bill by table number or order number.
              </p>
            </div>
            <Link to="/login" className="rounded-2xl bg-brand-700 px-5 py-3 text-center text-sm font-black text-white">
              Login to start
            </Link>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-6">
            {workflow.map((step, index) => (
              <div key={step} className="rounded-3xl border border-brand-100 bg-brand-50/80 p-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="mt-4 text-sm font-black">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="plans" className="mt-8 rounded-[2.25rem] border border-brand-100 bg-white/85 p-5 shadow-sm sm:p-8">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Plan-based SaaS access</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Subscriptions instead of per-bill pricing</h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Each vendor can be assigned a plan, add-ons, feature access, staff limits, and renewal/payment records.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {plans.map(([name, audience, text]) => (
              <article key={name} className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
                <p className="font-display text-xl font-extrabold">{name}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-brand-700">{audience}</p>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1fr]">
          <div className="rounded-[2.25rem] border border-brand-100 bg-gradient-to-br from-brand-700 to-aqua-500 p-6 text-white shadow-xl shadow-brand-200">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-100">Contact</p>
            <h2 className="mt-5 font-display text-4xl font-extrabold">Need a restaurant system for your team?</h2>
            <p className="mt-4 text-sm font-bold leading-6 text-white/90">
              Get in touch to discuss setup, plans, staff training, menu data entry, and the right subscription for your restaurant.
            </p>
          </div>
          <div className="rounded-[2.25rem] border border-brand-100 bg-white/85 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">How we can help</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                'Restaurant onboarding',
                'Menu and table setup',
                'Staff login configuration',
                'Inventory and purchase setup',
                'Billing and receipt setup',
                'Subscription plan guidance'
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-brand-50 px-4 py-3 text-sm font-black text-brand-900">
                  {item}
                </div>
              ))}
            </div>
            <Link
              to="/login"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-700 px-6 text-sm font-black text-white"
            >
              Login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
