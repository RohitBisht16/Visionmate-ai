# VisionMate AI

An AI-powered healthcare assistant designed to help users understand medications, scan prescriptions, and navigate safety insights with ease.

---

## 🚀 Dashboard Overview

![VisionMate AI Dashboard](./public/assets/dashboard-previeww.png)

### Key Features
- **A. Overview / Dashboard:** Main workspace and medicine management summary.
- **B. Prescription:** Prescription scanning and management.
- **C. My Medicines:** Saved medication information and schedules.
- **D. Safety Center:** Healthcare safety and navigation area.
- **E. Ask Visionmate:** AI assistant for real-time medicine queries.
- **F. Voice Assistant:** Voice-first interactive guidance.
- **G. History:** Previous activity logs and information.
- **H. Profile & Settings:** Custom user profile and preferences.

---

## 🛠️ Prescription Scanner & Storage Setup

### Setup Instructions
1. **Database Migration:** Run `0004_prescription_image_storage.sql` inside your **Supabase SQL Editor** to initialize private image storage buckets and table schemas.
2. **Prescription Page:** Update `app/prescription/page.tsx` with the new file handling saved prescription images.
3. **Scanner Route:** Create `app/prescription/scan/page.tsx` with the new prescription scanner component.
4. **Restart Server:** Run `npm run dev` to apply changes locally.

---

## 🗺️ Route Architecture
* `/prescription` — Displays saved prescription images and records.
* `/prescription/scan` — Interactive prescription scanner tool.
* `/medicines` — Active medicine schedules and saved insights.

> ⚠️ **Note on Existing Data:** Older prescriptions will not display an image preview as image file uploads were introduced in this update. All newly scanned prescriptions will securely upload and store images in private Supabase storage.