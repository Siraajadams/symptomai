# SymptomAI MVP

SymptomAI is a simple rules-first pharmacy triage and referral support app.

## What it does

- Captures patient demographic and contact details
- Screens red flags
- Recommends:
  - Emergency care
  - Doctor in pharmacy
  - Pharmacist care
  - Self-care
- Links doctor referrals to Carelink
- Generates WhatsApp referral text
- Provides a simple admin analytics view at `/admin`

## Important

This MVP stores data in browser localStorage only. This is for demo/prototype use. For live use, connect Supabase or another secure database and apply POPIA/GDPR controls.

## Local setup

```bash
npm install
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Deploy to Vercel

1. Create a GitHub repo called `symptomai`
2. Upload these files to the repo
3. Go to Vercel
4. Add New Project
5. Import the GitHub repo
6. Click Deploy

## Next recommended upgrades

- Supabase database
- Admin login
- Carelink API integration
- WhatsApp Business API
- OpenAI API for referral note summaries only
- Clinical governance review and version-controlled triage rules
