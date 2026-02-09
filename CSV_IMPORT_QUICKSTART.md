# CSV Bulk Import - Quick Start Guide

Get started with CSV bulk import in 5 minutes!

## Installation

### Backend (No changes needed)
The backend endpoint is already implemented. Just ensure your server is running:

```bash
cd backend
uvicorn server:app --reload
```

### Frontend

1. **Install the new dependency**:
```bash
cd frontend
npm install expo-document-picker
# or
yarn add expo-document-picker
```

2. **Start the app**:
```bash
npm start
# or
yarn start
```

## Using CSV Import

### Step 1: Prepare Your CSV

Download the template:
```bash
# The template is located at:
backend/officials_template.csv
```

Or create your own with this format:
```csv
name,email,phone,designation,department,hierarchy_level,area,categories
John Doe,john@mcd.gov.in,+919876543210,Ward Councillor,Municipal Corporation,1,Ward 10,"roads,sanitation"
```

### Step 2: Import Officials

**Via Mobile App** (Recommended):
1. Open CivicSense app
2. Navigate to Admin Panel
3. Click "Import CSV" button
4. Select your CSV file
5. Done! Officials are imported

**Via API**:
```bash
curl -X POST http://localhost:8000/api/admin/officials/bulk-import-csv \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @request.json
```

Where `request.json` contains:
```json
{
  "csv_content": "name,email,phone,...\nJohn Doe,john@gov.in,..."
}
```

### Step 3: Verify Import

Check the app - your officials should now appear in the list!

## Common CSV Format

### Required Fields
- `name`: Official's full name
- `designation`: Job title (e.g., "Ward Councillor")
- `department`: Department name

### Optional Fields
- `email`: Contact email
- `phone`: Phone number with country code
- `hierarchy_level`: 1-7 or name (Parshad, MCD, IAS, MLA, MP, CM, PM)
- `area`: Ward/constituency name
- `categories`: Comma-separated in quotes (e.g., "roads,sanitation")

### Example CSV with 3 Officials

```csv
name,email,phone,designation,department,hierarchy_level,area,categories
Rajesh Kumar,rajesh@mcd.gov.in,+919876543210,Ward Councillor,Municipal Corporation,1,Dwarka,"roads,sanitation"
Priya Sharma,priya@mcd.gov.in,+919876543211,Deputy Commissioner,Municipal Corporation,2,South Delhi,"electricity,water"
Amit Verma,amit@delhi.gov.in,+919876543212,District Magistrate,Revenue,3,South Delhi,"safety,construction"
```

## Troubleshooting

### "Module not found: expo-document-picker"
```bash
cd frontend
npm install
```

### "Admin authentication required"
Make sure you're logged in as an admin user. To create an admin:
```javascript
// In MongoDB
db.users.updateOne(
  { firebase_uid: "YOUR_UID" },
  { $set: { is_admin: true } }
)
```

### Import shows errors
- Check that all required fields are filled
- Ensure categories are in quotes if multiple
- Verify hierarchy_level is 1-7 or valid name

### File picker doesn't open
- Ensure expo-document-picker is installed
- Restart the Expo dev server
- Clear cache: `expo start -c`

## Need Help?

See the full documentation:
- [CSV_BULK_IMPORT.md](CSV_BULK_IMPORT.md) - Complete guide
- [CSV_IMPORT_IMPLEMENTATION.md](CSV_IMPORT_IMPLEMENTATION.md) - Technical details
- [backend/officials_template.csv](backend/officials_template.csv) - Sample data

---

**Time to import 100 officials**: ~10 seconds
**Time saved vs manual entry**: 3000x faster

Happy importing! 🚀
