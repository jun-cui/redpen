# Redpen

**Flashcards you mark like an examiner, with a red pen.** For Edexcel International A Level
Maths, Further Maths, Physics and Computer Science.

> **Build status: Stage 1 of 4 is done.** You can sign in (invite-only), write your own
> flashcards, and review them by marking your answer against each key point. Redpen then
> schedules every card with FSRS.

This guide takes you from nothing to Redpen running online for you and a few friends, on
iPhone and on a computer. You don't need to know how to code. It takes about an hour and a half
the first time, and everything it uses is free.

## Contents

1. [What Redpen is](#1-what-redpen-is)
2. [What you need](#2-what-you-need)
3. [Try it on your computer first (optional)](#3-try-it-on-your-computer-first-optional)
4. [Create the Supabase project](#4-create-the-supabase-project)
5. [Set up the database](#5-set-up-the-database)
6. [Lock down sign-ups](#6-lock-down-sign-ups)
7. [Email: invitations and password resets](#7-email-invitations-and-password-resets)
8. [Put the app online with Cloudflare Pages](#8-put-the-app-online-with-cloudflare-pages)
9. [Tell Supabase your app's address](#9-tell-supabase-your-apps-address)
10. [Create your account and invite friends](#10-create-your-account-and-invite-friends)
11. [Install it on your phone and computer](#11-install-it-on-your-phone-and-computer)
12. [If Supabase pauses your project](#12-if-supabase-pauses-your-project)
13. [Updating the app](#13-updating-the-app)
14. [Troubleshooting](#14-troubleshooting)
15. [Coming in Stage 2: Claude marking](#15-coming-in-stage-2-claude-marking)
16. [For developers](#16-for-developers)

There's also a one-page [setup checklist](docs/SETUP-CHECKLIST.md) you can tick off as you go.

---

## 1. What Redpen is

Redpen is a flashcard app for A level revision. Each card has a question (define, state,
describe, explain) and the key points a mark scheme would look for. You type your answer, mark
it against those points, and Redpen works out when you should see the card again using **FSRS**,
a modern spaced-repetition method that predicts when you're about to forget something.

Behind the scenes, Redpen also keeps a record of every key point you miss, ready for the mistake
log in Stage 4.

| Stage | What it adds | Status |
| --- | --- | --- |
| 1 | Invite-only accounts, writing your own cards, reviewing with self-marking, FSRS scheduling | **Done** |
| 2 | Claude marks each key point for you, with a red-pen marking animation. Self-marking stays as a fallback. | Next |
| 3 | Claude drafts cards from a mark scheme you paste in. You check and edit them before saving. | Planned |
| 4 | The mistake log, card categories (new, learning, weak, mastered) and a dashboard | Planned |

### How the pieces fit together

```text
  Your phone or computer
          |  opens
          v
  Cloudflare Pages    serves the app from https://<your-project>.pages.dev
          |  the app then talks directly to
          v
  Supabase            keeps accounts, passwords and everyone's cards (a Postgres database)
```

GitHub holds the code. Cloudflare rebuilds the app from GitHub whenever the code changes. Your
cards live in Supabase, so they're the same on every device you sign in on.

---

## 2. What you need

- **A computer** (Windows or Mac) and about 90 minutes.
- **Free accounts** with [GitHub](https://github.com), [Supabase](https://supabase.com) and
  [Cloudflare](https://dash.cloudflare.com/sign-up).
- **An email account to send invitations from.** A Gmail account works well (Step 7).
- **Git**, to upload the code to GitHub. If you've never used it,
  [GitHub Desktop](https://desktop.github.com) is the friendliest way.
- **Optional: [Node.js](https://nodejs.org) 22.18 or newer**, only if you want to run Redpen on
  your own computer (Step 3) or use the command-line route in Step 5.
- **Later, for Stage 2:** a Claude Console account with a few dollars of prepaid credit.

**Keep a note of these as you go**, ideally in a password manager. Never put them in the code or
upload them to GitHub.

| What | Looks like | From |
| --- | --- | --- |
| Supabase database password | a long random string | Step 4 |
| Project URL | `https://abcdefghijklmnop.supabase.co` | Step 4 |
| Publishable key | `sb_publishable_...` | Step 4 |
| Gmail app password | 16 letters | Step 7 |
| Your app's address | `https://redpen.pages.dev` | Step 8 |

---

## 3. Try it on your computer first (optional)

*About 10 minutes. You can skip this and go straight to Step 4.*

You can run Redpen on your computer without creating any accounts. This is called **demo mode**.

1. Install **Node.js** from [nodejs.org](https://nodejs.org). Choose the **LTS** version; 22.18 or
   newer works.
2. Open a **terminal** (a window where you type commands) in the Redpen folder:
   - **Windows:** open the folder in File Explorer, right-click an empty space and choose
     **Open in Terminal**.
   - **Mac:** open the Terminal app, type `cd ` (with a space), drag the Redpen folder into the
     window and press Return.
3. Check Node.js is installed. This should print `v22.18.0` or higher:

   ```sh
   node --version
   ```

4. Download the app's building blocks. This takes a minute or two the first time:

   ```sh
   npm install
   ```

5. Start Redpen:

   ```sh
   npm run dev
   ```

6. Open <http://localhost:5173> in your browser.

**What demo mode is.** When your computer has no Supabase details (Step 4), Redpen runs
entirely inside your browser:

- A pretend user is signed in for you, so there's nothing to log in to.
- The default topic lists and 12 example cards (three per subject) are already there.
- Everything you do is saved **in this browser only**. Nothing is sent anywhere, and other
  browsers and devices can't see it. On a wide screen a small **Demo** badge in the sidebar
  reminds you; on a phone or in a narrow window, the reminder is under **Settings → About**.
- To start again from scratch, clear this site's data in your browser's settings.
- Demo mode only exists on your computer while `npm run dev` is running. The online version
  never uses it.

To stop the app, click in the terminal and press **Ctrl + C**.

> **Later: use your real Supabase project on your computer.** After Step 5, make a copy of the
> file `.env.example` in the same folder and name the copy `.env.local` (in the terminal:
> `cp .env.example .env.local` on a Mac, or `copy .env.example .env.local` on Windows). Open it
> in a text editor, paste your Project URL after `VITE_SUPABASE_URL=` and your publishable key
> after `VITE_SUPABASE_PUBLISHABLE_KEY=`, save, and run `npm run dev` again. `.env.local` is never
> uploaded to GitHub.

---

## 4. Create the Supabase project

*About 10 minutes.*

Supabase is Redpen's back end: it stores everyone's cards and looks after accounts and
passwords.

1. Go to [supabase.com](https://supabase.com) and choose **Start your project**. Signing up with
   **Continue with GitHub** is quickest.
2. If Supabase asks you to create an **organisation**, give it any name (your own name is fine),
   choose the **Personal** type and the **Free** plan.
3. Choose **New project** and fill in the form:
   - **Project name:** `redpen`
   - **Database password:** choose **Generate a password** and copy it into your notes. Redpen
     itself never needs it, but the command-line route in Step 5 does, and Supabase can't show it
     to you again (you can reset it later).
   - **Region:** the area where you and your friends live, for example **Europe**. A nearer
     region makes the app a little faster.
   - If there's a **Security** section, keep **Enable Data API** switched on: that's how the app
     reaches the database. Leave **Automatically expose new tables** as it is. Redpen's set-up
     script grants exactly the access the app needs, so either setting works.
4. Choose **Create new project** and wait a minute or two while Supabase sets it up.
5. Find the two values the app needs. Choose **Connect** at the top of your project's page and
   look for:
   - the **Project URL**, like `https://abcdefghijklmnop.supabase.co`
   - the **Publishable key**, which starts with `sb_publishable_`

   Copy both into your notes. Copy the values only: the Connect panel may show them inside
   example code with different names, but Redpen's names are exactly `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY`.

   You can also find the key under **Project Settings → API Keys**. Your Project URL is always
   `https://<project-ref>.supabase.co`, where `<project-ref>` is the code that appears after
   `/project/` in the dashboard's web address.

**Which key is which.** The publishable key is designed to be public: anyone who opens the app
can see it, and the database's security rules (called **Row Level Security**) decide what each
signed-in person may read and change. Never use the **secret** key (`sb_secret_...`) or the
legacy `service_role` key anywhere in Redpen: they skip those rules entirely.

**Done when** your notes have a Project URL and a publishable key.

---

## 5. Set up the database

*About 10 minutes.*

A new Supabase database is empty. Two files in this repository create everything Redpen needs:

| Order | File | What it does |
| --- | --- | --- |
| 1 | `supabase/migrations/20261021120000_init.sql` | Creates the five tables (profiles, topics, cards, reviews, mistakes), the rules that keep each person's data private, and the functions that save reviews and log missed points. |
| 2 | `supabase/migrations/20261021120100_seed_content.sql` | Adds the default topic lists, which every new account gets a copy of, and the 12 example cards anyone can add from the home page. |

**Run them in this order, once each, and before you add any users.**

### Using the SQL Editor (recommended)

1. Open the first file, `supabase/migrations/20261021120000_init.sql`, in a text editor such as
   Notepad, TextEdit or VS Code. Select everything (**Ctrl + A**, or **Cmd + A** on a Mac) and
   copy it. (Or open the file on GitHub and use its **Copy raw file** button.)
2. In Supabase, open **SQL Editor** in the left sidebar and start a new query (look for
   **New query** or a **+** button).
3. Paste, then choose **Run** (or press **Ctrl + Enter**).
   - Supabase may warn that the query contains destructive operations. That's expected: the file
     deliberately removes some of Supabase's default permissions. Check you pasted the right
     file, then confirm (**Run this query**).
4. You should see **Success. No rows returned**.
5. Start another new query, paste the whole of the second file,
   `supabase/migrations/20261021120100_seed_content.sql`, and run it. You should see the same
   success message.
6. Check your work: open **Table Editor** in the left sidebar. You should see five tables:
   **cards**, **mistakes**, **profiles**, **reviews** and **topics**. They're empty for now.
   Each new account gets its own profile and topic lists automatically.

If you see an error instead, look under "Setting up the database" in
[Troubleshooting](#14-troubleshooting).

<details>
<summary><strong>Alternative: the Supabase command line</strong> (for people comfortable with a terminal)</summary>

Use this *instead of* the SQL Editor, not as well. It needs Node.js (Step 3). Run these in a
terminal in the Redpen folder:

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

- `login` opens your browser so you can allow the command line to use your Supabase account.
- `link` connects this folder to your project. `<your-project-ref>` is the code after
  `/project/` in the dashboard's address. It asks for the database password from Step 4. If it
  complains that `supabase/config.toml` is missing, run `npx supabase init`, answer **N** to its
  questions about editor settings, and run `link` again.
- `db push` lists the two migration files and asks you to confirm. It remembers what it has run,
  so next time it only runs new files.

</details>

**Done when** the Table Editor shows the five tables.

---

## 6. Lock down sign-ups

*About 2 minutes.*

Redpen is invite-only: you decide who has an account.

1. In Supabase, go to **Authentication → Sign In / Providers**.
2. In the **User Signups** section at the top, switch off **Allow new users to sign up**.
3. Choose **Save changes**.
4. On the same page, open the **Email** provider, set **Minimum password length** to `8` and save.
   Redpen asks for at least 8 characters, and this makes Supabase insist on the same.

Leave the **Email** provider itself switched on. It's what lets people sign in with an email
address and password.

**Why this matters.** The app's address and publishable key are visible to anyone who opens the
site, which is normal for web apps. Redpen has no sign-up page, but with sign-ups switched on a
stranger could still create an account by talking to Supabase directly, and use up your free
allowance (and, from Stage 2, your Claude credit). With sign-ups off, only you can add people.
Invitations from the dashboard still work.

**Done when** **Allow new users to sign up** is off and **Minimum password length** is `8`.

---

## 7. Email: invitations and password resets

*About 20 minutes.*

### Why you need your own email sending

Supabase's built-in email is only meant for trying things out:

- It only delivers to members of your Supabase organisation's team, which in practice means you.
  Invitations to friends fail with "Email address not authorized".
- It sends about **2 emails an hour** for the whole project.
- On free projects created since June 2026, you can't change the email templates while you use
  it.

So to invite friends by email, and so that anyone can reset a forgotten password, connect your
own email account. This is called **custom SMTP** (SMTP is the standard way programs send email).
The steps below use Gmail, but any email provider that offers SMTP works.

> You can skip this step and give friends a temporary password instead (Step 10, option B). The
> catch is that **Forgot password?** won't work for them.

### 7a. Create a Gmail app password

An **app password** is a separate 16-letter password that lets one program send email from your
Gmail account without knowing your real password.

1. Choose the Gmail account to send from. Your friends will see this address, so you may prefer
   a separate one, such as `redpen.yourname@gmail.com`.
2. Turn on **2-Step Verification**: go to [myaccount.google.com](https://myaccount.google.com),
   then **Security**, then **2-Step Verification**. App passwords need it.
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), type a
   name such as `Supabase Redpen`, and create the password.
4. Copy the 16 letters into your notes, without the spaces. Google only shows them once.

App passwords aren't available for school or work Google accounts, or if you use Google's
Advanced Protection. A personal Gmail account can send roughly 500 emails a day, far more than
Redpen needs.

### 7b. Connect Gmail to Supabase

1. In Supabase, go to **Authentication → Emails** and open the **SMTP Settings** tab.
2. Switch on **Enable Custom SMTP** and fill in:

   | Field | What to enter |
   | --- | --- |
   | Sender email | your Gmail address |
   | Sender name | `Redpen` |
   | Host | `smtp.gmail.com` |
   | Port number | `465` (`587` also works) |
   | Minimum interval between emails | leave the default |
   | Username | your full Gmail address (the same as the sender email) |
   | Password | the app password from 7a |

3. Save.

With custom SMTP, Supabase starts you on 30 emails an hour, which is plenty. You can change it
under **Authentication → Rate Limits**.

If you own a domain name, providers such as Resend, Brevo or Postmark have free tiers and tend to
land in inboxes more reliably than Gmail. Their help pages list the host, port, username and
password to enter here.

### 7c. Use Redpen's email templates

Redpen comes with two emails in its own style:
[`supabase/templates/invite.html`](supabase/templates/invite.html) and
[`supabase/templates/recovery.html`](supabase/templates/recovery.html).

Their buttons open the app's own `/auth/confirm` page, where you tap **Accept invitation** (or
**Reset my password**) to continue. The one-time link is only used by that tap. That matters
because some email services "click" every link to check it for viruses, which can use up an
ordinary one-time link before you've even seen the email. A scanner can open the page, but it
won't tap the button.

1. In Supabase, go to **Authentication → Emails** and open the **Templates** tab.
2. Open **Invite user**:
   - **Subject:** `You're invited to Redpen`
   - **Message body:** delete what's there and paste the whole of
     `supabase/templates/invite.html`
   - Save.
3. Open **Reset password**:
   - **Subject:** `Reset your Redpen password`
   - **Message body:** delete what's there and paste the whole of
     `supabase/templates/recovery.html`
   - Save.

Leave the other templates as they are: Redpen doesn't use them. The links in these two emails
start with your **Site URL**, which you'll set in Step 9.

If Supabase won't let you edit the templates, check that custom SMTP is switched on (7b): new
free projects can only change templates with it. Redpen also works with Supabase's default
emails, so invitations and resets still work without these templates; they're just plainer and
easier for email scanners to use up.

### 7d. Optional: give invitations a day

Invitation and password-reset links expire after **1 hour** by default, so a friend who opens
the email later finds it has expired. To give them a day:

1. Go to **Authentication → Sign In / Providers** and open **Email**.
2. Set **Email OTP Expiration** to `86400` (that's 24 hours in seconds) and save.

This applies to password-reset links too. Supabase advises against anything longer than a day.

**Done when** custom SMTP is switched on and both templates are saved. You'll test them in
Step 10.

---

## 8. Put the app online with Cloudflare Pages

*About 20 minutes.*

### 8a. Upload the code to GitHub

Cloudflare builds Redpen from your GitHub repository. This copy of the code is already linked to
`https://github.com/jun-cui/redpen.git`. (If you're setting up your own copy, create an empty
repository on GitHub first and use its address instead.)

In a terminal in the Redpen folder, run:

```sh
git add -A
git commit -m "Redpen stage 1"
git push
```

(If Git replies that the branch has no upstream branch, run `git push -u origin main` instead.)

With GitHub Desktop instead: your changes appear in the left-hand panel. Type a summary, choose
**Commit to main**, then **Push origin**.

Refresh the repository's page on GitHub. You should see folders such as `src`, `public` and
`supabase`. If you made a `.env.local` file in Step 3, it isn't uploaded.

**Public or private repository?** Both work with Cloudflare Pages. The code contains no secrets:
your Supabase values go into Cloudflare's settings, not into the code. A private repository keeps
the code to yourself; a public one lets anyone read and copy it. If you're unsure, make it
private: on GitHub, open the repository's **Settings**, scroll to the **Danger Zone** and choose
**Change visibility**.

### 8b. Create the Pages project

Cloudflare has two similar products, **Workers** and **Pages**. Redpen is set up for **Pages**
(for example, its `public/_headers` file is a Pages feature), so make sure you end up there.

1. Sign up or log in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. In the left sidebar, open **Workers & Pages**. It may sit inside a group called **Compute**
   or **Build**.
3. Choose **Create application**. Cloudflare suggests creating a Worker first. Look for
   **Pages** instead: either a **Pages** tab, or a link near the bottom along the lines of
   "Looking to deploy Pages? **Get started**".
4. Choose **Import an existing Git repository** (older dashboards call it **Connect to Git**).
5. Connect your GitHub account when asked. GitHub asks which repositories Cloudflare may see:
   choose **Only select repositories**, pick **redpen**, then **Install & Authorize**.
6. Back in Cloudflare, select the **redpen** repository and choose **Begin setup**.

   You're in the right place if the next page is called **Set up builds and deployments** and has
   a **Framework preset** field. If it asks for a **Deploy command** such as
   `npx wrangler deploy`, you're creating a Worker by mistake: go back and choose Pages.

7. Fill in the build settings:

   | Setting | What to enter |
   | --- | --- |
   | Project name | `redpen`. This becomes `redpen.pages.dev`; if the name is taken, choose another. |
   | Production branch | `main` |
   | Framework preset | **React (Vite)**, or **None**. The next two fields are what matter. |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | leave empty |

8. Open **Environment variables (advanced)** and add two variables:

   | Variable name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your Project URL from Step 4 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable key from Step 4 |

   You don't need to set a Node.js version: the repository's `.node-version` file already asks
   for Node.js 22. Only if the build log shows an older version, add a third variable,
   `NODE_VERSION`, with the value `22`.

9. Choose **Save and Deploy**. The first build takes 2 to 4 minutes, and you can watch its log.

When it finishes, Cloudflare shows your app's address, such as `https://redpen.pages.dev`. Copy
it into your notes, and use that exact address wherever this guide says `redpen.pages.dev`.

**Done when** your pages.dev address shows Redpen's sign-in page. You can't sign in yet: that
comes in Step 10.

Good to know:

- **Automatic updates.** Every time you push to `main` on GitHub, Cloudflare rebuilds and
  publishes the app by itself (Step 13).
- **Changing the variables.** They live under your Pages project's **Settings → Variables and
  Secrets** (older dashboards: **Environment variables**). They're built into the app, so after
  changing them, deploy again: open **Deployments**, find the latest one and choose
  **Retry deployment** from its **⋯** menu.
- **Links to pages inside the app**, such as `/cards` or `/review`, work without any extra set-up:
  when there's no `404.html` file, Pages sends every unknown address to the app, which shows the
  right page.

---

## 9. Tell Supabase your app's address

*About 3 minutes.*

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your exact pages.dev address, such as `https://redpen.pages.dev`, with
   `https://` at the start and **no slash at the end**. Save.
3. Under **Redirect URLs**, choose **Add URL** and add these two (replace `redpen` with your
   project's name if it's different). Save.

   ```text
   https://redpen.pages.dev/**
   http://localhost:5173/**
   ```

**Why.** Redpen's email templates build their links from the Site URL. Supabase also only sends
people back to addresses on the Redirect URLs list; `**` means "any page on this site". The
localhost line is for Supabase's default emails while you run the app on your computer. Redpen's
own templates always link to the Site URL, so a password reset you ask for on your computer
finishes on your live site, which works just as well: it's the same account.

**Done when** both are saved.

---

## 10. Create your account and invite friends

*About 10 minutes.*

### Your own account

1. In Supabase, go to **Authentication → Users**, choose **Add user**, then **Create new user**.
2. Enter your email address and a strong password of at least 8 characters, and tick
   **Auto Confirm User**, so you don't need to click a link in an email first.
3. Choose **Create user**.
4. Open your pages.dev address and sign in.

You'll land on Redpen's home page, which says **Welcome to Redpen**. Your own copy of the
default topic lists is already there. To see how a review works straight away, choose
**Add 12 example cards**, or choose **Write your first card**.

**Test your email set-up.** Sign out (in **Settings**), choose **Forgot password?** on the sign-in
page and enter your email address. An email called "Reset your Redpen password" should arrive
within a minute or two (check your spam folder too). If it doesn't, see
[Troubleshooting](#14-troubleshooting).

### Inviting a friend, option A: by email (needs Step 7)

1. Go to **Authentication → Users → Add user → Send invitation**.
2. Enter your friend's email address and send the invitation.

What your friend sees:

1. An email from Redpen called "You're invited to Redpen", with an **Accept invite** button.
2. The button opens Redpen. They tap **Accept invitation**, and Redpen asks them to **Choose a
   password**.
3. Then they're in, with their own empty card box and the default topic lists.

If the link has expired, send the invitation again in the same way. If Supabase says the user is
already registered, they've already accepted it: they can use **Forgot password?** on the
sign-in page if they've forgotten their password.

### Inviting a friend, option B: a temporary password (no email needed)

Use this if you haven't set up email sending, or an invitation won't arrive.

1. Go to **Authentication → Users → Add user → Create new user**. Enter your friend's email
   address and a temporary password, tick **Auto Confirm User**, and create the user.
2. Give them the app's address and the temporary password in person or in a private message.
3. They sign in, then choose their own password in **Settings → Change password**.

### Good to know

- **Everyone's cards are private.** The database's security rules stop anyone from seeing anyone
  else's cards. You, as the owner of the Supabase project, can see everything in the Supabase
  dashboard, so be upfront with your friends about that.
- **Removing someone:** go to **Authentication → Users**, open the menu on their row and choose
  **Delete user**. This permanently deletes their cards and reviews too.

---

## 11. Install it on your phone and computer

*About 2 minutes per device.*

Redpen is a web app you can install. Once installed, it opens full screen from its own icon,
like any other app.

### iPhone

1. Open your pages.dev address in **Safari**.
2. Tap the **⋯** button next to the address bar, then **Share**. (On older versions of iOS, tap
   the **Share** button: a square with an arrow pointing up.)
3. Scroll down and tap **Add to Home Screen**. If you can't see it, tap **View More**.
4. Make sure **Open as Web App** is switched on (you'll see this on iOS 26 and later), then tap
   **Add**.
5. Open Redpen from its new icon on your Home Screen. It fills the screen, without Safari's
   address bar.
6. Sign in once more. An app on the Home Screen keeps its own sign-in, separate from Safari.

### Android

Open the address in Chrome, tap the **⋮** menu, then **Add to Home screen** or **Install app**.

### Windows or Mac

- **Chrome:** click the install icon at the right-hand end of the address bar, or open the **⋮**
  menu and choose **Cast, save, and share → Install page as app**.
- **Edge:** click **App available** in the address bar, or open the **⋯** menu and choose
  **Apps → Install this site as an app**.
- **Safari on a Mac:** **File → Add to Dock**.

Redpen then opens in its own window, and you can pin it to the taskbar or Dock.

---

## 12. If Supabase pauses your project

**What happens.** On the free plan, Supabase pauses a project that has had very little activity
for **7 days**. It emails you about a week beforehand, and again once the project is paused.
While it's paused, Redpen still opens but can't sign anyone in or load any cards. Nothing is
deleted.

**How to resume it.**

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and open the paused project.
2. Choose **Resume project** and confirm.
3. Wait a few minutes, then reload Redpen.

Don't leave it paused for long. Supabase's documentation currently says a paused project can be
restored for up to a year after it was paused, but that window has been shorter in the past
(90 days).

**Avoiding it.** Using Redpen a few times a week keeps the project awake: every sign-in and
review counts. If you get the warning email, open Redpen and do a quick review, or open the
project in the Supabase dashboard. Paid plans never pause, but they start at $25 a month.

---

## 13. Updating the app

1. Change the code, then upload it to GitHub as in Step 8a (`git add -A`,
   `git commit -m "What changed"`, `git push`).
2. Cloudflare notices and builds the new version, which takes 2 to 4 minutes. You can watch it
   under your Pages project's **Deployments**. If a build fails, the previous version stays
   online.
3. Open Redpen. When it notices the new version, a notice says "A new version of Redpen is
   ready." Choose **Reload** to switch to it. An installed app checks when you open it, and about
   once an hour while it's open.

If a future stage adds new files to `supabase/migrations`, run just the new ones in the SQL
Editor in filename order (or use `npx supabase db push`). That stage's notes will tell you.

---

## 14. Troubleshooting

### The app

**The site says "Redpen isn't connected to its database yet".**
The app was built without its Supabase settings. In Cloudflare, open your Pages project, go to
**Settings → Variables and Secrets**, and check that `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` are set for **Production**, spelt exactly like that. Then go to
**Deployments** and choose **Retry deployment** on the latest one.

**The deploy fails with "VITE_SUPABASE_PUBLISHABLE_KEY holds your Supabase secret key".**
You pasted the secret key (or the legacy `service_role` key) where the publishable one belongs.
Redpen refuses to build with it, because anyone could read it from the website. In Cloudflare, set
the variable to the **publishable** key (it starts `sb_publishable_`), retry the deployment, and
then replace the secret key in Supabase (**Project Settings → API Keys**), since it may have been
exposed.

**"That email and password don't match"** (Supabase calls this "Invalid login credentials").
Check for typos and for a space at the end of the email address. Someone who was invited but
never clicked **Accept invite** has no password yet: send the invitation again. Anyone can choose
**Forgot password?** to set a new one (once Step 7 is done).

**There's no sign-up button, or the app says Redpen is invite-only.**
That's by design (Step 6). Ask whoever runs Redpen to add you.

**Nothing works at once: cards won't load and nobody can sign in.**
Check your internet connection first. If that's fine, your Supabase project may be paused:
see [Step 12](#12-if-supabase-pauses-your-project).

**A blank page, or still the old version after deploying.**
In Cloudflare, check the latest deployment under **Deployments** finished successfully. Then
reload the page. For an installed app, close it completely (on iPhone, swipe it away in the app
switcher), open it again, and choose **Reload** if it offers a new version.

**I installed Redpen on my iPhone and it's asking me to sign in again.**
That's normal: the Home Screen app keeps its own sign-in, separate from Safari. Sign in once and
it stays signed in.

### Email links

**"That link didn't work": "This link has expired or has already been used."**
Each link works once, and expires after an hour unless you changed that in Step 7d. Send a new
invitation, or ask for a new reset email from **Forgot password?**. If links are used up before
anyone clicks them, an email scanner is probably opening them: make sure you pasted Redpen's
templates in Step 7c.

**The link opens the wrong site, `localhost`, or a page that doesn't exist.**
The **Site URL** in Step 9 is wrong. It must be your exact pages.dev address, starting with
`https://` and with no slash at the end. Then send a new email: old emails keep the old address.

**The link opens Redpen's sign-in page instead of asking for a new password.**
Check both settings in Step 9 (Site URL and Redirect URLs), then send a new email.

### Sending email

**Emails don't arrive.**

- Look in the spam or junk folder.
- Check the SMTP settings in Step 7b: the username is your full Gmail address, the password is
  the 16-letter app password with no spaces, and the port is `465` or `587`.
- Supabase's logs show what went wrong. In Supabase, look for **Logs** in the left sidebar and
  open the **Auth** logs; errors mention sending email or SMTP.
- If you changed your Google password, Google cancels your app passwords: create a new one and
  paste it into Supabase.

**"Email address not authorized", or the app says emails can't be sent to that address.**
Supabase is still using its built-in email, which only sends to your own team. Set up custom
SMTP (Step 7b).

**"Too many emails have been sent recently."**
You've reached the hourly email limit. Wait an hour, or raise the limit under
**Authentication → Rate Limits**.

### Setting up the database

**"Database error saving new user" when you add someone.**
The second database file hasn't been run. Run
`supabase/migrations/20261021120100_seed_content.sql` in the SQL Editor (Step 5), then add the
user again.

**An SQL error saying something "already exists".**
That file has already been run, so there's nothing more to do with it. Don't run the files
twice.

**An SQL error saying a relation "does not exist".**
The files were run in the wrong order, or the first one didn't finish. Run
`20261021120000_init.sql` first, then `20261021120100_seed_content.sql`.

**I've lost the database password.**
Only the command-line route in Step 5 needs it. To set a new one, look for
**Reset database password** under **Project Settings → Database** in Supabase.

### Building on Cloudflare

**The build failed.**
Open the failed deployment under **Deployments** and read its log from the bottom up; the first
error message is usually the cause.

- `npm` or Node.js version errors: add the variable `NODE_VERSION` with the value `22`, then
  retry the deployment.
- Errors from `tsc` (TypeScript): the code itself has a mistake. Fix it on your computer
  (`npm run build` shows the same errors), then push again.
- An error saying the output directory wasn't found: check the **Build output directory** is
  `dist` and the **Build command** is `npm run build` (under **Settings → Builds** in your Pages
  project).

---

## 15. Coming in Stage 2: Claude marking

> This section is a preview. Stage 2 will finish it with step-by-step set-up instructions.

In Stage 2, Claude (Anthropic's AI model) marks each answer key point by key point, and the red
pen marks your answer on screen. Marking yourself stays available as a fallback. You can get the
Claude side ready now.

1. **Create a Claude Console account.** Go to [platform.claude.com](https://platform.claude.com),
   the Claude Console (it used to be console.anthropic.com), and sign up. This is separate from a
   Claude.ai chat subscription.
2. **Add some credit.** Go to **Settings → Billing** and buy a small amount of prepaid credit.
   Credit can't be refunded and expires a year after you buy it, so start small. Redpen will use
   a small, fast model for marking.
3. **Set a spending limit as a safety net.** On the same **Billing** page, find **Spend limits**,
   choose **Set limit** and enter the most you're happy to spend in a month. Once it's reached,
   Claude stops answering until the next month (or until you raise the limit).
4. **Create an API key.** Go to **Settings → API keys**, choose **Create key**, call it `redpen`,
   and copy the key (it starts with `sk-ant-`). The Console only shows it once, so put it straight
   into your password manager.

**Where the key will go.** Only into Supabase's secret settings, for Redpen's **Edge Functions**.
An Edge Function is a small piece of code that runs on Supabase's servers: the app sends it an
answer, it asks Claude to mark it using your key, and it sends the marks back. That way the key
never reaches anyone's browser.

- Never put the key in the app's code, in GitHub, or in Cloudflare.
- Never put it in a variable starting with `VITE_`: those are built into the app, and anyone who
  opens it can read them.

Stage 2 will also add two settings for choosing the models: `MARKING_MODEL` (default
`claude-haiku-5-5`) and `CARDGEN_MODEL` (default `claude-sonnet-5-5`, used from Stage 3).

---

## 16. For developers

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on <http://localhost:5173>. Without `.env.local` it runs in demo mode. Add `-- --host` to open it from a phone on the same Wi-Fi. |
| `npm run build` | Type-checks (`tsc -b`) and builds the production app into `dist/`. |
| `npm run preview` | Serves the production build locally. Production builds never use demo mode, so this needs `.env.local`. |
| `npm run typecheck` | Type-checks the app, tests, scripts and config (`tsc -b`). |
| `npm run lint` | Runs ESLint. |
| `npm test` | Runs every test once (Vitest): unit tests and database tests. |
| `npm run test:watch` | Runs the tests in watch mode. |
| `npm run icons` | Regenerates the PWA icons and iOS splash screens from `public/icon.svg`, and prints the `<link>` tags for `index.html`. |
| `npm run seed:sql` | Regenerates `supabase/migrations/20261021120100_seed_content.sql` from `src/data/exampleContent.ts`. |
| `npm run seed:check` | Fails if that generated migration is out of date. |
| `node scripts/check-contrast.mjs` | Checks the colour tokens in `src/styles/tokens.css` meet WCAG AA contrast, in light and dark. |

### Environment variables

| Variable | Used for |
| --- | --- |
| `VITE_SUPABASE_URL` | The Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The publishable key (`sb_publishable_...`). The legacy `anon` key also works, and so does the older name `VITE_SUPABASE_ANON_KEY`. |

Both are public by design and are built into the app. Locally they go in `.env.local` (see
`.env.example`); on Cloudflare Pages, in the project's variables. With neither set, `npm run dev`
runs in demo mode: an in-browser back end seeded with the example content and a fake signed-in
user. Production builds leave demo mode out entirely.

### Project structure

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the map of the codebase: folders, routes, the
data model, how a review is saved, and the conventions to follow. In short:

```text
src/
  components/   design system (tokens in src/styles/tokens.css)
  features/     one folder per area: auth, shell, system, home, cards, topics, review, settings
  data/         data access: Api interface, Supabase and demo implementations, TanStack Query hooks
  lib/          framework-free logic: FSRS, scoring, categories, error copy, motion presets
  auth/         AuthProvider and useAuth()
  pwa/          service worker registration and update checks
supabase/
  migrations/   SQL, applied in filename order
  templates/    the invite and password-reset emails
tests/db/       database tests
```

### Tests

- **Unit tests** (`src/**/*.test.ts`) cover scoring, the FSRS wrapper, card categories, error
  copy, the data layer and the demo back end.
- **Database tests** (`tests/db`) run both migrations in **PGlite**, which is Postgres compiled
  to WebAssembly, with Supabase's roles, `auth.uid()` and default privileges stubbed. They cover
  Row Level Security, grants, `record_review`, the mistake log, card categories and the seed
  content. They need no Docker and no Supabase project, and take about 20 seconds.
- `npm test` runs both. `npx vitest run tests/db` runs just the database tests.

### Database changes

- Migrations run in filename order. Add new ones as new files; never edit one that has already
  been applied to a real project.
- The seed migration is generated: edit `src/data/exampleContent.ts`, then run
  `npm run seed:sql`.
- Supabase no longer exposes new tables to its Data API automatically (a 2026 platform change).
  Every new table or function needs explicit `grant`s, plus RLS policies for tables, as in
  `20261021120000_init.sql`. `tests/db/schema.test.ts` pins the exact set of tables, policies,
  functions and grants, so update it on purpose.
- If you set the database up with the SQL Editor and later switch to the CLI, first tell the CLI
  those migrations are already applied:
  `npx supabase migration repair --status applied 20261021120000 20261021120100`.

### Hosting notes

- `public/_headers` sets the security headers for Cloudflare Pages, including a Content Security
  Policy that only allows connections to the site itself and `*.supabase.co`. Update
  `connect-src` if Supabase ever moves to a custom domain.
- There's deliberately no `404.html`, so Cloudflare Pages serves the app for every route.
- The service worker (vite-plugin-pwa) waits for the user to accept an update before switching
  versions. Supabase requests are never cached.

### Costs

| Service | Plan | Limits that matter |
| --- | --- | --- |
| Cloudflare Pages | Free | 500 builds a month |
| Supabase | Free | 500 MB database, 50,000 monthly active users, 2 active free projects; pauses after 7 days of inactivity |
| Gmail (SMTP) | Free | about 500 emails a day |
| Claude API (Stage 2 on) | Pay as you go, prepaid | whatever spending limit you set |

### Licence

[MIT](LICENSE).
