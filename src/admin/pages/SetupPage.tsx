import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { IconLock } from '../icons'

export function SetupPage() {
  useDocumentTitle('Connect the admin studio — HALA.S Admin')
  return (
    <div className="admin-setup">
      <div className="admin-setup__card">
        <p className="admin-eyebrow">HALA.S · PRIVATE ADMIN</p>
        <h1>Connect the admin studio.</h1>
        <p className="admin-muted">
          The storefront and admin portal are built and waiting for your Supabase project. Add the two public
          environment values below, run the SQL setup once, then create the administrator account — no code changes
          and no rebuild per product.
        </p>

        <div className="admin-setup__steps">
          <section>
            <h2>1 · Environment</h2>
            <p>Create a Supabase project and add these to <code>.env.local</code>, then rebuild:</p>
            <pre>{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
            <p className="admin-muted">
              Only the public anon key reaches the browser. The service-role key, Resend key and worker secret live
              exclusively in Supabase Edge Function secrets.
            </p>
          </section>
          <section>
            <h2>2 · Database</h2>
            <p>
              Run <code>supabase/setup.sql</code> in the Supabase SQL editor. It installs the schema, row-level
              security, order engine, stock movement system, email outbox and seed catalogue.
            </p>
          </section>
          <section>
            <h2>3 · Administrator</h2>
            <p>
              Create the admin user in Supabase Authentication, then run <code>supabase/admin-bootstrap.sql</code>{' '}
              with that email to grant the administrator role.
            </p>
          </section>
        </div>

        <div className="admin-setup__note">
          <IconLock />
          <span>
            Protected routes stay closed until Supabase is configured. No demo data, mock orders or placeholder
            dashboards are shown here.
          </span>
        </div>

        <Link to="/" className="admin-btn admin-btn--ghost">
          Return to the storefront
        </Link>
      </div>
    </div>
  )
}
