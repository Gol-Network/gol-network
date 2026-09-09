/**
 * Rendered instead of the application when required runtime configuration is missing or invalid.
 * Only field names are shown; a configuration value may itself be a secret.
 */
export function ConfigurationNotice({ fields }: { fields: string[] }) {
  return (
    <main>
      <section className="config-notice" role="alert">
        <p className="eyebrow">CONFIGURATION REQUIRED</p>
        <h1>GOL is not configured</h1>
        <p className="lede">
          The running image is missing valid runtime configuration. Set the fields below on the host
          and restart the service. Values are never displayed here.
        </p>
        <ul>
          {fields.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
