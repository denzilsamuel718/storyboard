# Security Notes

- Sessions use signed, HTTP-only cookies; production cookies are Secure and SameSite=None for Vercel-to-Render deployment.
- Authentication and upload initiation are rate limited.
- Helmet security headers and restricted credentialed CORS are enabled. Authenticated cookie mutations also require an approved `Origin`, providing CSRF protection for cross-site requests.
- Passwords use bcrypt cost 12; login failures are generic.
- Creator submission and file queries enforce ownership in the database query.
- Administrator role checks happen in API middleware.
- File type and size are validated before authorization; add malware scanning before operational launch.
- Storage keys use random UUIDs and never contain original filenames.
- Downloads use short-lived signed URLs.
- Sensitive actions write audit rows with request IDs.
- Secrets belong only in server environment variables; never prefix them with `NEXT_PUBLIC_`.
- Production seeding refuses missing administrator credentials and the known local development password.

Before launch: configure admin 2FA, malware scanning, seed credential rotation, dependency auditing, database backups, and legal review of privacy and creator-rights terms.
