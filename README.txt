1. Run 0004_prescription_image_storage.sql in Supabase SQL Editor.
2. Replace app/prescription/page.tsx with the new file.
3. Create app/prescription/scan/page.tsx with the new scanner file.
4. Restart: npm run dev

/prescription = saved prescription IMAGES
/prescription/scan = scanner
/medicines = active medicines

Older prescriptions cannot display an image because their image was not uploaded before this change. New scans will store the image privately.
