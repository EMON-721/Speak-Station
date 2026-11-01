# Speak Station: Cloudflare Full Activation (বাংলা)

> Website: https://speak-station.emon721.workers.dev
>
> বর্তমান “We're setting things up” পেজটি ইচ্ছাকৃত temporary deployment। পুরো Speak Station ব্যবহার করতে নিচের account setup সম্পন্ন করতে হবে। Temporary page-এর উপর edit করে real app তৈরি করার দরকার নেই; existing GitHub main branch-এর deploy script পূর্ণ configuration পেলে real application publish করবে।

## Step 1 — Cloudflare D1 database তৈরি

Cloudflare Dashboard → Storage & databases → D1 SQL Database → Create database

- Database name: `speak-station-free`
- Location: automatic/default গ্রহণযোগ্য।
- তৈরি করার পরে database-এর **UUID/Database ID** কপি করুন।
- আগে থেকে থাকা `vocab-station-db` ব্যবহার করবেন না।

দরকারি Database ID একটি UUID, যেমন `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — exampleটি আসল value নয়।

## Step 2 — Google OAuth setup

Google Cloud Console → Google Auth Platform → Branding / Audience / Clients

1. প্রয়োজন হলে `Speak Station` নামে একটি project তৈরি করুন।
2. Branding-এ App name `Speak Station` এবং আপনার নিয়ন্ত্রণে থাকা support email দিন।
3. Audience: External (যদি public learners ব্যবহার করবেন)। প্রথমে Testing রেখে নিজের Google account Test user হিসেবে যোগ করুন।
4. Clients → Create Client → **Web application**, name `Speak Station Web`।
5. Authorized redirect URI এই exact value:
   
   `https://speak-station.emon721.workers.dev/callback`

6. Authorized JavaScript origins প্রয়োজন হলে:
   
   `https://speak-station.emon721.workers.dev`

7. Google **Client ID** ও **Client Secret** সংরক্ষণ করুন; Client Secret কখনো GitHub/ChatGPT-এ প্রকাশ করবেন না।

Note: Google OAuth app wider public করতে consent-screen publication, branding ও authorized-domain policies পূরণ করতে হতে পারে। Shared workers.dev domain-এর ক্ষেত্রে Google domain verification সীমাবদ্ধতা আসতে পারে; সে ক্ষেত্রে নিজের verified custom domain প্রয়োজন হতে পারে। Testing mode-এ কেবল configured test users sign in করতে পারবেন।

## Step 3 — Cloudflare *Build* variables

Cloudflare → Workers & Pages → **speak-station** → Settings → Build (কিছু UI-তে Builds) → Environment variables। **তিনটি একসাথে** যোগ করুন:

| Build variable | Value |
|---|---|
| `SPEAK_D1_DATABASE_ID` | Step 1-এর actual D1 UUID |
| `SPEAK_APP_ORIGIN` | `https://speak-station.emon721.workers.dev` |
| `SPEAK_ADMIN_EMAIL` | আপনার নিজস্ব verified Google email (যে account owner/admin হবে) |

তিনটি incomplete রেখে deploy দিলে safety check-এ build বন্ধ হবে। এখানে OAuth Client Secret, Gemini API Key, AUTH_SECRET ইত্যাদি দেবেন না।

## Step 4 — Cloudflare *Runtime* secrets

**speak-station → Settings → Variables and Secrets → Add → Type: Secret**। নিচের চারটি আলাদা Secret তৈরি করুন:

| Secret name | Value |
|---|---|
| `AUTH_SECRET` | Cryptographically secure, 32+ character random string |
| `GOOGLE_CLIENT_ID` | Google Step 2-এর OAuth Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Step 2-এর OAuth Web Client Secret |
| `CREDENTIAL_ENCRYPTION_KEY` | Exactly 32 random bytes encoded in Base64 |

Windows PowerShell-এ **নিজের PC-তে** চালিয়ে প্রথম ও চতুর্থ secret-এর জন্য দুটি **ভিন্ন** random value তৈরি করুন। প্রতিবার command চালালে নতুন value হবে:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Secret values শুধু Cloudflare Secret field-এ paste করুন। Password manager/secure backup-এ সংরক্ষণ করুন। বিশেষ করে `CREDENTIAL_ENCRYPTION_KEY` পরে বদলালে আগের encrypted Gemini connection আর পড়া নাও যেতে পারে।

