# Redpen setup checklist

A one-page companion to the [README](../README.md). Tick each line as you go; the step numbers
match the README, which explains each one in full.

## Notes to keep (in a password manager, never in the code)

| What | Your value |
| --- | --- |
| Supabase database password | |
| Project URL (`https://….supabase.co`) | |
| Publishable key (`sb_publishable_…`) | |
| Project ref (the code after `/project/` in the dashboard address) | |
| Gmail address used for sending | |
| Gmail app password (16 letters) | |
| App address (`https://….pages.dev`) | |

## Supabase

- [ ] **Step 4.** Free project created; Project URL and publishable key noted.
- [ ] **Step 5.** `supabase/migrations/20261021120000_init.sql` run in the SQL Editor.
- [ ] **Step 5.** `supabase/migrations/20261021120100_seed_content.sql` run after it.
- [ ] **Step 5.** Table Editor shows cards, mistakes, profiles, reviews and topics.
- [ ] **Step 6.** Authentication → Sign In / Providers: **Allow new users to sign up** is off.
- [ ] **Step 6.** Email provider: **Minimum password length** is `8`.
- [ ] **Step 7a.** Gmail 2-Step Verification on; app password created.
- [ ] **Step 7b.** Authentication → Emails → SMTP Settings: custom SMTP on and saved.
- [ ] **Step 7c.** **Invite user** template: subject `You're invited to Redpen`, body from
      `supabase/templates/invite.html`.
- [ ] **Step 7c.** **Reset password** template: subject `Reset your Redpen password`, body from
      `supabase/templates/recovery.html`.
- [ ] **Step 7d.** (Optional) Email OTP Expiration set to `86400`.

## GitHub and Cloudflare

- [ ] **Step 8a.** Code pushed to GitHub (`git add -A`, `git commit`, `git push`).
- [ ] **Step 8b.** Cloudflare **Pages** project (not a Worker) connected to the repository.
- [ ] **Step 8b.** Build command `npm run build`, output directory `dist`.
- [ ] **Step 8b.** Variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` added.
- [ ] **Step 8b.** First deployment finished; the pages.dev address shows the sign-in page.

## Connecting them

- [ ] **Step 9.** Authentication → URL Configuration: Site URL is the pages.dev address, with no
      slash at the end.
- [ ] **Step 9.** Redirect URLs: `https://<project>.pages.dev/**` and `http://localhost:5173/**`.

## People

- [ ] **Step 10.** Your own account created (Create new user, Auto Confirm User) and signed in.
- [ ] **Step 10.** Password reset email tested with **Forgot password?**.
- [ ] **Step 10.** Friends invited (Send invitation), or given a temporary password.
- [ ] **Step 11.** Installed on your iPhone (Safari → **⋯** → Share → Add to Home Screen, with
      Open as Web App on) and signed in inside the installed app.

## Before Stage 2 (optional)

- [ ] **Step 15.** Claude Console account, a little prepaid credit, a monthly spend limit, and an
      API key saved in your password manager (not in the code).
