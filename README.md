# Noble West Social Review Tool — Technical Architecture

**Production URL:** [https://noble-west-social-review-e1b7.vercel.app](https://noble-west-social-review-e1b7.vercel.app)

This internal portal replaces bulky spreadsheets with an interactive, mobile-responsive calendar to manage social media deliverables for Noble West partners and clients. 

## 🛠 Tech Stack

- **Frontend:** React (Vite) + TypeScript
- **Styling:** Vanilla CSS (CSS Variables for Noble West brand tokens)
- **Database & Auth:** Supabase (PostgreSQL + Google OAuth)
- **Email Notifications:** Resend + Supabase Edge Functions
- **PDF Generation:** `@react-pdf/renderer`
- **Rich Text Editor:** Tiptap

---

## 🏛 Core Architecture Concepts

### 1. Magic Link System (Client Portal)
Clients NEVER have to create accounts or sign in with Google or passwords. When an NW admin creates a Workspace, a `magic_link_token` (UUID) is generated. 
- The Client Portal (`/review/:token`) uses the `anon` Supabase public key.
- Row Level Security (RLS) policies allow the `anon` role to specifically `SELECT` posts and calendars for that unique token, and uniquely `UPDATE` a post's status.
- **Security Note:** If a link leaks, an admin can simply hit "Regenerate" on the Admin Dashboard to instantly invalidate the old token.

### 2. Row Level Security (RLS)
The database strictly prevents unauthorized reads/writes:
- **NW Admins** (`role = 'nw_admin'`): Total control. 
- **NW Team** (`role = 'nw_team'`): Can only view/edit Workspaces they are assigned to in the `workspace_members` table.
- **Internal Comments:** `comments` with `thread = 'internal'` are mathematically invisible to the Client Portal's `anon` role.

### 3. @Mention Notifications (Edge Function)
Instead of putting API keys directly in React, email notifications are routed through a serverless **Supabase Edge Function** (`/supabase/functions/send-notification/index.ts`).
- When an `@mention` or specific action occurs, React calls `supabase.functions.invoke('send-notification')`.
- The Function securely talks to Resend utilizing the `RESEND_API_KEY` stored secretly in Supabase.

---

## 🔧 Maintenance & Troubleshooting Guide

### 1. Edge Function failing with `401 Unauthorized`
**The cause:** Edge Functions require users to be logged in (authenticated) by default. Because the Client Portal runs anonymously via Magic Links, Supabase rejects the client's attempt to send an email!

**The fix:** You must redeploy the Edge Function and explicitly tell it to bypass JWT verification:
```bash
npx supabase functions deploy send-notification --no-verify-jwt
```

### 2. Edge Function fails to send email (Resend Sandbox)
**The cause:** If the app logs say `Resend API rejected the request`, it's because your Resend account is locked in the free tier "Sandbox." This physically blocks you from sending emails to anyone except the email address you signed up with. 

**The fix:**
1. Verify the `wearenoblewest.com` domain in the Resend Dashboard (requires adding 2 DNS text records to GoDaddy/Cloudflare).
2. Or, buy a cheap `$12/year` placeholder domain (e.g. `noblewest-app.com`) specifically for this tool, verify *that* domain in Resend, and send all emails from `notifications@noblewest-app.com`.

### 3. How to check Edge Function Logs
If emails mysteriously stop arriving:
1. Go to your **Supabase Dashboard** online.
2. Click **Edge Functions** on the left menu.
3. Click the **`send-notification`** function.
4. Click **Logs** in the top right. 
5. Look for the explicit `Resend Error` response JSON.

### 4. Updating the Email "From" Address
Once you verify a domain in Resend, you must update the Edge Function to use it:
1. Open `/supabase/functions/send-notification/index.ts`
2. Scroll to line 37: `from: 'Noble West Social <onboarding@resend.dev>'`
3. Change it to your verified domain: `from: 'Noble West Social <notifications@wearenoblewest.com>'`
4. Redeploy the function using the command in Step 1.

### 5. Managing Admins vs Team Members
Whenever a new coworker logs in via Google for the first time, a database Trigger automatically creates a `Profile` for them with the default `nw_team` role. If you need to make them an Admin so they can create workspaces, you must manually run this SQL directly in your Supabase SQL Editor:
```sql
UPDATE profiles SET role = 'nw_admin' WHERE email = 'their.email@wearenoblewest.com';
```

---

## 🚀 Environment Setup for Future Devs

If a new developer takes over this project to add functionality, they need:

1. A copy of `.env.local`:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```
2. The Supabase CLI installed locally:
`brew install supabase/tap/supabase`
3. Node modules:
`npm install`
4. Run locally:
`npm run dev` 