> Build variables (Step 3) এবং Runtime secrets (Step 4) সম্পূর্ণ আলাদা জায়গায় সংরক্ষিত হয়।

## Step 5 — Build API token permission

Cloudflare → My Profile → API Tokens-এ build token-এর permission যাচাই করুন। Existing Worker deploy/update করার অনুমতি এবং database migration চালানোর জন্য D1 data write/edit permission দরকার। Auto-created token-এ D1 permission নাও থাকতে পারে। API token value গোপন রাখুন। Workers Builds-এর token selection Settings → Build-এ পরিবর্তন করা যায়।

## Step 6 — Real app deploy

Cloudflare Worker `speak-station` → Settings → Build:

- GitHub: `EMON-721/Speak-Station`
- Branch: `main`
- Build command: `pnpm run build:cloudflare`
- Deploy command: `pnpm run db:migrate:cloudflare && pnpm run deploy:cloudflare`
- Preview builds: প্রথমে OFF রাখতে পারেন
- Production workers.dev URL: ON

**Step 1–5 সম্পন্ন হওয়ার পরে** new build/deploy চালান। Logs-এ D1 migrations সফল হওয়া ও Wrangler deploy সফল হওয়া নিশ্চিত করুন।

যদি লগে `SETUP PENDING` দেখা যায়, তিনটি Build variable এখনও Build environment-এ পৌঁছায়নি; Worker Runtime secrets-এর জায়গায় ভুল করে বসানো হয়নি কি না দেখুন।

যদি `Partially configured Cloudflare deployment` দেখায়, তিনটি Build variable একসাথে set হয়েছে কি না দেখুন।

যদি D1 authentication/permission error দেখা যায়, Worker build token-এর D1 permission ঠিক করুন।

## Step 7 — Real website verify

1. `https://speak-station.emon721.workers.dev` খুলুন; temporary page থাকা উচিত নয়।
2. Google sign-in ক্লিক করে আপনার verified admin email দিয়ে login পরীক্ষা করুন।
3. Admin / Owner workspace খুলে প্রয়োজনীয় permission যাচাই করুন।
4. **Admin → AI connection**-এ owner-managed Gemini API key যোগ করে connection test চালান। Gemini key Cloudflare Build variable বা GitHub repository-তে যোগ করবেন না।
5. IELTS প্রশ্ন load, microphone permission, recording, transcript, complete feedback report, daily progress এবং mobile layout পরীক্ষা করুন।
6. Google OAuth consent Testing mode থেকে wider audience-এ আনার আগে Google-এর publishing/verification requirements দেখুন।

## গুরুত্বপূর্ণ সতর্কতা

- এই documentation এবং GitHub changes **Cloudflare-এর external D1 database, Google OAuth client বা Worker runtime secret স্বয়ংক্রিয়ভাবে তৈরি করে না**।
- `workers.dev` URL public হলেও Google OAuth verification পরে বাড়তি requirement আনতে পারে।
- Successful deployment মানেই সব application feature tested নয়।
- API token, Google Client Secret, AUTH_SECRET, CREDENTIAL_ENCRYPTION_KEY, Gemini key কাউকে পাঠাবেন না।
- Configuration পরে পরিবর্তন ও আবার deploy করা যাবে; encryption key-এর মতো গুরুত্বপূর্ণ secret ঘনঘন rotate করবেন না।

Official references:

- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/verification/authentication-policy-compliance

## Build variables save করার পর temporary page দেখালে

Cloudflare-এর Build variables Save করলে চলমান Worker নিজে থেকে বদলায় না। GitHub `main` branch থেকে নতুন production deployment চালিয়ে Deployments-এর সর্বশেষ build log দেখতে হবে। পুরোনো `Ready` deployment বা আগের temporary page success মানেই full app activate হয়নি। এই guide আপডেটটি new build trigger করার জন্যও ব্যবহার করা হয়েছে।

- Log-এ `SETUP PENDING` দেখালে build তিনটি `SPEAK_*` variable পায়নি; Builds → Variables and secrets-এ এগুলো Production environment-এ আছে কি না দেখুন।
- `D1` migration failure হলে build API token-এর D1 permissions পরীক্ষা করুন।
- Build complete হলেও deploy failed হলে শেষ 20–30 log lines দিয়ে diagnose করুন।
- Deploy `Ready` হওয়ার পরে browser-এ Ctrl+Shift+R দিয়ে আবার দেখুন।
