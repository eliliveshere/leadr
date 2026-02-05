# Lead2Close Setup

## 1. Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- Supabase URL/Keys
- OpenAI API Key
- Resend API Key
- Twilio Credentials

## 2. Database
Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create tables and RLS policies.

## 3. Webhooks
Set up your Twilio phone number webhook to point to:
`https://your-app.vercel.app/api/twilio/inbound-sms`
(For local dev, use ngrok or similar).

## 4. Run Limits
- SMS/Email sending is rate-limited logically in code but ensure your providers have quota.

## 5. CSV Import
The CSV should have headers: `business_name`, `phone`, `email`, `city`, etc.

## 6. Deployment
Deploy to Vercel. Ensure all environment variables are set in Vercel Project Settings.
